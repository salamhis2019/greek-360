# AGENTS.md

This file is the fast-start guide for any agent working in this repository.

## 1) Project Snapshot

- Project: `greek-360`
- Type: Mobile-optimized web app (React + Vite + TypeScript)
- Product: Recruitment and membership management for fraternities/sororities
- Source of truth: `spec.md` (comprehensive product + technical plan)
- Current date context in spec: February 10, 2026

## 2) Product Goals (MVP)

- Make student interest submission extremely fast (QR/code -> OTP -> interested).
- Make chapter admin triage fast (one-tap stage decisions).
- Preserve strict privacy:
  - Same university can see basic profile fields.
  - Private contact details only for same-chapter members.
- Keep UI minimal, modern, and mobile-first.
- Prevent regressions with strict TDD across all phases.

## 3) Locked Product Decisions

- Fraternity and sorority support from day 1.
- Student can express interest in multiple chapters.
- Two-stage decisions:
  - Stage 1: `Shortlist` / `No`
  - Stage 2: `Final Yes` / `Final No`
- Student must accept offer in-app before membership activation.
- One active membership max per user.
- School/chapter/admin management is invite-only via super-admin.
- Chapter admins cannot manage admins in MVP.
- Search supports person name or organization.
- One static join code per chapter per recruitment cycle.
- Onboarding: phone OTP first, then name entry.
- Avatar upload included in MVP.
- Messaging: acceptance email required, rejection optional.
- User can export and delete data.
- Web-only MVP (no native app).

## 4) Technical Direction

- Frontend: React 19, Vite, TypeScript, Tailwind, React Query, React Router.
- Backend: Supabase (Auth, Postgres, RLS, Storage, Edge Functions).
- Messaging: provider via Edge Functions (Resend or SendGrid adapter pattern).
- Security model: deny-by-default RLS + server-side guarded mutations.

## 5) TDD Is Mandatory

This project uses strict TDD for all work.

Non-negotiable rules:
- Write a failing test first.
- Implement the minimum code to pass.
- Refactor without changing behavior.
- No merge without green CI.
- Every bug fix must include a regression test.
- RLS/security changes must include explicit allow/deny tests.

Coverage targets from spec:
- Domain/permission logic: >= 90%
- Edge/data workflows: >= 85%
- UI critical paths: >= 80%

## 6) Delivery Phases (High Level)

Detailed plan lives in `spec.md` Phase 0 through Phase 8.

- Phase 0: Foundation + CI + test harness
- Phase 1: Auth and onboarding
- Phase 2: Super-admin setup
- Phase 3: Interest capture (QR/code)
- Phase 4: Recruitment decisions
- Phase 5: Offer acceptance + membership activation
- Phase 6: Directory + privacy gating
- Phase 7: Messaging
- Phase 8: Data rights + hardening + launch readiness

Each phase has TDD requirements and explicit exit gates in `spec.md`.

## 7) Repo Status and Working Norms

- This repo started as a React starter; product implementation is guided by `spec.md`.
- Keep scope aligned to spec; do not invent features without user approval.
- Prefer small, test-first PR-sized changes.
- Preserve minimal UI and low-click flows.
- Prioritize mobile behavior in all UX implementations.

## 8) Suggested Working Protocol for Agents

Before coding:
1. Read relevant sections in `spec.md`.
2. Identify the current phase and acceptance criteria.
3. Define tests first (unit/integration/E2E/security as appropriate).

During coding:
1. Commit to Red -> Green -> Refactor loops.
2. Keep permission logic centralized and test-backed.
3. Protect critical workflows with idempotency tests.

Before handoff:
1. Run lint/type/tests.
2. Confirm coverage and required test suites.
3. Verify behavior against locked decisions.
4. Summarize what changed, what was tested, and any risks.

## 9) Useful Commands

- Install dependencies: `npm install`
- Dev server: `npm run dev`
- Lint: `npm run lint`
- Fix lint: `npm run lint:fix`
- Format: `npm run format`
- Type/test baseline: `npm run test:run`
- Coverage: `npm run test:coverage`
- Build: `npm run build`

## 10) If There Is a Conflict

Priority order:
1. Explicit user request in current conversation.
2. `spec.md` (product + architecture + phase gates).
3. Keep MVP minimal and secure.
4. Ask for clarification instead of guessing on product behavior.

