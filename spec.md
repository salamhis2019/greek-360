# Greek 360 MVP Product and Technical Specification

Last updated: February 10, 2026  
Status: Approved for implementation  
Product type: Mobile-optimized web app (React frontend + BaaS backend)

## 1. Product Vision

Greek 360 is a minimal, modern web application that makes fraternity and sorority recruitment fast for students and operationally simple for chapter admins.

Primary outcomes:
- Students can express interest in chapters in seconds.
- Chapter admins can process interest lists quickly with minimal clicks.
- Accepted users can join in-app and become visible in the chapter directory.
- Directory access is campus-wide for basic profiles and chapter-restricted for private details.

Design principles:
- Minimal UI.
- Fewest possible taps.
- Mobile-first layouts and actions.
- Clear, safe permission boundaries.
- No unnecessary setup friction.

## 2. MVP Scope

In scope:
- Fraternity and sorority support from day one.
- Phone OTP authentication.
- First-login name capture.
- Interest submission via QR code or join code.
- Recruitment workflow with two decision stages:
  - Stage 1: `Shortlist` or `No`
  - Stage 2: `Final Yes` or `Final No`
- In-app offer acceptance by student.
- Optional outbound email for acceptance and rejection.
- Campus directory:
  - Basic profile visibility across same university.
  - Private contact visibility only within same chapter.
- Super-admin panel for manually creating schools and chapters.
- Super-admin-only assignment/removal of chapter admins.
- User data export and delete requests.
- Web-only delivery (no native app in MVP).

Out of scope:
- Council-level roles and workflows (IFC/Panhellenic).
- Voting/consensus decision logic.
- Native iOS/Android apps.
- Complex event scheduling, interview rounds, or scoring formulas.
- Payments/subscriptions billing system.

## 3. Locked Decisions

| Topic | Decision |
|---|---|
| Organization types | Both fraternities and sororities supported in MVP |
| Multi-interest | Student can express interest in multiple chapters |
| Decision model | Two stages: shortlist/no, then final yes/no |
| Membership count | One active membership max per user |
| Offer acceptance | Student must accept in-app to become member |
| Chapter/school creation | Invite-only via super-admin panel |
| Admin management | Super-admin only (chapter admins cannot manage admins) |
| Directory search | Search by person name or organization |
| Join code strategy | One static code per chapter per recruitment cycle |
| Profile setup | Phone auth first, then name; avatar upload included |
| Messaging | Acceptance email required, rejection email optional |
| Data rights | User can export and delete their data |
| Platform | Mobile-optimized web app only |

## 4. User Roles

- `Visitor`: not authenticated.
- `Student`: authenticated user with campus profile.
- `Chapter Admin`: student with admin permissions for one chapter.
- `Super Admin`: platform operator with global control.

## 5. User Experience Requirements

### 5.1 UX quality bar

- Clear visual hierarchy with one primary action per screen.
- No hidden critical actions.
- Touch-friendly interaction zones (thumb-reachable).
- Fast transitions and immediate feedback.
- Keyboard support for desktop admin speed.

### 5.2 Click/tap budget targets

- New student from first load to interest submitted: <= 8 taps total including OTP input.
- Returning authenticated student submitting new interest: <= 2 taps.
- Chapter admin shortlist/no action: 1 tap per candidate.
- Chapter admin final yes/no action: 1 tap per candidate.
- Student offer acceptance: <= 2 taps.

### 5.3 Mobile-first constraints

- Vertical card stacks first, table layouts second.
- Sticky bottom action bar for primary actions.
- Avoid deep navigation trees.
- Avoid modal chains; prefer dedicated full-screen steps.

## 6. Core User Journeys

### 6.1 Student onboarding and first interest

1. Student opens QR/deep link (`/join/:code`) or enters code manually.
2. If not authenticated: enter phone number.
3. Receive OTP and verify.
4. First-time only: enter display name.
5. Confirm university if not inferred.
6. Tap `I’m interested`.
7. Show success state with next-step expectations.

### 6.2 Student interest in multiple chapters

1. Student repeats join link flow for additional chapter(s).
2. System creates separate interest records per chapter/cycle.
3. Existing records are idempotent (no duplicates for same user/chapter/cycle).

