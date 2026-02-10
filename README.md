# Greek 360

Mobile-optimized web MVP for fraternity and sorority recruitment and membership management.

This repository is implemented phase-by-phase from `spec.md` with strict TDD gates.

## Phase 0 Status

Phase 0 foundation is scaffolded:
- React app shell with provider architecture.
- Route skeletons for public, student, chapter-admin, and super-admin zones.
- Environment separation (`dev`, `prod`).
- Supabase migration framework with up/down verification.
- Vitest + Testing Library + Playwright baselines.
- CI split into fast checks and full checks.

## Prerequisites

- Node `22.12.0`
- npm `>=10`

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure frontend environment:
```bash
cp .env.example .env.local
```

3. Fill environment values in:
- `.env.local` for local app runtime.
- `supabase/environments/dev.env`
- `supabase/environments/prod.env`

## Local Development

Start the app:
```bash
npm run dev
```

Run fast local checks:
```bash
npm run lint
npm run typecheck
npm run test:ci
```

Run full local checks:
```bash
npm run migration:verify
npm run test:coverage
npm run build
npm run test:e2e
npm run test:security
```

## Supabase Baseline

Phase 0 includes:
- `supabase/config.toml` with phone OTP auth baseline.
- `supabase/migrations/000001_phase0_core_extensions.up.sql`
- `supabase/migrations/000001_phase0_core_extensions.down.sql`
- `supabase/seeds/test_seed.sql`

Migration rollback verification:
```bash
MIGRATION_VERIFY_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/greek360_verify npm run migration:verify
```

## CI

GitHub Actions workflows:
- `.github/workflows/ci.yml`
  - `fast-checks`: lint, typecheck, fail-fast unit/integration tests.
  - `full-checks`: migration rollback verification, seed, coverage, build, e2e, security.
- `.github/workflows/nightly-full.yml`
  - Nightly full E2E + security run.

## TDD Workflow

PRs must include explicit Red -> Green -> Refactor evidence.

Reference:
- `docs/tdd-workflow.md`
- `.github/pull_request_template.md`
