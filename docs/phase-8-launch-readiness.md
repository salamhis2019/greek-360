# Phase 8 Launch Readiness

This checklist captures the MVP launch gates from Phase 8 in `spec.md`.

## 1) Privacy Rights

- [x] User data export endpoint contract implemented in application service layer.
- [x] User deletion request endpoint contract implemented in application service layer.
- [x] Deletion processor implemented with super-admin guard.
- [x] Deletion request state model includes:
  - `requested`
  - `processing`
  - `completed`
  - `rejected`
- [x] Sensitive operations are audit-logged:
  - `privacy_export_requested`
  - `deletion_requested`
  - `deletion_request_invalid_reauth`
  - `deletion_completed`

## 2) Security Hardening

- [x] Phone confirmation is required before deletion request creation.
- [x] Deletion re-auth invalid-attempt rate limiting enforced.
- [x] Unauthorized deletion processing attempts are denied by tests.
- [x] Deleted users lose access to authenticated routes.
- [x] Route authorization regression suite remains active in CI.

## 3) Abuse/Penetration-Style Test Coverage

Test suites that should remain green:

- `src/test/security/privacy-rights.security.test.ts`
- `src/test/security/route-authorization.security.test.tsx`
- `src/test/security/directory-privacy.security.test.ts`
- `src/test/security/recruitment-decisions.security.test.ts`
- `src/test/security/offers.security.test.ts`
- `src/test/security/messaging.security.test.ts`

## 4) Backup and Disaster Recovery Runbook

## Backup Baseline

- Supabase managed backups enabled for the production project.
- Recovery point objective (RPO): 24 hours max data loss.
- Recovery time objective (RTO): 4 hours to restore service.
- Retention: at least 14 days of point-in-time snapshots.

## Restore Drill Procedure

1. Identify incident window and freeze write operations.
2. Restore database to pre-incident timestamp in an isolated environment.
3. Validate critical tables:
   - `users`
   - `interest_entries`
   - `recruitment_decisions`
   - `offers`
   - `memberships`
   - `email_jobs`
   - `audit_logs`
   - `deletion_requests`
4. Run smoke checks and security suite against restored data.
5. Promote restore target and rotate credentials.
6. Publish incident timeline and prevention actions.

## 5) Monitoring and Alerting Baseline

Minimum production alerts:

- API/Edge function error rate above threshold.
- OTP verification failures spike.
- Join code invalid-attempt spike.
- Deletion re-auth failure spike.
- Elevated `messages_send_failed` rate.
- Elevated 5xx frontend API proxy errors.

Minimum dashboards:

- Auth funnel: OTP start -> OTP verify -> onboarding complete.
- Recruitment funnel: interest -> stage1 -> stage2 -> offer -> accept.
- Privacy operations: exports/day, deletion requests/day, completed deletions/day.
- Email delivery: sent vs failed vs retries.

## 6) Release Gate

Before promoting to production:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test:run`
4. `npm run test:security`
5. `npm run test:e2e`
6. `npm run test:coverage && npm run coverage:check`
7. `npm run migration:verify`