### 6.3 Chapter admin review (stage 1)

1. Admin opens recruitment cycle queue.
2. Candidate cards show minimal profile and activity.
3. Admin chooses `Shortlist` or `No`.
4. Candidate leaves stage 1 queue immediately.

### 6.4 Chapter admin final decisions (stage 2)

1. Admin opens shortlist board.
2. Admin chooses `Final Yes` or `Final No`.
3. `Final Yes` creates pending offer.
4. Optional email send list can target decision groups.

### 6.5 Student offer response

1. Student sees in-app offer card.
2. Student selects `Accept` or `Decline`.
3. `Accept` creates active membership and closes other pending offers.
4. `Decline` marks offer declined and keeps student non-member.

### 6.6 Directory experience

1. User views campus people list (same university).
2. Can filter/search by person name or organization.
3. Detailed phone/email only appears for same-chapter members.

## 7. Information Architecture

Public routes:
- `/` landing.
- `/auth` phone + OTP flow.
- `/join/:code` QR entry.
- `/code` manual code entry fallback.

Authenticated student routes:
- `/home`
- `/offers`
- `/directory`
- `/profile`
- `/settings/privacy`

Chapter admin routes:
- `/admin/recruitment/:orgId/:cycleId/stage-1`
- `/admin/recruitment/:orgId/:cycleId/stage-2`
- `/admin/recruitment/:orgId/:cycleId/messages`
- `/admin/members/:orgId`

Super-admin routes:
- `/super/universities`
- `/super/organizations`
- `/super/admins`
- `/super/cycles`

## 8. Technical Architecture

### 8.1 Stack

Frontend:
- React 19
- TypeScript
- React Router
- React Query
- Tailwind CSS

Backend:
- Supabase Auth (phone OTP)
- Supabase Postgres
- Supabase Storage (avatars)
- Supabase Edge Functions (secure business logic, email dispatch)
- Supabase Row Level Security policies

Email:
- Resend (recommended) or SendGrid via Edge Function provider adapter.

Hosting:
- Vercel or Netlify for frontend.
- Supabase managed project for backend.

### 8.2 Why Supabase for this product

This product depends on relational permission logic:
- Same university vs same chapter visibility.
- Multi-stage recruitment records tied to users, cycles, and chapters.
- Super-admin-only lifecycle management.

Postgres + RLS is a clean fit for enforcing these rules server-side without duplicating access logic across client code.

## 9. Data Model

### 9.1 Tables

`users`
- `id uuid pk` (maps to auth user)
- `phone_e164 text unique not null`
- `name text not null`
- `email text null`
- `avatar_path text null`
- `university_id uuid not null`
- `created_at timestamptz not null default now()`
- `deleted_at timestamptz null`

`universities`
- `id uuid pk`
- `name text unique not null`
- `slug text unique not null`
- `status text not null check in ('active','inactive')`
- `created_at timestamptz`

`organizations`
- `id uuid pk`
- `university_id uuid not null`
- `name text not null`
- `slug text not null`
- `type text not null check in ('fraternity','sorority')`
- `status text not null check in ('active','inactive')`
- `created_at timestamptz`
- unique `(university_id, slug)`

`organization_admins`
- `organization_id uuid not null`
- `user_id uuid not null`
- `created_at timestamptz`
- primary key `(organization_id, user_id)`

`recruitment_cycles`
- `id uuid pk`
- `organization_id uuid not null`
- `term text not null` (e.g. spring/fall)
- `year int not null`
- `status text not null check in ('draft','active','closed')`
- `starts_at timestamptz null`
- `ends_at timestamptz null`
- unique `(organization_id, term, year)`

`join_links`
- `id uuid pk`
- `organization_id uuid not null`
- `cycle_id uuid not null`
- `code text unique not null`
- `is_active boolean not null default true`
- `created_at timestamptz`
- unique `(organization_id, cycle_id)` for static per-cycle link

`interest_entries`
- `id uuid pk`
- `user_id uuid not null`
- `organization_id uuid not null`
- `cycle_id uuid not null`
- `source text not null check in ('qr','manual_code')`
- `created_at timestamptz`
- unique `(user_id, organization_id, cycle_id)` to prevent duplicates

