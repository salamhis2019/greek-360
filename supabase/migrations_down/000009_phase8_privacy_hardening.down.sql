drop function if exists public.process_account_deletion(uuid);
drop function if exists public.request_account_deletion(text);
drop function if exists public.request_privacy_export();

drop policy if exists deletion_requests_select_own on public.deletion_requests;

drop index if exists public.deletion_requests_status_requested_idx;

drop table if exists public.deletion_requests;
