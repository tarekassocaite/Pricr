'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

interface OfferingOption {
  id: string;
  name: string;
}

interface DealRow {
  id: string;
  close_date: string;
  amount: number | null;
  currency: string;
  outcome: 'won' | 'lost';
  description: string;
  client_domain: string;
  offering_id: string | null;
}

interface PreviewRow {
  rowNumber: number;
  close_date?: string;
  amount?: string;
  currency?: string;
  outcome?: string;
  description?: string;
  client_domain?: string;
  offering_id?: string;
  status: 'valid' | 'error';
  error?: string;
}

interface RowError {
  rowNumber: number;
  message: string;
}

interface ImportResponse {
  importedRows: number;
  validRows: number;
  invalidRows: number;
  rowErrors: RowError[];
  previewRows: PreviewRow[];
  message: string;
}

interface DealsResponse {
  deals: DealRow[];
  offerings: OfferingOption[];
}

interface PriceBand {
  label: string;
  min: number;
  max: number;
}

const PRICE_BANDS: PriceBand[] = [
  { label: '< 10k', min: 0, max: 10000 },
  { label: '10k - 25k', min: 10000, max: 25000 },
  { label: '25k - 50k', min: 25000, max: 50000 },
  { label: '50k+', min: 50000, max: Number.POSITIVE_INFINITY }
];

function formatAmount(value: number | null, currency: string) {
  if (value === null) return '-';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
}

function getBandRate(deals: DealRow[], band: PriceBand) {
  const inBand = deals.filter((deal) => {
    if (deal.amount === null) return false;
    return deal.amount >= band.min && deal.amount < band.max;
  });

  if (inBand.length === 0) {
    return { rate: 0, won: 0, total: 0 };
  }

  const won = inBand.filter((deal) => deal.outcome === 'won').length;
  const rate = Math.round((won / inBand.length) * 100);
  return { rate, won, total: inBand.length };
}