`recruitment_decisions`
- `id uuid pk`
- `interest_entry_id uuid not null`
- `stage text not null check in ('shortlist','final')`
- `decision text not null check in ('yes','no')`
- `decided_by uuid not null`
- `notes text null`
- `decided_at timestamptz not null default now()`
- unique `(interest_entry_id, stage)`

`offers`
- `id uuid pk`
- `interest_entry_id uuid not null unique`
- `status text not null check in ('pending','accepted','declined','expired')`
- `offered_at timestamptz not null`
- `responded_at timestamptz null`

`memberships`
- `id uuid pk`
- `user_id uuid not null`
- `organization_id uuid not null`
- `status text not null check in ('active','inactive')`
- `joined_at timestamptz not null`
- `ended_at timestamptz null`
- partial unique index on `(user_id)` where `status = 'active'`

`email_templates`
- `id uuid pk`
- `organization_id uuid not null`
- `name text not null`
- `subject text not null`
- `body_html text not null`
- `body_text text not null`
- `type text not null check in ('acceptance','rejection')`
- `created_by uuid not null`
- `created_at timestamptz`

`email_jobs`
- `id uuid pk`
- `organization_id uuid not null`
- `cycle_id uuid not null`
- `kind text not null check in ('acceptance','rejection')`
- `template_id uuid null`
- `custom_subject text null`
- `custom_body_html text null`
- `recipient_count int not null`
- `sent_by uuid not null`
- `sent_at timestamptz not null default now()`

`audit_logs`
- `id uuid pk`
- `actor_user_id uuid null`
- `organization_id uuid null`
- `action text not null`
- `entity_type text not null`
- `entity_id uuid null`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

`deletion_requests`
- `id uuid pk`
- `user_id uuid not null unique`
- `status text not null check in ('requested','processing','completed','rejected')`
- `requested_at timestamptz not null`
- `completed_at timestamptz null`

### 9.2 Relationship summary

- User belongs to one university.
- Organization belongs to one university.
- User can create many interest entries across many organizations.
- Interest entry has one stage-1 decision and one stage-2 decision max.
- Final yes may create one offer.
- Offer accepted creates one active membership.
- One user can have at most one active membership.

### 9.3 Required indexes

- `users(university_id, name)`
- `organizations(university_id, name)`
- `interest_entries(organization_id, cycle_id, created_at desc)`
- `interest_entries(user_id, created_at desc)`
- `recruitment_decisions(interest_entry_id, stage)`
- `memberships(organization_id, status)`
- `memberships(user_id, status)`

## 10. Authorization and Privacy Model (RLS)

All application tables use RLS with deny-by-default behavior.

### 10.1 Visibility rules

- Same-university users can view:
  - `name`
  - `avatar`
  - organization memberships (basic)
- Same-organization members can additionally view:
  - `phone`
  - `email`
- Recruitment decisions are visible only to admins of that organization and super-admin.

### 10.2 Permission matrix

| Actor | Resource | Read | Write |
|---|---|---|---|
| Student | Own profile | Yes | Yes |
| Student | Other same-university profile basic fields | Yes | No |
| Student | Other same-university phone/email | No unless same organization | No |
| Student | Interest entries | Own only | Create own |
| Student | Offer | Own only | Respond accept/decline own |
| Chapter Admin | Interest entries for own org | Yes | No direct row edits |
| Chapter Admin | Recruitment decisions for own org | Yes | Yes via secured function |
| Chapter Admin | Email templates for own org | Yes | Yes |
| Chapter Admin | Memberships for own org | Yes | No direct create |
| Super Admin | Universities/orgs/admin assignments | Yes | Yes |
| Super Admin | All records | Yes | Yes |

### 10.3 Policy strategy

- Keep high-risk writes in Edge Functions rather than direct table writes from client.
- Use database functions with `security definer` where needed, constrained by explicit runtime checks.
- Store private profile fields in `users` but expose redacted views for general directory queries.

## 11. Recruitment State Machines

### 11.1 Candidate pipeline state

Derived state per `interest_entry`:
- `new` (no decisions yet)
- `stage1_shortlisted` (`shortlist = yes`)
- `stage1_rejected` (`shortlist = no`)
- `stage2_accepted_pending` (`final = yes` + offer pending)
- `stage2_rejected` (`final = no`)
- `member_active` (offer accepted + membership active)
- `offer_declined` (offer declined)

