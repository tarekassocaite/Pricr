import { NextResponse } from 'next/server';

import { summarizeDealsByPriceBuckets } from '@/lib/deals/summary';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from('deals').select('amount, outcome');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const summary = summarizeDealsByPriceBuckets(data ?? []);
  return NextResponse.json(summary);
}
