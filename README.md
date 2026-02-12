# Greek 360

Mobile-optimized web MVP for fraternity and sorority recruitment and membership management.

This repository is implemented phase-by-phase from `spec.md` with strict TDD gates.

## Phase 8 Status

Phase 8 privacy rights, hardening, and launch-readiness work is implemented on top of Phases 0-7:

- Privacy settings experience (`/settings/privacy`) for:
  - user data export generation
  - account deletion request with OTP re-auth
- Privacy domain service with:
  - export payload assembly (profile, interests, decisions, offers, memberships, communications metadata)
  - deletion request lifecycle (`requested`, `processing`, `completed`, `rejected`)
  - super-admin/system deletion processing guardrails
  - invalid re-auth rate limiting
- Access hardening for deleted users via route-guard enforcement.
- Supabase Phase 8 migration pair:
  - `deletion_requests` table
  - secured functions: `request_privacy_export`, `request_account_deletion`, `process_account_deletion`
  - privacy operation audit events
- Phase 8 tests:
  - privacy service integration coverage
  - privacy settings UI integration coverage
  - privacy security regression suite
  - phase 8 E2E privacy flow
  - migration verification coverage for phase 8 pair
- Launch-readiness runbook and checklist:
  - `docs/phase-8-launch-readiness.md`

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
- `supabase/environments/dev.env` (copy from `supabase/environments/dev.env.example`)
- `supabase/environments/prod.env` (copy from `supabase/environments/prod.env.example`)

Create local Supabase environment files once:
```bash
cp supabase/environments/dev.env.example supabase/environments/dev.env
cp supabase/environments/prod.env.example supabase/environments/prod.env
```

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
- `supabase/migrations_down/000001_phase0_core_extensions.down.sql`
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