### 11.2 Allowed transitions

- `new -> stage1_shortlisted`
- `new -> stage1_rejected`
- `stage1_shortlisted -> stage2_accepted_pending`
- `stage1_shortlisted -> stage2_rejected`
- `stage2_accepted_pending -> member_active`
- `stage2_accepted_pending -> offer_declined`

No backward transitions in MVP.

## 12. API and Edge Function Contracts

Primary model: client uses Supabase directly for safe reads + restricted inserts; critical mutations run through Edge Functions.

### 12.1 Public/auth endpoints

- `POST /fn/start-phone-auth`  
  Starts OTP challenge.

- `POST /fn/verify-phone-auth`  
  Verifies OTP and returns session.

- `POST /fn/upsert-profile`  
  Creates/updates name and optional email after auth.

### 12.2 Recruitment endpoints

- `POST /fn/submit-interest`
  - Input: `join_code`
  - Behavior: resolve active link -> create idempotent interest entry.

- `POST /fn/recruitment/stage1-decision`
  - Input: `interest_entry_id`, `decision (yes|no)`
  - Guard: org admin only for matching org.

- `POST /fn/recruitment/stage2-decision`
  - Input: `interest_entry_id`, `decision (yes|no)`
  - Behavior: if yes, create pending offer.

- `POST /fn/offers/respond`
  - Input: `offer_id`, `response (accept|decline)`
  - Behavior:
    - Accept: create active membership if no existing active membership.
    - Decline: mark offer declined.

### 12.3 Messaging endpoints

- `POST /fn/messages/send`
  - Input: organization, cycle, kind (`acceptance|rejection`), template/custom payload, recipient filter.
  - Guard: org admin or super-admin.
  - Output: email job result and delivery stats.

### 12.4 Data rights endpoints

- `POST /fn/privacy/export`
  - Generates downloadable user data package.

- `POST /fn/privacy/delete-request`
  - Creates deletion request after OTP re-check.

- `POST /fn/privacy/delete-process` (super-admin/system only)
  - Executes deletion/anonymization workflow.

## 13. Email System

### 13.1 Template model

- Chapter admins can create:
  - Acceptance template(s).
  - Optional rejection template(s).
- Send flow supports either:
  - Existing template.
  - One-off custom subject/body.

### 13.2 Recipient targeting

MVP recipient groups:
- `final_yes_pending_offer`
- `final_no`
- `offer_accepted`
- `offer_declined`

### 13.3 Delivery requirements

- Retry strategy for transient failures.
- Record send outcome in `email_jobs`.
- Log failures to `audit_logs`.
- Avoid duplicate sends by message hash + audience scope.

## 14. Admin Panel Requirements

### 14.1 Super-admin panel

Capabilities:
- Create and activate universities.
- Create organizations under universities.
- Create recruitment cycles.
- Generate static join code per org/cycle.
- Assign/remove organization admins by user identity.

Constraints:
- Only super-admin can grant/revoke admin roles in MVP.
- No self-serve chapter creation.

### 14.2 Chapter admin panel

Capabilities:
- View recruitment queues.
- Make stage 1 and stage 2 decisions.
- View offer statuses.
- Send acceptance/rejection communications.
- View current chapter membership directory.

## 15. Data Export and Deletion

### 15.1 Export requirements

User can export own data from settings.

Export package includes:
- Profile data.
- Interest entries.
- Decisions affecting them.
- Offers and responses.
- Membership history.
- Sent/received communications metadata relevant to user.

Format:
- JSON bundle in zip.
- Signed URL expiration <= 24 hours.

### 15.2 Deletion requirements

User can request account deletion from settings.

Process:
1. Re-auth prompt (OTP).
2. Create `deletion_request`.
3. Async processor removes or anonymizes personal data.
4. User loses access after completion.

Retention policy:
- Keep non-personal aggregate metrics.
- Keep audit logs with user identifiers anonymized where legally acceptable.

## 16. Security Requirements

