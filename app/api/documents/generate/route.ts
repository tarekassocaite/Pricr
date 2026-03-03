import { NextResponse } from 'next/server';
import { z } from 'zod';

const payloadSchema = z.object({
  dealId: z.string().uuid(),
  kind: z.enum(['proposal', 'pricing_summary', 'renewal_brief']),
  highlights: z.array(z.string()).default([])
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const content = `# ${parsed.data.kind}\n\nDeal: ${parsed.data.dealId}\n\n${parsed.data.highlights
    .map((highlight, idx) => `${idx + 1}. ${highlight}`)
    .join('\n')}`;

  return NextResponse.json({
    dealId: parsed.data.dealId,
    kind: parsed.data.kind,
    content,
    status: 'draft'
  });
}
