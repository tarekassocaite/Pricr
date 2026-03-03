'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

interface SeedData {
  client_domain: string;
  offering_id: string;
  offering_name: string;
  package_name: 'Essential' | 'Standard' | 'Premium';
  timeline_weeks: number;
  total_price: number;
  assumptions: string[];
  exclusions: string[];
}

interface GeneratedDocument {
  id: string;
  type: 'proposal' | 'sow';
  markdown: string;
  created_at: string;
}

export function DocumentsWorkbench() {
  const [seed, setSeed] = useState<SeedData | null>(null);
  const [docType, setDocType] = useState<'proposal' | 'sow'>('proposal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedDocument | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem('pricr_selected_package');
    if (!raw) return;
    try {
      setSeed(JSON.parse(raw) as SeedData);
    } catch {
      setSeed(null);
    }
  }, []);

  async function generateDocument() {
    if (!seed) {
      setError('Run pricing on Dashboard and click "Use in documents" first.');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...seed,
          type: docType
        })
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        markdown?: string;
        document?: GeneratedDocument;
      };
      if (!response.ok) throw new Error(payload.error ?? 'Failed to generate document');
      if (payload.document) setGenerated(payload.document);
      setMessage(payload.message ?? 'Document generated.');
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Failed to generate document');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Generate proposal / SOW</CardTitle>
          <CardDescription>
            PDF export can be added later. Markdown preview is the reliable demo fallback.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!seed ? (
            <p className="text-sm text-muted-foreground">
              No package selected yet. Go to Dashboard, run pricing, and click Use in documents.
            </p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="doc-client">Client</Label>
                  <Input id="doc-client" value={seed.client_domain} readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doc-offering">Offering</Label>
                  <Input id="doc-offering" value={seed.offering_name} readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doc-package">Package</Label>
                  <Input id="doc-package" value={seed.package_name} readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doc-type">Document type</Label>
                  <Select id="doc-type" value={docType} onChange={(event) => setDocType(event.target.value as 'proposal' | 'sow')}>
                    <option value="proposal">Proposal</option>
                    <option value="sow">SOW</option>
                  </Select>
                </div>
              </div>
              <Button type="button" onClick={() => void generateDocument()} disabled={loading}>
                {loading ? 'Generating...' : 'Generate document'}
              </Button>
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {message && <p className="text-sm text-green-700">{message}</p>}
          <p className="text-xs text-muted-foreground">Not legal advice. Review required.</p>
        </CardContent>
      </Card>

      {generated && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Markdown preview</CardTitle>
            <CardDescription>{generated.type.toUpperCase()} generated and saved.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/20 p-4 text-sm">
              {generated.markdown}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
