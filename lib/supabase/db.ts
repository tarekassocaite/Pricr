import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { TableInsert, TableRow } from '@/types/supabase';

export async function getLatestAgencySettings() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('agency_settings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listDealsByOutcome(outcome: TableRow<'deals'>['outcome']) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('outcome', outcome)
    .order('close_date', { ascending: false });

  if (error) throw error;
  return data;
}

export async function upsertClientProfile(profile: TableInsert<'client_profiles'>) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('client_profiles')
    // Supabase generated types in this repo currently infer never for upsert values.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error Pending generated type fix.
    .upsert(profile, { onConflict: 'domain' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function createModelRun(input: TableInsert<'model_runs'>) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('model_runs')
    // Supabase generated types in this repo currently infer never for insert values.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error Pending generated type fix.
    .insert(input)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
