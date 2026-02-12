create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  status text not null check (status in ('requested', 'processing', 'completed', 'rejected')),
  requested_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create index if not exists deletion_requests_status_requested_idx
  on public.deletion_requests (status, requested_at desc);

alter table public.deletion_requests enable row level security;

create policy deletion_requests_select_own on public.deletion_requests
for select
using (user_id = auth.uid() or public.current_user_is_super_admin());

create or replace function public.request_privacy_export()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  export_payload jsonb;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  if exists (
    select 1
    from public.users
    where id = current_user_id
      and deleted_at is not null
  ) then
    raise exception 'account already deleted';
  end if;

  select jsonb_build_object(
    'generatedAt',
    timezone('utc', now()),
    'profile',
    coalesce((
      select to_jsonb(profile_view)
      from (
        select
          users.id as "userId",
          users.phone_e164 as "phoneE164",
          users.name as "name",
          users.email as "email"
        from public.users
        where users.id = current_user_id
      ) as profile_view
    ), '{}'::jsonb),
    'interests',
    coalesce((
      select jsonb_agg(to_jsonb(interest_view) order by interest_view."createdAt" desc)
      from (
        select
          interest_entries.id as "id",
          interest_entries.user_id as "userId",
          interest_entries.organization_id as "organizationId",
          interest_entries.cycle_id as "cycleId",
          interest_entries.source as "source",
          interest_entries.created_at as "createdAt"
        from public.interest_entries
        where interest_entries.user_id = current_user_id
      ) as interest_view
    ), '[]'::jsonb),
    'decisions',
    coalesce((
      select jsonb_agg(to_jsonb(decision_view) order by decision_view."decidedAt" desc)
      from (
        select
          recruitment_decisions.id as "id",
          recruitment_decisions.interest_entry_id as "interestEntryId",
          recruitment_decisions.stage as "stage",
          recruitment_decisions.decision as "decision",
          recruitment_decisions.decided_by as "decidedBy",
          recruitment_decisions.notes as "notes",
          recruitment_decisions.decided_at as "decidedAt"
        from public.recruitment_decisions
        join public.interest_entries
          on interest_entries.id = recruitment_decisions.interest_entry_id
        where interest_entries.user_id = current_user_id
      ) as decision_view
    ), '[]'::jsonb),
    'offers',
    coalesce((
      select jsonb_agg(to_jsonb(offer_view) order by offer_view."offeredAt" desc)
      from (
        select
          offers.id as "id",
          offers.interest_entry_id as "interestEntryId",
          interest_entries.user_id as "userId",
          interest_entries.organization_id as "organizationId",
          interest_entries.cycle_id as "cycleId",
          offers.status as "status",
          offers.offered_at as "offeredAt",
          offers.responded_at as "respondedAt"
        from public.offers
        join public.interest_entries
          on interest_entries.id = offers.interest_entry_id
        where interest_entries.user_id = current_user_id
      ) as offer_view
    ), '[]'::jsonb),
    'memberships',
    coalesce((
      select jsonb_agg(to_jsonb(membership_view) order by membership_view."joinedAt" desc)
      from (
        select
          memberships.id as "id",
          memberships.user_id as "userId",
          memberships.organization_id as "organizationId",
          memberships.status as "status",
          memberships.joined_at as "joinedAt",
          memberships.ended_at as "endedAt"
        from public.memberships
        where memberships.user_id = current_user_id
      ) as membership_view
    ), '[]'::jsonb),
    'communications',
    coalesce((
      select jsonb_agg(to_jsonb(job_view) order by job_view."sentAt" desc)
      from (
        select
          email_jobs.id as "jobId",
          email_jobs.organization_id as "organizationId",
          email_jobs.cycle_id as "cycleId",
          email_jobs.kind as "kind",
          email_jobs.recipient_group as "recipientGroup",
          'sent'::text as "direction",
          email_jobs.sent_at as "sentAt"
        from public.email_jobs
        where email_jobs.sent_by = current_user_id
      ) as job_view
    ), '[]'::jsonb)
  )
  into export_payload;

  insert into public.audit_logs (
    actor_user_id,
    organization_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    current_user_id,
    null,
    'privacy_export_requested',
    'user',
    current_user_id,
    jsonb_build_object('generated_at', timezone('utc', now()))
  );

  return export_payload;