- OTP rate limits by phone and IP.
- Join code brute-force protection with throttling and temporary lockouts.
- Enforce E.164 normalization for phone numbers.
- Restrict avatar upload types and size; scan for malicious content if provider supports it.
- Signed URLs for private assets.
- CSP, secure headers, strict origin policy.
- Audit all admin actions and sensitive privacy operations.
- Secrets only in server environment (never client bundle).

## 17. Performance and Scalability

### 17.1 Baseline targets

- p95 page load under 2.5s on modern mobile network.
- p95 decision write under 300ms server processing.
- Directory search response under 500ms for target MVP volume.

### 17.2 Scalability strategy

- Multi-tenant by university and organization IDs.
- Avoid N+1 queries with denormalized read views where needed.
- Use pagination for recruitment and directory lists.
- Add read replicas/caching only when metrics justify.

### 17.3 Idempotency and consistency

- Interest submission idempotent by `(user_id, organization_id, cycle_id)`.
- Offer response idempotent by `offer_id`.
- Messaging dedupe key per `(job kind, cycle, recipient set hash, content hash)`.

## 18. Observability and Analytics

### 18.1 Operational telemetry

- Structured logs for API and edge functions.
- Error tracking for client and server exceptions.
- Audit dashboards for admin actions.

### 18.2 Product analytics

Track funnel metrics:
- QR open -> auth started -> auth completed -> interest submitted.
- Stage1 throughput and rejection ratio.
- Stage2 yes/no ratio.
- Offer acceptance conversion.
- Time-to-decision per cycle.

No invasive tracking of profile views in MVP.

## 19. Frontend Architecture

### 19.1 App shell strategy

- Small route-level bundles for fast first paint.
- Shared layout primitives for consistency.
- React Query as source for server state with aggressive cache invalidation on decision actions.

### 19.2 Suggested folder structure

- `src/app` app bootstrap/providers/router.
- `src/features/auth`
- `src/features/profile`
- `src/features/recruitment`
- `src/features/offers`
- `src/features/directory`
- `src/features/admin`
- `src/features/super-admin`
- `src/lib/supabase`
- `src/lib/validation`
- `src/lib/ui`

### 19.3 UI components (MVP)

- Phone auth stepper.
- OTP input component.
- Candidate card with quick actions.
- Offer card with accept/decline CTA.
- Directory card with private-field gating.
- Admin message composer.

## 20. Validation and Error Handling

- Shared Zod schemas for all client-submitted payloads.
- Server-side re-validation on all edge function inputs.
- User-facing error copy must be brief and actionable.
- Recoverable errors keep user in flow (no dead ends).

## 21. Test-Driven Development Strategy

TDD is mandatory for all phases and all features in MVP.

### 21.1 TDD operating rules

- No production code is merged unless a failing test for the behavior existed first.
- Use Red -> Green -> Refactor cycle for every unit of behavior.
- Write tests at the appropriate layer before implementation:
  - Unit test for pure logic.
  - Integration test for DB/function boundaries.
  - E2E test for critical user journeys.
- Bug fixes require a regression test that fails before the fix and passes after.
- Schema changes require migration tests and rollback verification in CI.
- RLS changes require explicit authorization tests for allowed and denied access paths.

### 21.2 Definition of done (TDD edition)

A story is complete only when all are true:
- Behavior is specified in tests first.
- Tests fail before implementation and pass after implementation.
- Refactor pass is completed where needed without changing behavior.
- CI is green for lint, type-check, unit, integration, and required E2E suites.
- New or changed behavior has negative-path tests (unauthorized/invalid/conflict).
- Observability assertions exist where relevant (audit/security-sensitive actions).

### 21.3 Test layers and ownership

Unit tests:
- Utility functions.
- Validation schemas.
- State transition helpers.
- Permission helper logic.

Integration tests:
- Auth onboarding flow.
- Interest submission idempotency.
- Stage1 and stage2 decision writes.
- Offer acceptance creating membership.
- Privacy export and deletion workflows.
- Email send orchestration and dedupe behavior.

E2E tests:
- Mobile viewport happy-path for student join.
- Admin rapid triage flow.
- Directory privacy visibility checks.
- Offer response and membership activation path.

Security tests:
- RLS policy enforcement tests.
- Unauthorized mutation attempts.
- Join code abuse simulation.
- OTP rate limit and brute-force throttling assertions.

