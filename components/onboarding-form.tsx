'use client';

import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

type Step = 1 | 2 | 3;

interface RoleCostRow {
  id: string;
  role: string;
  costPerHour: string;
}

interface RoleMixRow {
  id: string;
  role: string;
  percentage: string;
}

interface OfferingRow {
  localId: string;
  id?: string;
  name: string;
  unitType: 'fixed' | 'retainer';
  baselineHours: string;
  roleMix: RoleMixRow[];
}

interface ApiAgencySettings {
  monthly_overheads: number;
  utilization_pct: number;
  target_margin_pct: number;
  currency: string;
  role_costs_json: Record<string, number> | null;
}

interface ApiOffering {
  id: string;
  name: string;
  unit_type: 'fixed' | 'retainer';
  baseline_hours: number;
  roles_mix_json: Record<string, number> | null;
}

interface OnboardingGetResponse {
  agencySettings: ApiAgencySettings | null;
  offerings: ApiOffering[];
}

const stepOneSchema = z.object({
  monthlyOverheads: z.coerce.number().positive('Monthly overheads must be greater than 0'),
  utilizationPct: z.coerce.number().min(1, 'Utilization must be at least 1').max(100, 'Utilization must be <= 100'),
  targetMarginPct: z.coerce
    .number()
    .min(0, 'Target margin cannot be negative')
    .max(100, 'Target margin must be <= 100'),
  currency: z.string().trim().length(3, 'Currency must be a 3-letter code')
});

const roleCostsSchema = z.array(
  z.object({
    role: z.string().trim().min(1, 'Role is required'),
    costPerHour: z.coerce.number().positive('Cost per hour must be greater than 0')
  })
);

const offeringsSchema = z.array(
  z.object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, 'Offering name is required'),
    unitType: z.enum(['fixed', 'retainer']),
    baselineHours: z.coerce.number().positive('Baseline hours must be greater than 0'),
    roleMix: z
      .array(
        z.object({
          role: z.string().trim().min(1, 'Role is required'),
          percentage: z.coerce
            .number()
            .positive('Percentage must be greater than 0')
            .max(100, 'Percentage must be <= 100')
        })
      )
      .optional()
      .default([])
  })
);

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'SAR'];

function createRoleCostRow(): RoleCostRow {
  return { id: crypto.randomUUID(), role: '', costPerHour: '' };
}

function createRoleMixRow(): RoleMixRow {
  return { id: crypto.randomUUID(), role: '', percentage: '' };
}

function createOfferingRow(): OfferingRow {
  return { localId: crypto.randomUUID(), name: '', unitType: 'fixed', baselineHours: '', roleMix: [] };
}

function getFirstZodError(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Please fix validation errors before continuing.';
}

