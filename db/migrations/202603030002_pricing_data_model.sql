create extension if not exists "pgcrypto";

create table if not exists public.agency_settings (
  id uuid primary key default gen_random_uuid(),
  monthly_overheads numeric(14,2) not null,
  utilization_pct numeric(5,2) not null,
  target_margin_pct numeric(5,2) not null,
  currency text not null,
  role_costs_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.offerings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit_type text not null check (unit_type in ('fixed', 'retainer')),
  baseline_hours numeric(10,2) not null,
  roles_mix_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deals
  add column if not exists close_date date,
  add column if not exists currency text,
  add column if not exists outcome text check (outcome in ('won', 'lost')),
  add column if not exists description text,
  add column if not exists client_domain text,
  add column if not exists offering_id uuid references public.offerings(id) on delete set null;

alter table public.deals
  alter column amount type numeric(14,2) using amount::numeric(14,2),
  alter column amount drop not null;

alter table public.deals
  drop column if exists client_id,
  drop column if exists name,
  drop column if exists stage,
  drop column if exists confidence_score,
  drop column if exists metadata,
  drop column if exists updated_at;

alter table public.deals
  alter column close_date set not null,
  alter column currency set not null,
  alter column outcome set not null,
  alter column description set not null,
  alter column client_domain set not null;

create table if not exists public.client_profiles (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  company_name text,
  status text not null default 'pending' check (status in ('pending', 'ready')),
  clay_signals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.model_runs (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.offerings(id) on delete cascade,
  client_domain text not null,
  inputs jsonb not null default '{}'::jsonb,
  outputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.documents
  add column if not exists client_domain text,
  add column if not exists offering_id uuid references public.offerings(id) on delete set null,
  add column if not exists package_name text,
  add column if not exists type text check (type in ('proposal', 'sow')),
  add column if not exists markdown text,
  add column if not exists pdf_url text;

alter table public.documents
  drop column if exists deal_id,
  drop column if exists kind,
  drop column if exists content,
  drop column if exists status;

alter table public.documents
  alter column client_domain set not null,
  alter column offering_id set not null,
  alter column package_name set not null,
  alter column type set not null,
  alter column markdown set not null;

create index if not exists deals_outcome_idx on public.deals(outcome);
create index if not exists deals_close_date_idx on public.deals(close_date);
create index if not exists deals_offering_id_idx on public.deals(offering_id);
create index if not exists client_profiles_domain_idx on public.client_profiles(domain);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_agency_settings_updated_at on public.agency_settings;
create trigger trg_agency_settings_updated_at
before update on public.agency_settings
for each row execute function public.touch_updated_at();

drop trigger if exists trg_offerings_updated_at on public.offerings;
create trigger trg_offerings_updated_at
before update on public.offerings
for each row execute function public.touch_updated_at();

drop trigger if exists trg_client_profiles_updated_at on public.client_profiles;
create trigger trg_client_profiles_updated_at
before update on public.client_profiles
for each row execute function public.touch_updated_at();
