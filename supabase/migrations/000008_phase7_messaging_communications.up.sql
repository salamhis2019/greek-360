create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  subject text not null,
  body_html text not null,
  body_text text not null,
  type text not null check (type in ('acceptance', 'rejection')),
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.email_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cycle_id uuid not null references public.recruitment_cycles(id) on delete cascade,
  kind text not null check (kind in ('acceptance', 'rejection')),
  recipient_group text not null check (
    recipient_group in (
      'final_yes_pending_offer',
      'final_no',
      'offer_accepted',
      'offer_declined'
    )
  ),
  template_id uuid references public.email_templates(id) on delete set null,
  custom_subject text,
  custom_body_html text,
  custom_body_text text,
  recipient_count int not null check (recipient_count >= 0),
  sent_count int not null default 0 check (sent_count >= 0),
  failed_count int not null default 0 check (failed_count >= 0),
  retries_used int not null default 0 check (retries_used >= 0),
  status text not null check (status in ('sent', 'partial', 'failed')),
  failure_details jsonb not null default '[]'::jsonb,
  dedupe_key text not null,
  sent_by uuid not null references public.users(id) on delete cascade,
  sent_at timestamptz not null default timezone('utc', now()),
  constraint email_jobs_dedupe_unique unique (organization_id, cycle_id, kind, dedupe_key)
);

create index if not exists email_templates_org_type_created_idx
  on public.email_templates (organization_id, type, created_at desc);

create index if not exists email_jobs_org_cycle_sent_idx
  on public.email_jobs (organization_id, cycle_id, sent_at desc);

alter table public.email_templates enable row level security;
alter table public.email_jobs enable row level security;

create policy email_templates_admin_select_org on public.email_templates
for select
using (
  public.current_user_is_super_admin()
  or exists (
    select 1
    from public.organization_admins
    where organization_admins.organization_id = email_templates.organization_id
      and organization_admins.user_id = auth.uid()
  )
);

create policy email_templates_admin_insert_org on public.email_templates
for insert
with check (
  created_by = auth.uid()
  and (
    public.current_user_is_super_admin()
    or exists (
      select 1
      from public.organization_admins
      where organization_admins.organization_id = email_templates.organization_id
        and organization_admins.user_id = auth.uid()
    )
  )
);

create policy email_jobs_admin_select_org on public.email_jobs
for select
using (
  public.current_user_is_super_admin()
  or exists (
    select 1
    from public.organization_admins
    where organization_admins.organization_id = email_jobs.organization_id
      and organization_admins.user_id = auth.uid()
  )
);

create or replace function public.create_email_template(
  template_organization_id uuid,
  template_kind text,
  template_name text,
  template_subject text,
  template_body_text text,
  template_body_html text
)
returns public.email_templates
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  normalized_kind text;
  normalized_name text;
  normalized_subject text;
  normalized_body_text text;
  normalized_body_html text;
  created_template public.email_templates;
begin
  current_user_id := public.assert_recruitment_decision_actor(template_organization_id);
  normalized_kind := lower(trim(coalesce(template_kind, '')));
  normalized_name := trim(coalesce(template_name, ''));
  normalized_subject := trim(coalesce(template_subject, ''));
  normalized_body_text := trim(coalesce(template_body_text, ''));
  normalized_body_html := trim(coalesce(template_body_html, ''));

  if normalized_kind not in ('acceptance', 'rejection') then
    raise exception 'invalid template kind';
  end if;

  if normalized_name = '' or normalized_subject = '' or normalized_body_text = '' then
    raise exception 'template name, subject, and body are required';
  end if;

  if normalized_body_html = '' then
    normalized_body_html := '<p>' || replace(normalized_body_text, E'\n', '<br/>') || '</p>';
  end if;

  insert into public.email_templates (
    organization_id,
    name,
    subject,
    body_html,
    body_text,
    type,
    created_by
  ) values (
    template_organization_id,
    normalized_name,
    normalized_subject,
    normalized_body_html,
    normalized_body_text,
    normalized_kind,
    current_user_id
  )
  returning * into created_template;

  insert into public.audit_logs (
    actor_user_id,
    organization_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    current_user_id,
    template_organization_id,
    'message_template_created',
    'email_template',
    created_template.id,
    jsonb_build_object(
      'kind', created_template.type,
      'name', created_template.name
    )
  );

  return created_template;
