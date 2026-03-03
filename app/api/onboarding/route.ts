import { NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import {
  onboardingPayloadSchema,
  type AgencyRoleCostsInput,
  type OfferingRoleMixInput
} from '@/lib/validation/onboarding';
import type { TableInsert } from '@/types/supabase';

function toRoleCostJson(input: AgencyRoleCostsInput) {
  return input.reduce<Record<string, number>>((acc, item) => {
    acc[item.role] = item.costPerHour;
    return acc;
  }, {});
}

function toRoleMixJson(input: OfferingRoleMixInput | undefined) {
  const rows = input ?? [];
  return rows.reduce<Record<string, number>>((acc, item) => {
    acc[item.role] = item.percentage;
    return acc;
  }, {});
}

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();

    const [{ data: agencySettings, error: agencyError }, { data: offerings, error: offeringsError }] = await Promise.all(
      [
        supabase.from('agency_settings').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('offerings').select('*').order('created_at', { ascending: true })
      ]
    );

    if (agencyError) throw agencyError;
    if (offeringsError) throw offeringsError;

    return NextResponse.json({
      agencySettings,
      offerings
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load onboarding data' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = onboardingPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { agencySettings, offerings } = parsed.data;

    const { data: existingAgencySettingsRaw, error: existingAgencyError } = await supabase
      .from('agency_settings')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingAgencyError) throw existingAgencyError;
    const existingAgencySettings = existingAgencySettingsRaw as { id: string } | null;

    const { data: savedAgencySettings, error: agencyUpsertError } = await (supabase
      .from('agency_settings') as any)
      .upsert(
        {
          id: existingAgencySettings?.id,
          monthly_overheads: agencySettings.monthlyOverheads,
          utilization_pct: agencySettings.utilizationPct,
          target_margin_pct: agencySettings.targetMarginPct,
          currency: agencySettings.currency,
          role_costs_json: toRoleCostJson(agencySettings.roleCosts)
        } satisfies TableInsert<'agency_settings'>,
        { onConflict: 'id' }
      )
      .select('*')
      .single();

    if (agencyUpsertError) throw agencyUpsertError;

    const { data: existingOfferingsRaw, error: existingOfferingsError } = await supabase.from('offerings').select('id');
    if (existingOfferingsError) throw existingOfferingsError;
    const existingOfferings = (existingOfferingsRaw ?? []) as Array<{ id: string }>;

    const incomingIds = offerings.map((offering) => offering.id).filter((id): id is string => Boolean(id));
    const idsToDelete = existingOfferings
      .map((offering) => offering.id)
      .filter((existingId) => !incomingIds.includes(existingId));

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase.from('offerings').delete().in('id', idsToDelete);
      if (deleteError) throw deleteError;
    }

    if (offerings.length > 0) {
      const offeringRows = offerings.map(
        (offering) =>
          ({
            id: offering.id,
            name: offering.name,
            unit_type: offering.unitType,
            baseline_hours: offering.baselineHours,
            roles_mix_json: toRoleMixJson(offering.roleMix)
          }) satisfies TableInsert<'offerings'>
      );

      const { error: offeringsUpsertError } = await (supabase.from('offerings') as any).upsert(offeringRows, {
        onConflict: 'id'
      });

      if (offeringsUpsertError) throw offeringsUpsertError;
    }

    const { data: savedOfferings, error: savedOfferingsError } = await supabase
      .from('offerings')
      .select('*')
      .order('created_at', { ascending: true });

    if (savedOfferingsError) throw savedOfferingsError;

    return NextResponse.json({
      agencySettings: savedAgencySettings,
      offerings: savedOfferings
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save onboarding data' },
      { status: 500 }
    );
  }
}