export function OnboardingForm() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [monthlyOverheads, setMonthlyOverheads] = useState('');
  const [utilizationPct, setUtilizationPct] = useState('');
  const [targetMarginPct, setTargetMarginPct] = useState('');
  const [currency, setCurrency] = useState('USD');

  const [roleCosts, setRoleCosts] = useState<RoleCostRow[]>([createRoleCostRow()]);
  const [offerings, setOfferings] = useState<OfferingRow[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/api/onboarding');
        if (!response.ok) {
          throw new Error('Failed to load onboarding data');
        }

        const payload = (await response.json()) as OnboardingGetResponse;

        if (payload.agencySettings) {
          setMonthlyOverheads(String(payload.agencySettings.monthly_overheads));
          setUtilizationPct(String(payload.agencySettings.utilization_pct));
          setTargetMarginPct(String(payload.agencySettings.target_margin_pct));
          setCurrency(payload.agencySettings.currency || 'USD');

          const roleCostEntries = Object.entries(payload.agencySettings.role_costs_json ?? {});
          setRoleCosts(
            roleCostEntries.length > 0
              ? roleCostEntries.map(([role, cost]) => ({
                  id: crypto.randomUUID(),
                  role,
                  costPerHour: String(cost)
                }))
              : [createRoleCostRow()]
          );
        }

        setOfferings(
          payload.offerings.length > 0
            ? payload.offerings.map((offering) => ({
                localId: crypto.randomUUID(),
                id: offering.id,
                name: offering.name,
                unitType: offering.unit_type,
                baselineHours: String(offering.baseline_hours),
                roleMix: Object.entries(offering.roles_mix_json ?? {}).map(([role, percentage]) => ({
                  id: crypto.randomUUID(),
                  role,
                  percentage: String(percentage)
                }))
              }))
            : []
        );
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Failed to load onboarding data');
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, []);

  const progress = useMemo(() => `${step} / 3`, [step]);

  function validateStepOne() {
    const parsed = stepOneSchema.safeParse({
      monthlyOverheads,
      utilizationPct,
      targetMarginPct,
      currency
    });

    if (!parsed.success) {
      setStepError(getFirstZodError(parsed.error));
      return false;
    }

    return true;
  }

  function validateStepTwo() {
    const parsed = roleCostsSchema.safeParse(roleCosts);
    if (!parsed.success) {
      setStepError(getFirstZodError(parsed.error));
      return false;
    }

    return true;
  }

  function validateStepThree() {
    const parsed = offeringsSchema.safeParse(offerings);
    if (!parsed.success) {
      setStepError(getFirstZodError(parsed.error));
      return false;
    }

    return true;
  }

  function updateRoleCost(id: string, key: 'role' | 'costPerHour', value: string) {
    setRoleCosts((current) => current.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  }

  function updateOffering(localId: string, key: 'name' | 'unitType' | 'baselineHours', value: string) {
    setOfferings((current) =>
      current.map((row) => {
        if (row.localId !== localId) return row;
        if (key === 'unitType') return { ...row, unitType: value as 'fixed' | 'retainer' };
        return { ...row, [key]: value };
      })
    );
  }

  function updateOfferingRoleMix(offeringLocalId: string, mixId: string, key: 'role' | 'percentage', value: string) {
    setOfferings((current) =>
      current.map((offering) =>
        offering.localId === offeringLocalId
          ? {
              ...offering,
              roleMix: offering.roleMix.map((mix) => (mix.id === mixId ? { ...mix, [key]: value } : mix))
            }
          : offering
      )
    );
  }

  async function handleSave() {
    if (!validateStepThree() || !validateStepTwo() || !validateStepOne()) return;

    setStepError(null);
    setSuccessMessage(null);
    setSaving(true);

    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencySettings: {
            monthlyOverheads: Number(monthlyOverheads),
            utilizationPct: Number(utilizationPct),
            targetMarginPct: Number(targetMarginPct),
            currency: currency.toUpperCase(),
            roleCosts: roleCosts.map((row) => ({
              role: row.role.trim(),
              costPerHour: Number(row.costPerHour)
            }))
          },
          offerings: offerings.map((offering) => ({
            id: offering.id,
            name: offering.name.trim(),
            unitType: offering.unitType,
            baselineHours: Number(offering.baselineHours),
            roleMix: offering.roleMix.map((mix) => ({
              role: mix.role.trim(),
              percentage: Number(mix.percentage)
            }))
          }))
        })
      });

      const body = (await response.json()) as { error?: string; offerings?: ApiOffering[] };
      if (!response.ok) {
        throw new Error(body.error ?? 'Failed to save onboarding data');
      }

      if (body.offerings) {
        setOfferings(
          body.offerings.map((offering) => ({
            localId: crypto.randomUUID(),
            id: offering.id,
            name: offering.name,
            unitType: offering.unit_type,
            baselineHours: String(offering.baseline_hours),
            roleMix: Object.entries(offering.roles_mix_json ?? {}).map(([role, percentage]) => ({
              id: crypto.randomUUID(),
              role,
              percentage: String(percentage)
            }))
          }))
        );
      }

      setSuccessMessage('Onboarding settings saved successfully.');
    } catch (error) {
      setStepError(error instanceof Error ? error.message : 'Failed to save onboarding data');
    } finally {
      setSaving(false);
    }
  }

  function handleNext() {
    setStepError(null);
    setSuccessMessage(null);

    if (step === 1 && !validateStepOne()) return;
    if (step === 2 && !validateStepTwo()) return;
    if (step < 3) setStep((current) => (current + 1) as Step);
  }

  function handleBack() {
    setStepError(null);
    setSuccessMessage(null);
    if (step > 1) setStep((current) => (current - 1) as Step);
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading onboarding data...</p>;
  }

  if (loadError) {
    return <p className="text-sm text-destructive">{loadError}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-3">
        <p className="text-sm font-medium">Step {progress}</p>
        <p className="text-sm text-muted-foreground">
          {step === 1 && 'Agency economics'}
          {step === 2 && 'Role costs'}
          {step === 3 && 'Offerings'}
        </p>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Agency economics</CardTitle>
            <CardDescription>Set monthly overheads, utilization, margin target, and billing currency.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="monthly-overheads">Monthly overheads</Label>
              <Input
                id="monthly-overheads"
                type="number"
                min="0"
                step="0.01"
                value={monthlyOverheads}
                onChange={(event) => setMonthlyOverheads(event.target.value)}
                placeholder="50000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="utilization-pct">Utilization %</Label>
              <Input
                id="utilization-pct"
                type="number"
                min="1"
                max="100"
                step="0.1"
                value={utilizationPct}
                onChange={(event) => setUtilizationPct(event.target.value)}
                placeholder="75"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-margin-pct">Target margin %</Label>
              <Input
                id="target-margin-pct"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={targetMarginPct}
                onChange={(event) => setTargetMarginPct(event.target.value)}
                placeholder="30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select id="currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>
                {CURRENCIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Role costs</CardTitle>
            <CardDescription>Add your role rates used for pricing and margin calculations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {roleCosts.map((row, index) => (
              <div key={row.id} className="grid gap-3 rounded-md border p-4 sm:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-2">
                  <Label htmlFor={`role-name-${row.id}`}>Role {index + 1}</Label>
                  <Input
                    id={`role-name-${row.id}`}
                    value={row.role}
                    onChange={(event) => updateRoleCost(row.id, 'role', event.target.value)}
                    placeholder="Account Director"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`role-cost-${row.id}`}>Cost per hour</Label>
                  <Input
                    id={`role-cost-${row.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.costPerHour}
                    onChange={(event) => updateRoleCost(row.id, 'costPerHour', event.target.value)}
                    placeholder="120"
                  />
                </div>
                <div className="flex items-end">
                  <Button type="button" variant="outline" onClick={() => setRoleCosts((current) => current.filter((item) => item.id !== row.id))}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => setRoleCosts((current) => [...current, createRoleCostRow()])}>
              Add role cost
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Offerings</CardTitle>
            <CardDescription>Create and maintain service offerings, with optional role mix percentages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {offerings.length === 0 && (
              <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
                No offerings yet. Add your first one.
              </p>
            )}

            {offerings.map((offering, index) => (
              <div key={offering.localId} className="space-y-3 rounded-md border p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor={`offering-name-${offering.localId}`}>Offering {index + 1} name</Label>
                    <Input
                      id={`offering-name-${offering.localId}`}
                      value={offering.name}
                      onChange={(event) => updateOffering(offering.localId, 'name', event.target.value)}
                      placeholder="Website Retainer"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`offering-unit-${offering.localId}`}>Unit type</Label>
                    <Select
                      id={`offering-unit-${offering.localId}`}
                      value={offering.unitType}
                      onChange={(event) => updateOffering(offering.localId, 'unitType', event.target.value)}
                    >
                      <option value="fixed">Fixed</option>
                      <option value="retainer">Retainer</option>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`offering-hours-${offering.localId}`}>Baseline hours</Label>
                    <Input
                      id={`offering-hours-${offering.localId}`}
                      type="number"
                      min="0"
                      step="0.1"
                      value={offering.baselineHours}
                      onChange={(event) => updateOffering(offering.localId, 'baselineHours', event.target.value)}
                      placeholder="80"
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                  <p className="text-sm font-medium">Optional role mix</p>
                  {offering.roleMix.length === 0 && (
                    <p className="text-sm text-muted-foreground">No role mix rows yet. Add if this offering has a standard mix.</p>
                  )}
                  {offering.roleMix.map((mix) => (
                    <div key={mix.id} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                      <Input
                        value={mix.role}
                        onChange={(event) => updateOfferingRoleMix(offering.localId, mix.id, 'role', event.target.value)}
                        placeholder="Strategist"
                      />
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={mix.percentage}
                        onChange={(event) => updateOfferingRoleMix(offering.localId, mix.id, 'percentage', event.target.value)}
                        placeholder="40"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setOfferings((current) =>
                            current.map((item) =>
                              item.localId === offering.localId
                                ? { ...item, roleMix: item.roleMix.filter((entry) => entry.id !== mix.id) }
                                : item
                            )
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setOfferings((current) =>
                        current.map((item) =>
                          item.localId === offering.localId ? { ...item, roleMix: [...item.roleMix, createRoleMixRow()] } : item
                        )
                      )
                    }
                  >
                    Add role mix row
                  </Button>
                </div>

                <Button type="button" variant="outline" onClick={() => setOfferings((current) => current.filter((item) => item.localId !== offering.localId))}>
                  Delete offering
                </Button>
              </div>
            ))}

            <Button type="button" variant="outline" onClick={() => setOfferings((current) => [...current, createOfferingRow()])}>
              Add offering
            </Button>
          </CardContent>
        </Card>
      )}

      {stepError && <p className="text-sm text-destructive">{stepError}</p>}
      {successMessage && <p className="text-sm text-green-700">{successMessage}</p>}

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={handleBack} disabled={step === 1 || saving}>
          Back
        </Button>
        {step < 3 ? (
          <Button type="button" onClick={handleNext} disabled={saving}>
            Next
          </Button>
        ) : (
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving...' : 'Save onboarding'}
          </Button>
        )}
      </div>
    </div>
  );
}
