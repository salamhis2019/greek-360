# Email Delivery Pipeline (Phase 10)

This project now uses an async email delivery pipeline:

1. `send_cycle_messages` validates input, resolves recipients, and creates a queued `email_jobs` record.
2. The app triggers the `messages-deliver` Edge Function after enqueue.
3. `messages-deliver` claims the job, delivers to recipients with retry logic, and applies final results.

## New Database Objects

- `public.email_job_recipients`
- `public.claim_email_job_for_delivery(uuid)`
- `public.apply_email_job_delivery_result(uuid, int, int, int, jsonb, text)`

`public.email_jobs` now supports these statuses:

- `queued`
- `processing`
- `sent`
- `partial`
- `failed`

## Edge Function

Path:

- `supabase/functions/messages-deliver/index.ts`

Behavior:

- Supports providers via `EMAIL_PROVIDER`:
  - `resend` (default)
  - `sendgrid`
- Renders template variables:
  - `{{ name }}`
  - `{{ organization_name }}`
- Records per-recipient outcomes in `email_job_recipients`.
- Writes aggregate results back to `email_jobs`.

## Required Environment Variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EMAIL_FROM`
- `EMAIL_PROVIDER` (`resend` or `sendgrid`)
- `RESEND_API_KEY` (if provider is `resend`)
- `SENDGRID_API_KEY` (if provider is `sendgrid`)

## Operational Checks

1. Ensure queued jobs transition to `processing` then `sent`/`partial`/`failed`.
2. Confirm `messages_queued`, `messages_sent`, and `messages_send_failed` audit events.
3. Alert on:
   - growing count of `queued` jobs,
   - high `failed` rate,
   - repeated missing-email failures.
