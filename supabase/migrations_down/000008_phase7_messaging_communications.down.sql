drop function if exists public.send_cycle_messages(
  uuid,
  uuid,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  int
);
drop function if exists public.list_email_templates(uuid, text);
drop function if exists public.create_email_template(uuid, text, text, text, text, text);

drop policy if exists email_jobs_admin_select_org on public.email_jobs;
drop policy if exists email_templates_admin_insert_org on public.email_templates;
drop policy if exists email_templates_admin_select_org on public.email_templates;

drop index if exists public.email_jobs_org_cycle_sent_idx;
drop index if exists public.email_templates_org_type_created_idx;

drop table if exists public.email_jobs;
drop table if exists public.email_templates;
