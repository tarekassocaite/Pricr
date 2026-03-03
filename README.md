# Pricr

Next.js 14 App Router + TypeScript project configured with Tailwind CSS, shadcn/ui primitives, and Supabase integration.

## Pages

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

## Run

```bash
npm install
npm run dev
```
