# Pricr

Next.js 14 App Router + TypeScript project configured with Tailwind CSS, shadcn/ui primitives, and Supabase integration.

## Pages (demo flow)

- `/onboarding`
- `/deals`
- `/clients`
- `/dashboard`
- `/documents`

## API Routes

- `POST /api/deals/import-csv`
- `POST /api/deals/classify`
- `POST /api/pricing/run`
- `POST /api/clients/enrichment`
- `POST /api/documents/generate`

## Supabase

- SQL migrations: `db/migrations`
- Generated DB types: `types/supabase.ts`
- Typed DB helper queries: `lib/supabase/db.ts`
- Core tables in the latest migration:
  - `agency_settings`
  - `offerings`
  - `deals`
  - `client_profiles`
  - `model_runs`
  - `documents`

## Local setup

```bash
npm install
npm run typecheck
npm run lint
npm run build
npm run dev
```

1. Copy `.env.example` to `.env.local`.
2. Fill Supabase credentials (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, plus public keys).
3. Run SQL migrations in `db/migrations` against your Supabase Postgres.

## Happy-path demo script

1. Go to `/onboarding` and save agency settings + offerings.
2. Go to `/deals`, upload `sample-data/deals.csv`, preview, then import.
3. Go to `/clients`, create a pending profile, then use **Paste enrichment JSON** or **Use mock enrichment**.
4. Go to `/dashboard`, run pricing, inspect explainability, and click **Use in documents** on a package.
5. Go to `/documents`, generate Proposal or SOW and review markdown preview.

## Notes

- Pricing output is deterministic. LLM features are optional.
- SOW disclaimer: **Not legal advice. Review required.**
- Model disclaimer: **Pricing guidance based on your inputs and historical patterns.**