export function DealsWorkbench() {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [deals, setDeals] = useState<DealRow[]>([]);
  const [offerings, setOfferings] = useState<OfferingOption[]>([]);
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'won' | 'lost'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [offeringId, setOfferingId] = useState('');
  const [loadingDeals, setLoadingDeals] = useState(false);

  async function loadDeals(
    overrides?: Partial<{
      outcomeFilter: 'all' | 'won' | 'lost';
      startDate: string;
      endDate: string;
      offeringId: string;
    }>
  ) {
    setLoadingDeals(true);
    setErrorMessage(null);

    try {
      const effectiveOutcome = overrides?.outcomeFilter ?? outcomeFilter;
      const effectiveStartDate = overrides?.startDate ?? startDate;
      const effectiveEndDate = overrides?.endDate ?? endDate;
      const effectiveOfferingId = overrides?.offeringId ?? offeringId;

      const params = new URLSearchParams({
        outcome: effectiveOutcome,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        offeringId: effectiveOfferingId
      });

      const response = await fetch(`/api/deals?${params.toString()}`);
      const body = (await response.json()) as DealsResponse | { error?: string };

      if (!response.ok) {
        throw new Error('error' in body ? body.error : 'Failed to load deals');
      }

      setDeals((body as DealsResponse).deals);
      setOfferings((body as DealsResponse).offerings);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load deals');
    } finally {
      setLoadingDeals(false);
    }
  }

  useEffect(() => {
    void loadDeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function requestPreview() {
    setUploading(true);
    setErrorMessage(null);
    setMessage(null);

    try {
      const response = await fetch('/api/deals/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvText, dryRun: true })
      });
      const body = (await response.json()) as ImportResponse | { error?: string };

      if (!response.ok) {
        throw new Error('error' in body ? body.error : 'Failed to validate CSV');
      }

      const parsed = body as ImportResponse;
      setPreviewRows(parsed.previewRows);
      setRowErrors(parsed.rowErrors);
      setMessage(parsed.message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to validate CSV');
    } finally {
      setUploading(false);
    }
  }

  async function importCsv() {
    setImporting(true);
    setErrorMessage(null);
    setMessage(null);

    try {
      const response = await fetch('/api/deals/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvText, dryRun: false })
      });
      const body = (await response.json()) as ImportResponse | { error?: string };

      if (!response.ok) {
        throw new Error('error' in body ? body.error : 'Failed to import CSV');
      }

      const parsed = body as ImportResponse;
      setPreviewRows(parsed.previewRows);
      setRowErrors(parsed.rowErrors);
      setMessage(`${parsed.message} Imported ${parsed.importedRows} row(s).`);
      await loadDeals();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to import CSV');
    } finally {
      setImporting(false);
    }
  }

  async function onFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
    setPreviewRows([]);
    setRowErrors([]);
    setMessage(null);
    setErrorMessage(null);
  }

  const bandStats = useMemo(
    () =>
      PRICE_BANDS.map((band) => ({
        band,
        ...getBandRate(deals, band)
      })),
    [deals]
  );

  const offeringLabelById = useMemo(
    () =>
      offerings.reduce<Record<string, string>>((acc, offering) => {
        acc[offering.id] = offering.name;
        return acc;
      }, {}),
    [offerings]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">CSV Upload</CardTitle>
          <CardDescription>Upload a deals CSV, review preview rows, and fix row-level errors before import.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="deals-csv">Deals CSV file</Label>
              <Input id="deals-csv" type="file" accept=".csv,text/csv" onChange={onFileSelected} />
              {fileName && <p className="text-xs text-muted-foreground">Selected: {fileName}</p>}
            </div>
            <Button type="button" variant="outline" disabled={!csvText || uploading} onClick={() => void requestPreview()}>
              {uploading ? 'Validating...' : 'Preview CSV'}
            </Button>
            <Button type="button" disabled={!csvText || importing} onClick={() => void importCsv()}>
              {importing ? 'Importing...' : 'Import valid rows'}
            </Button>
          </div>

          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          {message && <p className="text-sm text-green-700">{message}</p>}

          {rowErrors.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-destructive">Row-level errors</p>
              <ul className="mt-2 space-y-1 text-sm text-destructive">
                {rowErrors.slice(0, 8).map((item) => (
                  <li key={`${item.rowNumber}-${item.message}`}>
                    Row {item.rowNumber}: {item.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {previewRows.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Close date</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Currency</th>
                    <th className="px-3 py-2">Outcome</th>
                    <th className="px-3 py-2">Client domain</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 20).map((row) => (
                    <tr key={row.rowNumber} className="border-t">
                      <td className="px-3 py-2">{row.rowNumber}</td>
                      <td className="px-3 py-2">{row.close_date || '-'}</td>
                      <td className="px-3 py-2">{row.amount || '-'}</td>
                      <td className="px-3 py-2">{row.currency || '-'}</td>
                      <td className="px-3 py-2">{row.outcome || '-'}</td>
                      <td className="px-3 py-2">{row.client_domain || '-'}</td>
                      <td className="px-3 py-2">{row.description || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={row.status === 'valid' ? 'text-green-700' : 'text-destructive'}>
                          {row.status === 'valid' ? 'Valid' : row.error || 'Error'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Imported deals</CardTitle>
          <CardDescription>Filter by outcome, date range, and offering after import.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="filter-outcome">Outcome</Label>
              <Select id="filter-outcome" value={outcomeFilter} onChange={(event) => setOutcomeFilter(event.target.value as 'all' | 'won' | 'lost')}>
                <option value="all">All</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-start-date">Start date</Label>
              <Input id="filter-start-date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-end-date">End date</Label>
              <Input id="filter-end-date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-offering">Offering</Label>
              <Select id="filter-offering" value={offeringId} onChange={(event) => setOfferingId(event.target.value)}>
                <option value="">All offerings</option>
                {offerings.map((offering) => (
                  <option key={offering.id} value={offering.id}>
                    {offering.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => void loadDeals()} disabled={loadingDeals}>
              {loadingDeals ? 'Applying...' : 'Apply filters'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOutcomeFilter('all');
                setStartDate('');
                setEndDate('');
                setOfferingId('');
                void loadDeals({ outcomeFilter: 'all', startDate: '', endDate: '', offeringId: '' });
              }}
            >
              Reset
            </Button>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2">Close date</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Outcome</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Offering</th>
                </tr>
              </thead>
              <tbody>
                {deals.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-muted-foreground" colSpan={6}>
                      No deals match the current filters.
                    </td>
                  </tr>
                )}
                {deals.map((deal) => (
                  <tr key={deal.id} className="border-t">
                    <td className="px-3 py-2">{deal.close_date}</td>
                    <td className="px-3 py-2">{deal.client_domain}</td>
                    <td className="px-3 py-2">{deal.description}</td>
                    <td className="px-3 py-2">
                      <span className={deal.outcome === 'won' ? 'text-green-700' : 'text-rose-700'}>{deal.outcome}</span>
                    </td>
                    <td className="px-3 py-2">{formatAmount(deal.amount, deal.currency)}</td>
                    <td className="px-3 py-2">{deal.offering_id ? offeringLabelById[deal.offering_id] || deal.offering_id : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Win-rate by price band</CardTitle>
          <CardDescription>Placeholder chart fed by imported deals. API-driven analytics can replace this panel later.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {bandStats.map((entry) => (
            <div key={entry.band.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{entry.band.label}</span>
                <span className="text-muted-foreground">
                  {entry.won}/{entry.total} won ({entry.rate}%)
                </span>
              </div>
              <div className="h-2 w-full rounded bg-muted">
                <div className="h-2 rounded bg-primary transition-all" style={{ width: `${entry.rate}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
