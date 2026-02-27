alter table public.email_jobs
  drop constraint if exists email_jobs_status_check;

alter table public.email_jobs
  add constraint email_jobs_status_check
    check (status in ('queued', 'processing', 'sent', 'partial', 'failed'));

alter table public.email_jobs
  add column if not exists recipient_user_ids uuid[] not null default '{}'::uuid[],
  add column if not exists provider text,
  add column if not exists delivered_at timestamptz;

create table if not exists public.email_job_recipients (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.email_jobs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  email text,
  status text not null check (status in ('queued', 'sent', 'failed')),
  attempt_count int not null default 0 check (attempt_count >= 0),
  last_error text,
  provider_message_id text,
  sent_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint email_job_recipients_unique unique (job_id, user_id)
);

create index if not exists email_job_recipients_job_status_idx
  on public.email_job_recipients (job_id, status, updated_at desc);

alter table public.email_job_recipients enable row level security;

create policy email_job_recipients_admin_select_org on public.email_job_recipients
for select
using (
  public.current_user_is_super_admin()
  or exists (
    select 1
    from public.email_jobs
    join public.organization_admins
      on organization_admins.organization_id = email_jobs.organization_id
    where email_jobs.id = email_job_recipients.job_id
      and organization_admins.user_id = auth.uid()
  )
);

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
  resolved_recipient_user_ids uuid[];
  recipient_signature text;
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
  select coalesce(array_agg(distinct user_id order by user_id), '{}'::uuid[])
  into resolved_recipient_user_ids
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

  calculated_recipient_count := coalesce(array_length(resolved_recipient_user_ids, 1), 0);
  recipient_signature := coalesce(array_to_string(resolved_recipient_user_ids, ','), '');

  effective_dedupe_key := nullif(trim(coalesce(job_dedupe_key, '')), '');
  if effective_dedupe_key is null then
    effective_dedupe_key := md5(
      normalized_kind || ':' ||
      job_cycle_id::text || ':' ||
      recipient_signature || ':' ||
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
      sent_by,
      recipient_user_ids
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
      0,
      0,
      0,
      'queued',
      '[]'::jsonb,
      effective_dedupe_key,
      current_user_id,
      resolved_recipient_user_ids
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

  insert into public.email_job_recipients (
    job_id,
    user_id,
    email,
    status
  )
  select
    created_job.id,
    users.id,
    users.email,
    'queued'
  from public.users
  where users.id = any(resolved_recipient_user_ids);

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
    'messages_queued',
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

create or replace function public.claim_email_job_for_delivery(
  claim_job_id uuid
)
returns public.email_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_job public.email_jobs;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden';
  end if;

  update public.email_jobs
  set status = 'processing'
  where id = claim_job_id
    and status = 'queued'
  returning * into claimed_job;

  if claimed_job.id is null then
    select *
    into claimed_job
    from public.email_jobs
    where id = claim_job_id;
  end if;

  if claimed_job.id is null then
    raise exception 'email job not found';
  end if;

  return claimed_job;
end;
$$;

create or replace function public.apply_email_job_delivery_result(
  target_job_id uuid,
  result_sent_count int,
  result_failed_count int,
  result_retries_used int,
  result_failure_details jsonb default '[]'::jsonb,
  result_provider text default null
)
returns public.email_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_job public.email_jobs;
  resolved_status text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden';
  end if;

  if coalesce(result_sent_count, 0) < 0 or coalesce(result_failed_count, 0) < 0 then
    raise exception 'sent and failed counts must be non-negative';
  end if;

  if coalesce(result_retries_used, 0) < 0 then
    raise exception 'retries used must be non-negative';
  end if;

  resolved_status := case
    when coalesce(result_failed_count, 0) = 0 then 'sent'
    when coalesce(result_sent_count, 0) = 0 then 'failed'
    else 'partial'
  end;

  update public.email_jobs
  set
    sent_count = coalesce(result_sent_count, 0),
    failed_count = coalesce(result_failed_count, 0),
    retries_used = coalesce(result_retries_used, 0),
    failure_details = coalesce(result_failure_details, '[]'::jsonb),
    status = resolved_status,
    provider = coalesce(result_provider, provider),
    delivered_at = timezone('utc', now())
  where id = target_job_id
  returning * into updated_job;

  if updated_job.id is null then
    raise exception 'email job not found';
  end if;

  insert into public.audit_logs (
    actor_user_id,
    organization_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    updated_job.sent_by,
    updated_job.organization_id,
    case
      when updated_job.failed_count > 0 then 'messages_send_failed'
      else 'messages_sent'
    end,
    'email_job',
    updated_job.id,
    jsonb_build_object(
      'recipient_count', updated_job.recipient_count,
      'sent_count', updated_job.sent_count,
      'failed_count', updated_job.failed_count,
      'status', updated_job.status,
      'provider', updated_job.provider
    )
  );

  return updated_job;
end;
$$;
