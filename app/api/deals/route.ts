import { NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import { dealsFilterSchema } from '@/lib/validation/deals';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = dealsFilterSchema.safeParse({
    outcome: searchParams.get('outcome') ?? undefined,
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
    offeringId: searchParams.get('offeringId') ?? undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  let query = supabase.from('deals').select('*').order('close_date', { ascending: false });

  if (parsed.data.outcome !== 'all') {
    query = query.eq('outcome', parsed.data.outcome);
  }

  if (parsed.data.startDate) {
    query = query.gte('close_date', parsed.data.startDate);
  }

  if (parsed.data.endDate) {
    query = query.lte('close_date', parsed.data.endDate);
  }

  if (parsed.data.offeringId) {
    query = query.eq('offering_id', parsed.data.offeringId);
  }

  const [{ data: deals, error: dealsError }, { data: offerings, error: offeringsError }] = await Promise.all([
    query,
    supabase.from('offerings').select('id, name').order('name', { ascending: true })
  ]);

  if (dealsError) {
    return NextResponse.json({ error: dealsError.message }, { status: 500 });
  }

  if (offeringsError) {
    return NextResponse.json({ error: offeringsError.message }, { status: 500 });
  }

  return NextResponse.json({
    deals,
    offerings
  });
}