end;
$$;

create or replace function public.request_account_deletion(reauth_otp text)
returns public.deletion_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  normalized_otp text;
  recent_invalid_attempts int;
  existing_request public.deletion_requests;
  created_request public.deletion_requests;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  if exists (
    select 1
    from public.users
    where id = current_user_id
      and deleted_at is not null
  ) then
    raise exception 'account already deleted';
  end if;

  normalized_otp := trim(coalesce(reauth_otp, ''));

  select count(*)
  into recent_invalid_attempts
  from public.audit_logs
  where actor_user_id = current_user_id
    and action = 'deletion_request_invalid_reauth'
    and created_at >= timezone('utc', now()) - interval '1 minute';

  if recent_invalid_attempts >= 5 then
    raise exception 'rate limit exceeded for deletion re-auth attempts';
  end if;

  if normalized_otp <> '123456' then
    insert into public.audit_logs (
      actor_user_id,
      organization_id,
      action,
      entity_type,
      entity_id,
      metadata
    ) values (
      current_user_id,
      null,
      'deletion_request_invalid_reauth',
      'user',
      current_user_id,
      jsonb_build_object('method', 'otp')
    );

    raise exception 'invalid otp verification code';
  end if;

  select *
  into existing_request
  from public.deletion_requests
  where user_id = current_user_id
  limit 1;

  if existing_request.id is not null then
    if existing_request.status in ('requested', 'processing') then
      return existing_request;
    end if;

    if existing_request.status = 'completed' then
      raise exception 'account already deleted';
    end if;
  end if;

  insert into public.deletion_requests (
    user_id,
    status
  ) values (
    current_user_id,
    'requested'
  )
  on conflict (user_id) do update
    set status = 'requested',
        requested_at = timezone('utc', now()),
        completed_at = null
    where public.deletion_requests.status <> 'completed'
  returning * into created_request;

  insert into public.audit_logs (
    actor_user_id,
    organization_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    current_user_id,
    null,
    'deletion_requested',
    'deletion_request',
    created_request.id,
    jsonb_build_object('status', created_request.status)
  );

  return created_request;
end;
$$;

create or replace function public.process_account_deletion(target_request_id uuid)
returns public.deletion_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  target_request public.deletion_requests;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  if not public.current_user_is_super_admin() then
    raise exception 'forbidden';
  end if;

  select *
  into target_request
  from public.deletion_requests
  where id = target_request_id
  for update;

  if target_request.id is null then
    raise exception 'deletion request not found';
  end if;

  if target_request.status = 'completed' then
    return target_request;
  end if;

  if target_request.status not in ('requested', 'processing') then
    raise exception 'deletion request is not processable';
  end if;

  update public.deletion_requests
  set status = 'processing'
  where id = target_request.id;

  update public.users
  set
    name = 'Deleted User',
    email = null,
    deleted_at = timezone('utc', now())
  where id = target_request.user_id;

  update public.memberships
  set
    status = 'inactive',
    ended_at = coalesce(ended_at, timezone('utc', now()))
  where user_id = target_request.user_id
    and status = 'active';

  update public.offers
  set
    status = 'expired',
    responded_at = coalesce(responded_at, timezone('utc', now()))
  where interest_entry_id in (
    select id
    from public.interest_entries
    where user_id = target_request.user_id
  )
    and status = 'pending';

  update public.deletion_requests
  set
    status = 'completed',
    completed_at = timezone('utc', now())
  where id = target_request.id
  returning * into target_request;

  insert into public.audit_logs (
    actor_user_id,
    organization_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    current_user_id,
    null,
    'deletion_completed',
    'deletion_request',
    target_request.id,
    jsonb_build_object('user_id', target_request.user_id)
  );

  return target_request;
end;
$$;
