'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

interface Offering {
  id: string;
  name: string;
}

interface ClientProfile {
  domain: string;
  company_name: string | null;
  status: 'pending' | 'ready';
}

interface PricingPackage {
  name: 'Essential' | 'Standard' | 'Premium';
  price: number;
  margin_pct: number;
  scope_bullets: string[];
  assumptions: string[];
  exclusions: string[];
  team_structure: string[];
  timeline: string;
}

interface PricingResult {
  currency: string;
  disclaimer: string;
  base_breakdown: {
    baseline_hours: number;
    blended_cost_per_hour: number;
    overhead_per_hour: number;
    base_cost: number;
    target_margin_pct: number;
    base_price_target: number;
  };
  multipliers: {
    demand: { value: number; reason: string };
    segment: { value: number; reason: string; employee_count: number | null };
    risk: { value: number; reason: string };
    urgency: { value: number; reason: string };
  };
  final_price: number;
  packages: PricingPackage[];
  explain: { reasons: string[]; guardrails: string[] };
  learning: {
    buckets: Array<{ label: string; win_rate: number; total: number; ev: number }>;
    suggested_band: string | null;
  };
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

export function DashboardWorkbench() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [offeringId, setOfferingId] = useState('');
  const [clientDomain, setClientDomain] = useState('');
  const [timelineWeeks, setTimelineWeeks] = useState(6);
  const [scopeComplexity, setScopeComplexity] = useState(3);
  const [repeatClient, setRepeatClient] = useState(false);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<PricingResult | null>(null);

  async function loadReferenceData() {
    setLoading(true);
    setLoadError(null);
    try {
      const [onboardingResponse, clientsResponse] = await Promise.all([fetch('/api/onboarding'), fetch('/api/clients')]);
      const onboarding = (await onboardingResponse.json()) as { offerings?: Offering[]; error?: string };
      const clientsData = (await clientsResponse.json()) as { clients?: ClientProfile[]; error?: string };

      if (!onboardingResponse.ok) throw new Error(onboarding.error ?? 'Failed to load offerings');
      if (!clientsResponse.ok) throw new Error(clientsData.error ?? 'Failed to load clients');

      const nextOfferings = onboarding.offerings ?? [];
      const nextClients = clientsData.clients ?? [];
      setOfferings(nextOfferings);
      setClients(nextClients);
      if (!offeringId && nextOfferings[0]) setOfferingId(nextOfferings[0].id);
      if (!clientDomain && nextClients[0]) setClientDomain(nextClients[0].domain);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReferenceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedOffering = useMemo(() => offerings.find((offering) => offering.id === offeringId) ?? null, [offeringId, offerings]);

  async function runPricingModel() {
    setRunning(true);
    setRunError(null);
    setResult(null);
    try {
      const response = await fetch('/api/pricing/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offering_id: offeringId,
          client_domain: clientDomain,
          timeline_weeks: timelineWeeks,
          scope_complexity: scopeComplexity,
          repeat_client: repeatClient
        })
      });

      const payload = (await response.json()) as PricingResult | { error?: string };
      if (!response.ok) throw new Error('error' in payload ? payload.error : 'Failed to run pricing');
      setResult(payload as PricingResult);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Failed to run pricing');
    } finally {
      setRunning(false);
    }
  }

  function selectPackageForDocuments(pkg: PricingPackage) {
    if (!selectedOffering || !result) return;
    const documentSeed = {
      client_domain: clientDomain,
      offering_id: selectedOffering.id,
      offering_name: selectedOffering.name,
      package_name: pkg.name,
      timeline_weeks: timelineWeeks,
      total_price: pkg.price,
      assumptions: pkg.assumptions,
      exclusions: pkg.exclusions
    };
    window.localStorage.setItem('pricr_selected_package', JSON.stringify(documentSeed));
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading dashboard data...</p>;
  }

  if (loadError) {
    return <p className="text-sm text-destructive">{loadError}</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Run deterministic pricing</CardTitle>
          <CardDescription>Price = Base(cost+margin) x Demand x Segment x Risk x Urgency.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pricing-offering">Offering</Label>
            <Select id="pricing-offering" value={offeringId} onChange={(event) => setOfferingId(event.target.value)}>
              {offerings.map((offering) => (
                <option key={offering.id} value={offering.id}>
                  {offering.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pricing-client">Client domain</Label>
            <Input id="pricing-client" list="client-domain-options" value={clientDomain} onChange={(event) => setClientDomain(event.target.value)} />
            <datalist id="client-domain-options">
              {clients.map((client) => (
                <option key={client.domain} value={client.domain} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="timeline-weeks">Timeline weeks: {timelineWeeks}</Label>
            <Input id="timeline-weeks" type="range" min="1" max="16" value={timelineWeeks} onChange={(event) => setTimelineWeeks(Number(event.target.value))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="scope-complexity">Scope complexity: {scopeComplexity}</Label>
            <Input
              id="scope-complexity"
              type="range"
              min="1"
              max="5"
              value={scopeComplexity}
              onChange={(event) => setScopeComplexity(Number(event.target.value))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={repeatClient} onChange={(event) => setRepeatClient(event.target.checked)} />
            Repeat client
          </label>
          <div className="md:col-span-2">
            <Button type="button" disabled={!offeringId || !clientDomain || running} onClick={() => void runPricingModel()}>
              {running ? 'Running model...' : 'Run pricing'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {runError && <p className="text-sm text-destructive">{runError}</p>}

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Package recommendations</CardTitle>
              <CardDescription>{result.disclaimer}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {result.packages.map((pkg) => (
                <div key={pkg.name} className="space-y-3 rounded-md border p-4">
                  <div>
                    <p className="text-lg font-semibold">{pkg.name}</p>
                    <p className="text-2xl font-bold">{formatCurrency(pkg.price, result.currency)}</p>
                    <p className="text-sm text-muted-foreground">Margin: {pkg.margin_pct}%</p>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {pkg.scope_bullets.map((bullet) => (
                      <li key={bullet}>- {bullet}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">Timeline: {pkg.timeline}</p>
                  <Button type="button" variant="outline" onClick={() => selectPackageForDocuments(pkg)}>
                    Use in documents
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Explain this price</CardTitle>
              <CardDescription>Transparent multiplier breakdown and guardrails.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <p>Base cost: {formatCurrency(result.base_breakdown.base_cost, result.currency)}</p>
                <p>Base target (margin): {formatCurrency(result.base_breakdown.base_price_target, result.currency)}</p>
                <p>Demand x{result.multipliers.demand.value.toFixed(2)}</p>
                <p>Segment x{result.multipliers.segment.value.toFixed(2)}</p>
                <p>Risk x{result.multipliers.risk.value.toFixed(2)}</p>
                <p>Urgency x{result.multipliers.urgency.value.toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                {result.explain.reasons.map((reason) => (
                  <p key={reason}>- {reason}</p>
                ))}
              </div>
              {result.explain.guardrails.length > 0 && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                  {result.explain.guardrails.map((item) => (
                    <p key={item}>- {item}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Win-rate and EV by price buckets</CardTitle>
              <CardDescription>Suggested EV band: {result.learning.suggested_band ?? 'Not enough data yet'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.learning.buckets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No historical pricing data for this offering yet.</p>
              ) : (
                result.learning.buckets.map((bucket) => (
                  <div key={bucket.label} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{bucket.label}</span>
                      <span>
                        {bucket.win_rate}% win rate | EV {formatCurrency(bucket.ev, result.currency)}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded bg-muted">
                      <div className="h-2 rounded bg-primary" style={{ width: `${bucket.win_rate}%` }} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
