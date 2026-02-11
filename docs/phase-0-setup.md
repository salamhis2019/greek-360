# Phase 0 Setup Runbook

This runbook covers environment scaffolding required by Phase 0.

## 1. Supabase Environments

Create Supabase projects:
- `greek360-dev`
- `greek360-prod`

Populate:
- `supabase/environments/dev.env`
- `supabase/environments/prod.env`

with each project's `URL`, `publishable key`, `secret key`, and project ref.

## 2. Phone OTP Auth Baseline

For each Supabase project, verify:
- Phone provider is enabled.
- OTP template is configured.
- Rate limit baseline is set.
- Site URL and redirect URLs match frontend environments.

Local baseline config is captured in `supabase/config.toml`.

## 3. Migration Framework

Phase 0 migration pair:
- `supabase/migrations/000001_phase0_core_extensions.up.sql`
- `supabase/migrations/000001_phase0_core_extensions.down.sql`

Verification command:
```bash
MIGRATION_VERIFY_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/greek360_verify npm run migration:verify
```

## 4. Seeded Test DB Strategy

Baseline seed:
- `supabase/seeds/test_seed.sql`

Seed command:
```bash
MIGRATION_VERIFY_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/greek360_verify npm run db:seed:test
```

## 5. CI Gates

- Fast checks: lint + typecheck + fail-fast Vitest.
- Full checks: migration verify, seed, coverage, build, Playwright, security tests.
- Nightly: full E2E + security.
