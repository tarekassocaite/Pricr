'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ClientProfile {
  id: string;
  domain: string;
  company_name: string | null;
  status: 'pending' | 'ready';
  clay_signals: Record<string, unknown> | null;
  updated_at: string;
}

const MOCK_ENRICHMENT = {
  employees: 185,
  region: 'UK',
  funding_stage: 'Series A',
  industry: 'B2B SaaS',
  growth_signal: 'Hiring in GTM roles'
};

export function ClientsWorkbench() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [domain, setDomain] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jsonDomain, setJsonDomain] = useState('');
  const [jsonCompanyName, setJsonCompanyName] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [savingPending, setSavingPending] = useState(false);
  const [savingEnrichment, setSavingEnrichment] = useState(false);
  const [origin, setOrigin] = useState('');

  async function loadClients() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/clients');
      const payload = (await response.json()) as { clients?: ClientProfile[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Failed to load client profiles');
      setClients(payload.clients ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load client profiles');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadClients();
    setOrigin(window.location.origin);
  }, []);

  async function createPendingClient() {
    setSavingPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          company_name: companyName || undefined
        })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Failed to create pending profile');
      setMessage('Pending client profile created.');
      setDomain('');
      setCompanyName('');
      await loadClients();
    } catch (pendingError) {
      setError(pendingError instanceof Error ? pendingError.message : 'Failed to create pending profile');
    } finally {
      setSavingPending(false);
    }
  }

  async function submitEnrichment(parsedSignals: Record<string, unknown>) {
    setSavingEnrichment(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/clients/enrichment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: jsonDomain,
          company_name: jsonCompanyName || undefined,
          clay_signals: parsedSignals
        })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Failed to save enrichment');
      setMessage('Enrichment saved and client marked ready.');
      setJsonDomain('');
      setJsonCompanyName('');
      setJsonText('');
      await loadClients();
    } catch (enrichmentError) {
      setError(enrichmentError instanceof Error ? enrichmentError.message : 'Failed to save enrichment');
    } finally {
      setSavingEnrichment(false);
    }
  }

  async function saveFromJson() {
    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      await submitEnrichment(parsed);
    } catch {
      setError('Invalid JSON. Please paste a valid object.');
    }
  }

  async function copyMcpRunbook() {
    const runbook = `Use Clay MCP to enrich these pending client domains:\n${pendingDomains.join('\n')}\n\nFor each domain, POST to ${origin}/api/clients/enrichment with JSON:\n{\n  "domain": "<domain>",\n  "company_name": "<optional>",\n  "clay_signals": {\n    "employees": <number>,\n    "region": "<string>",\n    "funding_stage": "<string>",\n    "industry": "<string>",\n    "growth_signal": "<string>"\n  },\n  "raw": {}\n}`;
    try {
      await navigator.clipboard.writeText(runbook);
      setMessage('Clay MCP runbook copied to clipboard.');
      setError(null);
    } catch {
      setError('Unable to copy to clipboard. Copy the runbook text manually.');
    }
  }

  const pendingDomains = useMemo(
    () =>
      clients
        .filter((client) => client.status === 'pending')
        .map((client) => client.domain)
        .sort((a, b) => a.localeCompare(b)),
    [clients]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Clay MCP enrichment queue</CardTitle>
          <CardDescription>Pending domains are ready for Clay MCP enrichment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingDomains.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending domains. Import deals or add a client domain first.</p>
          ) : (
            <>
              <p className="text-sm">
                Pending domains: <span className="font-medium">{pendingDomains.length}</span>
              </p>
              <div className="max-h-36 overflow-auto rounded-md border bg-muted/20 p-3 text-sm">
                {pendingDomains.map((item) => (
                  <div key={item}>{item}</div>
                ))}
              </div>
              <Button type="button" variant="outline" onClick={() => void copyMcpRunbook()}>
                Copy Clay MCP runbook
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Client profile setup</CardTitle>
          <CardDescription>Enter a domain to create a pending profile before enrichment.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-2">
            <Label htmlFor="client-domain">Domain</Label>
            <Input id="client-domain" placeholder="acme.com" value={domain} onChange={(event) => setDomain(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-company">Company name (optional)</Label>
            <Input
              id="client-company"
              placeholder="Acme Inc"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button type="button" disabled={!domain || savingPending} onClick={() => void createPendingClient()}>
              {savingPending ? 'Saving...' : 'Create pending'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Paste enrichment JSON (dev fallback)</CardTitle>
          <CardDescription>Use this in demos if Clay MCP is unavailable.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="json-domain">Domain</Label>
              <Input id="json-domain" value={jsonDomain} onChange={(event) => setJsonDomain(event.target.value)} placeholder="acme.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="json-company">Company name (optional)</Label>
              <Input
                id="json-company"
                value={jsonCompanyName}
                onChange={(event) => setJsonCompanyName(event.target.value)}
                placeholder="Acme Inc"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="json-enrichment">Enrichment JSON</Label>
            <textarea
              id="json-enrichment"
              className="min-h-[160px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={jsonText}
              onChange={(event) => setJsonText(event.target.value)}
              placeholder='{"employees":180,"region":"UK","industry":"SaaS"}'
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setJsonText(JSON.stringify(MOCK_ENRICHMENT, null, 2))}>
              Use mock enrichment
            </Button>
            <Button type="button" disabled={!jsonDomain || !jsonText || savingEnrichment} onClick={() => void saveFromJson()}>
              {savingEnrichment ? 'Saving...' : 'Save enrichment'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Client profiles</CardTitle>
          <CardDescription>Profiles enriched by Clay MCP or JSON fallback.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading profiles...</p>
          ) : clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No client profiles yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[780px] text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">Domain</th>
                    <th className="px-3 py-2">Company</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Signals</th>
                    <th className="px-3 py-2">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} className="border-t">
                      <td className="px-3 py-2">{client.domain}</td>
                      <td className="px-3 py-2">{client.company_name || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={client.status === 'ready' ? 'text-green-700' : 'text-amber-700'}>{client.status}</span>
                      </td>
                      <td className="px-3 py-2">{Object.keys(client.clay_signals ?? {}).length}</td>
                      <td className="px-3 py-2">{new Date(client.updated_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
