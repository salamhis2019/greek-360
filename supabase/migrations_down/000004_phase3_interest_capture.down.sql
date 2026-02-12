drop function if exists public.submit_interest(text, text);
drop function if exists public.resolve_active_join_link(text);

drop policy if exists interest_entries_super_admin_select_all on public.interest_entries;
drop policy if exists interest_entries_chapter_admin_select_org on public.interest_entries;
drop policy if exists interest_entries_student_select_own on public.interest_entries;
drop policy if exists audit_logs_actor_select_own on public.audit_logs;

drop index if exists public.interest_entries_user_created_at_idx;
drop index if exists public.interest_entries_org_cycle_created_at_idx;
drop index if exists public.audit_logs_actor_created_at_idx;

drop table if exists public.interest_entries;
drop table if exists public.audit_logs;