### 21.4 CI quality gates

- Pull requests fail if any required test suite fails.
- Pull requests fail if migration verification fails.
- Pull requests fail if RLS policy tests fail.
- Pull requests fail if minimum coverage thresholds are not met.
- Coverage thresholds for MVP:
  - Domain and permission logic: >= 90% line coverage.
  - Edge functions and data workflows: >= 85% line coverage.
  - UI critical paths: >= 80% line coverage.
- Nightly pipeline runs full E2E + abuse/security scenarios.

### 21.5 Test tooling baseline

- Unit/integration: Vitest.
- UI interaction tests: Testing Library.
- E2E: Playwright (mobile and desktop profiles).
- Contract and payload validation: Zod schemas with schema tests.
- Database/RLS tests: SQL + function-level integration suite.

## 22. Phased Implementation Plan

Execution rule for all phases:
- Every implementation task in every phase follows TDD (Red -> Green -> Refactor).
- Each phase includes explicit test-first deliverables and CI gates.
- No phase is considered complete unless its TDD exit criteria are met.

## Phase 0: Product Foundation and Environment Setup

Goal:
- Establish stable delivery baseline and environment scaffolding.

Backend work:
- Create Supabase project and environments (`dev`, `staging`, `prod`).
- Configure auth settings for phone OTP.
- Set up base migrations framework.
- Implement core extension setup and timestamp defaults.

Frontend work:
- Add app providers: router, query client, auth session context.
- Define route skeletons for public/authenticated/admin zones.
- Create design tokens for consistent minimal UI.

Ops work:
- Set environment variable strategy.
- Configure CI for lint, tests, and migration checks.

TDD requirements:
- Implement test harness setup before feature code:
  - Vitest config, test utilities, and seeded test DB strategy.
  - Playwright baseline project with mobile profile.
  - CI jobs split into fast checks and full checks.
- Add failing "smoke" tests first to validate pipeline behavior, then make them pass.
- Add migration verification tests (up/down) before adding the first schema migrations.

Deliverables:
- Running app shell with environment separation.
- CI passing on baseline.
- TDD tooling baseline operational in local and CI environments.

Exit criteria:
- Team can run app + backend locally and in staging.
- Migration pipeline proven with rollback tested once.
- Test pipeline enforces fail-fast behavior for failing unit/integration tests.
- A documented TDD workflow exists in repository docs and is required for PRs.

## Phase 1: Identity and Onboarding

Goal:
- Ship frictionless phone authentication and first profile setup.

Backend work:
- Implement auth handshake functions.
- Create `users` table and profile sync logic.
- Enforce phone normalization and uniqueness.

Frontend work:
- Build phone entry + OTP verification stepper.
- Build first-time name capture screen.
- Add session-aware guard routes.

TDD requirements:
- Write failing tests first for:
  - Phone validation and normalization behavior.
  - OTP challenge/verify success and error paths.
  - First-login name capture requirement.
  - Auth route guards (logged out vs logged in behavior).
- Add integration tests for auth and profile creation before endpoint implementation.
- Add E2E onboarding flow test in mobile viewport before final UI polish.

QA focus:
- OTP retry and lockout scenarios.
- Session persistence across refresh.

Deliverables:
- Complete auth journey from logged out to active session.

Exit criteria:
- New user can sign in and complete name entry on mobile in under 60 seconds.
- All auth and onboarding tests are test-first authored and green in CI.
- Negative-path auth tests (invalid OTP, expired OTP, rate-limited OTP) are present and passing.

## Phase 2: Super-Admin Foundation

Goal:
- Enable manual setup of schools, chapters, cycles, and admin assignments.

Backend work:
- Create `universities`, `organizations`, `recruitment_cycles`, `join_links`, `organization_admins`.
- Add super-admin role model and RLS policies.
- Add function endpoints for create/update admin operations.

Frontend work:
- Build super-admin pages for school/chapter/cycle management.
- Build static join code generation UI.
- Build admin assignment UI.

TDD requirements:
- Create failing authorization tests before writing super-admin mutations.
- Create failing tests for unique constraints and invalid input cases.
- Add integration tests for school/chapter/cycle creation workflows prior to implementation.
- Add E2E test for super-admin setup journey (create university -> org -> cycle -> assign admin).

