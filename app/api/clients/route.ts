import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSupabaseServerClient } from '@/lib/supabase/server';

const createClientSchema = z.object({
  domain: z.string().trim().min(1),
  company_name: z.string().trim().optional()
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get('status');
    const status = statusParam === 'pending' || statusParam === 'ready' ? statusParam : null;

    const supabase = getSupabaseServerClient();
    let query = supabase.from('client_profiles').select('*').order('updated_at', { ascending: false });
    if (status) {
      query = query.eq('status', status);
    }
    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ clients: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load client profiles' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = createClientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('client_profiles')
      // Supabase generated types in this repo currently infer never for upsert values.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error Pending generated type fix.
      .upsert(
        {
          domain: parsed.data.domain.toLowerCase(),
          company_name: parsed.data.company_name ?? null,
          status: 'pending'
        },
        { onConflict: 'domain' }
      )
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ client: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create pending client profile' },
      { status: 500 }
    );
  }
}
