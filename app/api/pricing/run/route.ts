import { NextResponse } from 'next/server';
import { z } from 'zod';

const payloadSchema = z.object({
  dealId: z.string().uuid(),
  basePrice: z.number().positive(),
  discountCap: z.number().min(0).max(100).default(20)
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const recommendedDiscount = Math.min(parsed.data.discountCap, 12);
  const suggestedPrice = parsed.data.basePrice * (1 - recommendedDiscount / 100);

  return NextResponse.json({
    dealId: parsed.data.dealId,
    recommendedDiscount,
    suggestedPrice: Number(suggestedPrice.toFixed(2))
  });
}