QA focus:
- Role boundary checks across student/admin/super-admin.

Deliverables:
- Super-admin can fully configure a recruitment cycle without database access.

Exit criteria:
- New university + chapter + cycle + admin can be created end-to-end from UI.
- Unauthorized attempts by student/chapter admin to perform super-admin actions are tested and denied.
- RLS and endpoint permission tests are green in CI.

## Phase 3: Interest Capture (QR/Code Entry)

Goal:
- Let students quickly express chapter interest.

Backend work:
- Create `interest_entries`.
- Implement `submit-interest` with idempotency and anti-abuse guardrails.
- Add audit logging for submissions.

Frontend work:
- Build `/join/:code` flow and manual code fallback.
- Build success confirmation screen and clear next-step text.

TDD requirements:
- Add failing unit tests for join code parsing and validation.
- Add failing integration tests for idempotent interest submission and duplicate prevention.
- Add failing abuse-case tests for invalid and inactive codes.
- Add E2E tests for QR/deep-link and manual code paths before final flow completion.

QA focus:
- Duplicate submission prevention.
- Invalid/inactive code handling.

Deliverables:
- Production-ready interest submission flow.

Exit criteria:
- Returning user can submit interest in <= 2 taps after landing on join link.
- Idempotency tests for repeated submissions are green.
- Abuse and invalid-code tests are green and enforced in CI.

## Phase 4: Recruitment Decision Pipeline

Goal:
- Deliver fast admin triage and final decision workflows.

Backend work:
- Create `recruitment_decisions`.
- Implement stage1 and stage2 decision endpoints with strict authorization.
- Add list endpoints/views optimized for queue performance.

Frontend work:
- Build stage1 queue UI with one-tap `Shortlist`/`No`.
- Build stage2 shortlist board with one-tap `Final Yes`/`Final No`.
- Add optimistic UI updates with rollback on failure.

TDD requirements:
- Author failing state-transition tests for stage1 and stage2 decisions before implementation.
- Author failing authorization tests for cross-org decision attempts.
- Add integration tests for race conditions and decision idempotency.
- Add E2E admin triage tests covering rapid successive decisions and rollback behavior.

QA focus:
- Decision race conditions and idempotency.
- Unauthorized org access attempts.

Deliverables:
- Admin can process full queue without leaving recruitment screens.

Exit criteria:
- p95 decision action response <= 300ms in staging data set.
- Stage transition and authorization test suites are green in CI.
- Regression tests exist for any race-condition bugs found during phase execution.

## Phase 5: Offer Acceptance and Membership Activation

Goal:
- Require explicit student acceptance before membership activation.

Backend work:
- Create `offers` and `memberships`.
- Implement offer creation on final yes.
- Implement offer response logic:
  - Accept -> activate membership if no active membership exists.
  - Decline -> mark declined.
- Enforce single active membership constraint.

Frontend work:
- Build offers inbox view.
- Build accept/decline confirmation UX.
- Show resulting membership status in profile and directory.

TDD requirements:
- Write failing tests first for offer lifecycle transitions.
- Add failing tests for single-active-membership enforcement.
- Add integration tests for concurrent offer responses and conflict handling.
- Add E2E tests for accept and decline outcomes including UI state updates.

QA focus:
- Double-submit behavior.
- Active-membership conflict behavior.

Deliverables:
- End-to-end offer and membership lifecycle.

Exit criteria:
- Accepted offer always creates exactly one active membership.
- Membership invariants are enforced by tested constraints and integration tests.
- Offer response regression tests are green in CI.

## Phase 6: Directory and Privacy Gating

Goal:
- Launch campus directory with strict field-level privacy behavior.

Backend work:
- Implement privacy-safe read views.
- Apply and test RLS policy matrix for directory access.
- Add search indexes for name and organization filters.

Frontend work:
- Build campus directory page with search by person or org.
- Build profile cards with conditional private fields.

TDD requirements:
- Define failing privacy tests for all role and relationship combinations before UI implementation.
- Add failing query tests for same-university basic fields vs same-organization private fields.
- Add E2E privacy tests that assert phone/email redaction outside chapter boundaries.
- Add failing search tests for name and organization filters before implementing search UI.

