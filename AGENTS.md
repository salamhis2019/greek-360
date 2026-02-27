# AGENTS.md

This file is the fast-start guide for any agent working in this repository.

## 1) Project Snapshot

- Project: `greek-360`
- Type: Mobile-optimized web app (React + Vite + TypeScript)
- Product: Recruitment and membership management for fraternities/sororities

## 2) Product Goals (MVP)

- Make pledge interest submission extremely fast (QR/code -> OTP -> interested).
- Make frat/sorority admin triage fast (one-tap stage decisions).
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

## 9) Useful Commands

- Install dependencies: `npm install`
- Dev server: `npm run dev`
- Lint: `npm run lint`
- Fix lint: `npm run lint:fix`
- Format: `npm run format`
- Type/test baseline: `npm run test:run`
- Coverage: `npm run test:coverage`
- Build: `npm run build`

