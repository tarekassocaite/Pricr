import { NextResponse } from 'next/server';
import { z } from 'zod';

const clayEnrichmentSchema = z.object({
  clientId: z.string().uuid(),
  source: z.literal('clay-mcp'),
  properties: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]))
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = clayEnrichmentSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json({
    clientId: parsed.data.clientId,
    ingestedProperties: Object.keys(parsed.data.properties).length,
    message: 'Enrichment payload accepted.'
  });
}