QA focus:
- Cross-org visibility boundaries.
- Same-org private data access.

Deliverables:
- Directory available to all authenticated users at same university.

Exit criteria:
- Phone/email never appears outside same organization membership.
- Full privacy matrix tests are green and mandatory in CI.
- Any privacy bug discovered includes a permanent regression test.

## Phase 7: Messaging and Communications

Goal:
- Let admins send acceptance and optional rejection emails at scale.

Backend work:
- Create `email_templates` and `email_jobs`.
- Implement message sending function with provider adapter and retry logic.
- Add send audit events and dedupe protections.

Frontend work:
- Build template manager.
- Build message composer with recipient group targeting.
- Show send result summary and failures.

TDD requirements:
- Write failing tests for template validation, rendering, and required fields.
- Write failing tests for recipient targeting logic and dedupe keys.
- Add integration tests for provider retry paths and failure logging.
- Add E2E tests for composing and sending acceptance and optional rejection messages.

QA focus:
- Template rendering validation.
- Duplicate-send protections.
- Provider failure retry behavior.

Deliverables:
- Reliable admin messaging workflow.

Exit criteria:
- Admin can send acceptance email to selected recipient group from UI with logged outcomes.
- Messaging tests cover success, retry, and duplicate prevention paths and are green in CI.
- Audit log emission for send events is verified by tests.

## Phase 8: Privacy Rights, Security Hardening, and Launch Readiness

Goal:
- Complete data rights obligations and production hardening.

Backend work:
- Implement export and deletion request flows.
- Add deletion processor and anonymization rules.
- Finalize rate limits and abuse protections.

Frontend work:
- Build settings privacy page for export/delete actions.
- Add account deletion confirmation with re-auth.

Ops and compliance work:
- Run security checklist and penetration-style abuse tests.
- Finalize backup and disaster recovery runbook.
- Validate production monitoring and alerting.

TDD requirements:
- Write failing tests for export payload completeness before implementation finalization.
- Write failing tests for delete request lifecycle and re-auth enforcement.
- Add security regression suite for abuse and unauthorized access attempts.
- Freeze release on any failing privacy/security test.

QA focus:
- Export package completeness.
- Deletion correctness and post-deletion access behavior.

Deliverables:
- Production-ready MVP candidate.

Exit criteria:
- Security, privacy, and functional acceptance checks all pass.
- All critical E2E tests are green in staging on mobile and desktop profiles.
- Full TDD gate suite (unit, integration, E2E, security, RLS) is green with required coverage thresholds.

## 23. Risks and Mitigations

Risk: OTP delivery costs or deliverability degrade at scale.  
Mitigation: provider abstraction + monitoring + fallback provider.

Risk: Join code leakage creates spam interest submissions.  
Mitigation: throttling, anomaly detection, optional manual code reset by super-admin.

Risk: Permission bugs expose private contact details.  
Mitigation: strict RLS tests and privacy-specific integration tests before launch.

Risk: Admin workflows become too click-heavy.  
Mitigation: enforce one-tap actions, optimistic updates, keyboard shortcuts for desktop.

Risk: Ambiguity around chapter transfer use cases.  
Mitigation: enforce one active membership in MVP and log blocked edge cases for v1.1.

## 24. Post-MVP Backlog (Not in current implementation scope)

- Council-level administration.
- Native app wrappers if web engagement limits are observed.
- Voting/committee decision support.
- Round scheduling and event attendance.
- CRM-style scoring and tags.
- In-app notifications/push.

## 25. Acceptance Criteria for MVP Sign-off

Product is sign-off ready when all are true:
- Phone OTP onboarding works reliably on mobile.
- Student can express interest via QR/code quickly.
- Admin can process stage1 and stage2 decisions with one-tap actions.
- Student must explicitly accept offer to become member.
- Directory privacy rules are enforced exactly as specified.
- Super-admin can configure schools, chapters, cycles, and admins.
- Acceptance and optional rejection messaging works with audit trail.
- User export and delete requests are operational.
- Observability and incident response baseline is in place.
- TDD process was followed across all phases with test-first evidence in PRs and green CI quality gates.
