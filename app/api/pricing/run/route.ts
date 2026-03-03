import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { TableRow } from '@/types/supabase';

const payloadSchema = z.object({
  offering_id: z.string().uuid(),
  client_domain: z.string().trim().min(1),
  timeline_weeks: z.number().min(1).max(52),
  scope_complexity: z.number().int().min(1).max(5),
  repeat_client: z.boolean().default(false)
});

const ASSUMED_FTE = 5;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function avg(numbers: number[]) {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function getDemandMultiplier(utilizationPct: number) {
  if (utilizationPct < 60) return { value: 0.95, reason: 'Utilization below 60% (lower demand).' };
  if (utilizationPct < 80) return { value: 1, reason: 'Utilization in steady range (60-80%).' };
  if (utilizationPct <= 90) return { value: 1.15, reason: 'Utilization is elevated (80-90%).' };
  return { value: 1.25, reason: 'Utilization above 90% (high demand).' };
}

function getSegmentMultiplier(employeeCount: number | null) {
  if (employeeCount === null) return { value: 1, reason: 'No employee signal found. Using neutral segment multiplier.' };
  if (employeeCount < 50) return { value: 0.95, reason: 'Small company segment (<50 employees).' };
  if (employeeCount < 250) return { value: 1.05, reason: 'Mid-market segment (50-250 employees).' };
  if (employeeCount < 1000) return { value: 1.12, reason: 'Upper mid-market segment (250-1000 employees).' };
  return { value: 1.18, reason: 'Enterprise segment (1000+ employees).' };
}

function getRiskMultiplier(scopeComplexity: number, repeatClient: boolean) {
  const baseMap = { 1: 1, 2: 1.05, 3: 1.1, 4: 1.16, 5: 1.22 } as const;
  const base = baseMap[scopeComplexity as keyof typeof baseMap];
  const adjusted = repeatClient ? Math.max(1, base - 0.05) : base;
  return {
    value: adjusted,
    reason: repeatClient
      ? `Complexity level ${scopeComplexity} reduced for repeat client trust.`
      : `Complexity level ${scopeComplexity} with standard risk loading.`
  };
}

function getUrgencyMultiplier(timelineWeeks: number) {
  if (timelineWeeks >= 8) return { value: 1, reason: 'Timeline is 8+ weeks (normal urgency).' };
  if (timelineWeeks >= 4) return { value: 1.05, reason: 'Timeline is 4-7 weeks (moderate urgency).' };
  if (timelineWeeks >= 2) return { value: 1.12, reason: 'Timeline is 2-3 weeks (high urgency).' };
  return { value: 1.15, reason: 'Timeline under 2 weeks (rush work).' };
}

function toCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 0
  }).format(amount);
}

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = payloadSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const [{ data: settingsRaw }, { data: offeringRaw }, { data: profileRaw }, { data: dealsRaw }] = await Promise.all([
      supabase.from('agency_settings').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('offerings').select('*').eq('id', parsed.data.offering_id).maybeSingle(),
      supabase.from('client_profiles').select('*').eq('domain', parsed.data.client_domain.toLowerCase()).maybeSingle(),
      supabase
        .from('deals')
        .select('amount, outcome')
        .eq('offering_id', parsed.data.offering_id)
        .not('amount', 'is', null)
    ]);

    const settings = settingsRaw as TableRow<'agency_settings'> | null;
    const offering = offeringRaw as TableRow<'offerings'> | null;
    const profile = profileRaw as TableRow<'client_profiles'> | null;
    const deals = (dealsRaw ?? []) as Array<Pick<TableRow<'deals'>, 'amount' | 'outcome'>>;

    if (!settings) {
      return NextResponse.json({ error: 'Missing agency settings. Complete onboarding first.' }, { status: 400 });
    }
    if (!offering) {
      return NextResponse.json({ error: 'Offering not found.' }, { status: 404 });
    }

    const roleCosts = (settings.role_costs_json ?? {}) as Record<string, number>;
    const roleCostValues = Object.values(roleCosts).filter((value) => Number.isFinite(value));
    const blendedAverage = avg(roleCostValues);

    const roleMix = (offering.roles_mix_json ?? {}) as Record<string, number>;
    const roleMixEntries = Object.entries(roleMix);
    const hasRoleMix = roleMixEntries.length > 0;

    const roleMixWeighted = hasRoleMix
      ? roleMixEntries.reduce((sum, [role, percentage]) => {
          const roleCost = Number(roleCosts[role] ?? blendedAverage);
          return sum + roleCost * (Number(percentage) / 100);
        }, 0)
      : blendedAverage;

    const blendedCostPerHour = roleMixWeighted || blendedAverage || 100;

    const utilizationPct = clamp(Number(settings.utilization_pct), 1, 100);
    const overheadPerHour = Number(settings.monthly_overheads) / (160 * ASSUMED_FTE * (utilizationPct / 100));
    const baseCost = Number(offering.baseline_hours) * (blendedCostPerHour + overheadPerHour);
    const targetMargin = clamp(Number(settings.target_margin_pct) / 100, 0.01, 0.95);
    const basePriceTarget = baseCost / (1 - targetMargin);

    const signals = (profile?.clay_signals ?? {}) as Record<string, unknown>;
    const employeeSignal = [signals.employees, signals.employee_count, signals.team_size].find(
      (value) => typeof value === 'number'
    ) as number | undefined;
    const employeeCount = typeof employeeSignal === 'number' ? employeeSignal : null;

    const demand = getDemandMultiplier(utilizationPct);
    const segment = getSegmentMultiplier(employeeCount);
    const risk = getRiskMultiplier(parsed.data.scope_complexity, parsed.data.repeat_client);
    const urgency = getUrgencyMultiplier(parsed.data.timeline_weeks);

    const finalPrice =
      basePriceTarget * demand.value * segment.value * risk.value * urgency.value;

    const packageMultipliers = [
      { name: 'Essential', multiplier: 0.9 },
      { name: 'Standard', multiplier: 1 },
      { name: 'Premium', multiplier: 1.25 }
    ] as const;

    const packages = packageMultipliers.map((entry) => {
      const price = Number((finalPrice * entry.multiplier).toFixed(2));
      const marginPct = Number((((price - baseCost) / price) * 100).toFixed(1));
      return {
        name: entry.name,
        price,
        margin_pct: marginPct,
        scope_bullets:
          entry.name === 'Essential'
            ? [
                `Core ${offering.name} deliverables only`,
                'Single weekly check-in',
                'One revision cycle'
              ]
            : entry.name === 'Standard'
              ? [
                  `Full ${offering.name} baseline scope`,
                  'Weekly status sync + progress reporting',
                  'Two revision cycles'
                ]
              : [
                  `Expanded ${offering.name} with strategic layer`,
                  'Twice-weekly collaboration cadence',
                  'Priority support and additional QA'
                ],
        assumptions: [
          'Client provides feedback within 2 business days',
          'Scope changes beyond baseline are re-estimated'
        ],
        exclusions: ['Paid media spend', 'Third-party software license fees'],
        team_structure: hasRoleMix
          ? roleMixEntries.map(([role, percentage]) => `${role} (${percentage}%)`)
          : ['Cross-functional pod based on role costs'],
        timeline: `${parsed.data.timeline_weeks} week(s)`
      };
    });

    const guardrails: string[] = [];
    if (packages[0].margin_pct < Number(settings.target_margin_pct)) {
      guardrails.push('Essential package is below target margin. Consider narrowing scope or timeline.');
    }
    if (utilizationPct < 55) {
      guardrails.push('Low utilization detected. Demand multiplier lowers pricing to improve competitiveness.');
    }
    if (parsed.data.timeline_weeks < 2) {
      guardrails.push('Rush timeline applied. Confirm team capacity before sending quote.');
    }

    const dealsWithAmount = (deals ?? []).filter((deal) => typeof deal.amount === 'number');
    const evByBucket = dealsWithAmount.length
      ? (() => {
          const sorted = [...dealsWithAmount].sort((a, b) => Number(a.amount) - Number(b.amount));
          const bucketCount = Math.min(6, Math.max(4, Math.floor(Math.sqrt(sorted.length))));
          const bucketSize = Math.ceil(sorted.length / bucketCount);
          const buckets = Array.from({ length: bucketCount }, (_, index) => {
            const slice = sorted.slice(index * bucketSize, (index + 1) * bucketSize);
            if (slice.length === 0) return null;
            const min = Number(slice[0].amount);
            const max = Number(slice[slice.length - 1].amount);
            const won = slice.filter((item) => item.outcome === 'won').length;
            const winRate = won / slice.length;
            const midpoint = (min + max) / 2;
            const ev = winRate * (midpoint - baseCost);
            return {
              label: `${toCurrency(min, settings.currency)} - ${toCurrency(max, settings.currency)}`,
              min,
              max,
              total: slice.length,
              win_rate: Number((winRate * 100).toFixed(1)),
              ev: Number(ev.toFixed(2))
            };
          }).filter(Boolean);
          const suggested = [...buckets].sort((a, b) => (b?.ev ?? 0) - (a?.ev ?? 0))[0];
          return { buckets, suggested_band: suggested?.label ?? null };
        })()
      : { buckets: [], suggested_band: null };

    const responsePayload = {
      currency: settings.currency,
      disclaimer: 'Pricing guidance based on your inputs and historical patterns.',
      input: parsed.data,
      base_breakdown: {
        baseline_hours: Number(offering.baseline_hours),
        blended_cost_per_hour: Number(blendedCostPerHour.toFixed(2)),
        overhead_per_hour: Number(overheadPerHour.toFixed(2)),
        base_cost: Number(baseCost.toFixed(2)),
        target_margin_pct: Number(settings.target_margin_pct),
        base_price_target: Number(basePriceTarget.toFixed(2))
      },
      multipliers: {
        demand,
        segment: { ...segment, employee_count: employeeCount },
        risk,
        urgency
      },
      final_price: Number(finalPrice.toFixed(2)),
      packages,
      explain: {
        reasons: [demand.reason, segment.reason, risk.reason, urgency.reason],
        guardrails
      },
      learning: evByBucket
    };

    const { error: runError } = await supabase
      .from('model_runs')
      // Supabase generated types in this repo currently infer never for insert values.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error Pending generated type fix.
      .insert({
        offering_id: parsed.data.offering_id,
        client_domain: parsed.data.client_domain.toLowerCase(),
        inputs: parsed.data,
        outputs: responsePayload
      });

    if (runError) {
      return NextResponse.json({ error: runError.message }, { status: 500 });
    }

    return NextResponse.json(responsePayload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run pricing model' },
      { status: 500 }
    );
  }
}