end;
$$;

create or replace function public.list_email_templates(
  list_organization_id uuid,
  list_kind text default null
)
returns setof public.email_templates
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_kind text;
begin
  perform public.assert_recruitment_decision_actor(list_organization_id);
  normalized_kind := nullif(lower(trim(coalesce(list_kind, ''))), '');

  return query
  select *
  from public.email_templates
  where organization_id = list_organization_id
    and (normalized_kind is null or type = normalized_kind)
  order by created_at desc;
end;
$$;

create or replace function public.send_cycle_messages(
  job_organization_id uuid,
  job_cycle_id uuid,
  job_kind text,
  job_recipient_group text,
  job_template_id uuid default null,
  job_custom_subject text default null,
  job_custom_body_text text default null,
  job_custom_body_html text default null,
  job_dedupe_key text default null,
  job_max_retries int default 2
)
returns table (
  id uuid,
  organization_id uuid,
  cycle_id uuid,
  kind text,
  recipient_group text,
  template_id uuid,
  custom_subject text,
  custom_body_text text,
  recipient_count int,
  sent_count int,
  failed_count int,
  retries_used int,
  status text,
  dedupe_key text,
  failure_details jsonb,
  sent_by uuid,
  sent_at timestamptz,
  was_deduplicated boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  normalized_kind text;
  normalized_group text;
  normalized_custom_subject text;
  normalized_custom_body_text text;
  normalized_custom_body_html text;
  selected_template public.email_templates;
  existing_job public.email_jobs;
  created_job public.email_jobs;
  selected_cycle public.recruitment_cycles;
  calculated_recipient_count int;
  effective_subject text;
  effective_body_text text;
  effective_body_html text;
  effective_dedupe_key text;
begin
  current_user_id := public.assert_recruitment_decision_actor(job_organization_id);
  normalized_kind := lower(trim(coalesce(job_kind, '')));
  normalized_group := lower(trim(coalesce(job_recipient_group, '')));
  normalized_custom_subject := nullif(trim(coalesce(job_custom_subject, '')), '');
  normalized_custom_body_text := nullif(trim(coalesce(job_custom_body_text, '')), '');
  normalized_custom_body_html := nullif(trim(coalesce(job_custom_body_html, '')), '');

  if normalized_kind not in ('acceptance', 'rejection') then
    raise exception 'invalid message kind';
  end if;

  if normalized_group not in ('final_yes_pending_offer', 'final_no', 'offer_accepted', 'offer_declined') then
    raise exception 'invalid recipient group';
  end if;

  if coalesce(job_max_retries, 0) < 0 then
    raise exception 'max retries must be non-negative';
  end if;

  select *
  into selected_cycle
  from public.recruitment_cycles
  where id = job_cycle_id
    and organization_id = job_organization_id;

  if selected_cycle.id is null then
    raise exception 'recruitment cycle not found for organization';
  end if;

  if job_template_id is not null then
    select *
    into selected_template
    from public.email_templates
    where id = job_template_id
      and organization_id = job_organization_id
      and type = normalized_kind;

    if selected_template.id is null then
      raise exception 'email template not found';
    end if;

    effective_subject := selected_template.subject;
    effective_body_text := selected_template.body_text;
    effective_body_html := selected_template.body_html;
  else
    effective_subject := normalized_custom_subject;
    effective_body_text := normalized_custom_body_text;
    effective_body_html := normalized_custom_body_html;
  end if;

  if coalesce(effective_subject, '') = '' or coalesce(effective_body_text, '') = '' then
    raise exception 'subject and body text are required';
  end if;

  if coalesce(effective_body_html, '') = '' then
    effective_body_html := '<p>' || replace(effective_body_text, E'\n', '<br/>') || '</p>';
  end if;

  with recipient_candidates as (
    select
      interest_entries.id as interest_entry_id,
      interest_entries.user_id,
      stage2_decisions.decision as final_decision,
      offers.status as offer_status
    from public.interest_entries
    left join public.recruitment_decisions stage2_decisions
      on stage2_decisions.interest_entry_id = interest_entries.id
      and stage2_decisions.stage = 'final'
    left join public.offers
      on offers.interest_entry_id = interest_entries.id
    where interest_entries.organization_id = job_organization_id
      and interest_entries.cycle_id = job_cycle_id
  )
  select count(distinct user_id)
  into calculated_recipient_count
  from recipient_candidates
  where (
    normalized_group = 'final_yes_pending_offer'
    and final_decision = 'yes'
    and offer_status = 'pending'
  ) or (
    normalized_group = 'final_no'
    and final_decision = 'no'
  ) or (
    normalized_group = 'offer_accepted'
    and offer_status = 'accepted'
  ) or (
    normalized_group = 'offer_declined'
    and offer_status = 'declined'
  );

  effective_dedupe_key := nullif(trim(coalesce(job_dedupe_key, '')), '');
  if effective_dedupe_key is null then
    effective_dedupe_key := md5(
      normalized_kind || ':' ||
      job_cycle_id::text || ':' ||
      normalized_group || ':' ||
      calculated_recipient_count::text || ':' ||
      effective_subject || ':' ||
      effective_body_text
    );
  end if;

  begin
    insert into public.email_jobs (
      organization_id,
      cycle_id,
      kind,
      recipient_group,
      template_id,
      custom_subject,
      custom_body_html,
      custom_body_text,
      recipient_count,
      sent_count,
      failed_count,
      retries_used,
      status,
      failure_details,
      dedupe_key,
      sent_by
    ) values (
      job_organization_id,
      job_cycle_id,
      normalized_kind,
      normalized_group,
      selected_template.id,
      case when selected_template.id is null then effective_subject else null end,
      case when selected_template.id is null then effective_body_html else null end,
      case when selected_template.id is null then effective_body_text else null end,
      calculated_recipient_count,
      calculated_recipient_count,
      0,
      0,
      'sent',
      '[]'::jsonb,
      effective_dedupe_key,
      current_user_id
    )
    returning * into created_job;
  exception
    when unique_violation then
      select *
      into existing_job
      from public.email_jobs
      where organization_id = job_organization_id
        and cycle_id = job_cycle_id
        and kind = normalized_kind
        and dedupe_key = effective_dedupe_key;

      return query
      select
        existing_job.id,
        existing_job.organization_id,
        existing_job.cycle_id,
        existing_job.kind,
        existing_job.recipient_group,
        existing_job.template_id,
        existing_job.custom_subject,
        existing_job.custom_body_text,
        existing_job.recipient_count,
        existing_job.sent_count,
        existing_job.failed_count,
        existing_job.retries_used,
        existing_job.status,
        existing_job.dedupe_key,
        existing_job.failure_details,
        existing_job.sent_by,
        existing_job.sent_at,
        true;
      return;
  end;

  insert into public.audit_logs (
    actor_user_id,
    organization_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    current_user_id,
    job_organization_id,
    'messages_sent',
    'email_job',
    created_job.id,
    jsonb_build_object(
      'kind', created_job.kind,
      'recipient_group', created_job.recipient_group,
      'recipient_count', created_job.recipient_count,
      'dedupe_key', created_job.dedupe_key
    )
  );

  return query
  select
    created_job.id,
    created_job.organization_id,
    created_job.cycle_id,
    created_job.kind,
    created_job.recipient_group,
    created_job.template_id,
    created_job.custom_subject,
    created_job.custom_body_text,
    created_job.recipient_count,
    created_job.sent_count,
    created_job.failed_count,
    created_job.retries_used,
    created_job.status,
    created_job.dedupe_key,
    created_job.failure_details,
    created_job.sent_by,
    created_job.sent_at,
    false;
end;
$$;
