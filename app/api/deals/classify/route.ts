import { NextResponse } from 'next/server';
import { z } from 'zod';

const payloadSchema = z.object({
  dealId: z.string().uuid(),
  signals: z.record(z.union([z.string(), z.number(), z.boolean()]))
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const confidence = Math.min(0.99, 0.5 + Object.keys(parsed.data.signals).length * 0.03);

  return NextResponse.json({
    dealId: parsed.data.dealId,
    classification: confidence > 0.72 ? 'high-intent' : 'needs-review',
    confidence: Number(confidence.toFixed(2))
  });
}
