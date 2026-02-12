create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.interest_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cycle_id uuid not null references public.recruitment_cycles(id) on delete cascade,
  source text not null check (source in ('qr', 'manual_code')),
  created_at timestamptz not null default timezone('utc', now()),
  constraint interest_entries_user_org_cycle_unique unique (user_id, organization_id, cycle_id)
);

create index if not exists interest_entries_org_cycle_created_at_idx
  on public.interest_entries (organization_id, cycle_id, created_at desc);
create index if not exists interest_entries_user_created_at_idx
  on public.interest_entries (user_id, created_at desc);
create index if not exists audit_logs_actor_created_at_idx
  on public.audit_logs (actor_user_id, created_at desc);

alter table public.audit_logs enable row level security;
alter table public.interest_entries enable row level security;

create policy audit_logs_actor_select_own on public.audit_logs
for select
using (actor_user_id = auth.uid() or public.current_user_is_super_admin());

create policy interest_entries_student_select_own on public.interest_entries
for select
using (user_id = auth.uid());

create policy interest_entries_chapter_admin_select_org on public.interest_entries
for select
using (
  exists (
    select 1
    from public.organization_admins
    where organization_admins.organization_id = interest_entries.organization_id
      and organization_admins.user_id = auth.uid()
  )
);

create policy interest_entries_super_admin_select_all on public.interest_entries
for select
using (public.current_user_is_super_admin());

create or replace function public.resolve_active_join_link(lookup_join_code text)
returns table (
  organization_id uuid,
  cycle_id uuid,
  code text,
  organization_name text,
  cycle_term text,
  cycle_year int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text;
begin
  normalized_code := upper(trim(coalesce(lookup_join_code, '')));

  if normalized_code !~ '^[A-Z0-9]{6,12}$' then
    raise exception 'invalid join code format';
  end if;

  return query
  select
    join_links.organization_id,
    join_links.cycle_id,
    join_links.code,
    organizations.name,
    recruitment_cycles.term,
    recruitment_cycles.year
  from public.join_links
  join public.organizations on organizations.id = join_links.organization_id
  join public.recruitment_cycles on recruitment_cycles.id = join_links.cycle_id
  where join_links.code = normalized_code
    and join_links.is_active = true
    and organizations.status = 'active'
    and recruitment_cycles.status = 'active'
  limit 1;
end;
$$;

create or replace function public.submit_interest(
  submit_join_code text,
  submit_source text
)
returns table (
  id uuid,
  user_id uuid,
  organization_id uuid,
  cycle_id uuid,
  source text,
  created_at timestamptz,
  organization_name text,
  cycle_term text,
  cycle_year int,
  was_created boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  normalized_code text;
  normalized_source text;
  resolved_organization_id uuid;
  resolved_cycle_id uuid;
  resolved_is_active boolean;
  resolved_organization_status text;
  resolved_cycle_status text;
  resolved_organization_name text;
  resolved_cycle_term text;
  resolved_cycle_year int;
  recent_invalid_attempts int;
  entry_record public.interest_entries;
  created_new_entry boolean;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  normalized_code := upper(trim(coalesce(submit_join_code, '')));
  normalized_source := lower(trim(coalesce(submit_source, '')));

  if normalized_code !~ '^[A-Z0-9]{6,12}$' then
    raise exception 'invalid join code format';
  end if;

  if normalized_source not in ('qr', 'manual_code') then
    raise exception 'invalid interest source';
  end if;

  select count(*)
  into recent_invalid_attempts
  from public.audit_logs
  where actor_user_id = current_user_id
    and action in ('interest_submission_invalid_code', 'interest_submission_inactive_code')
    and created_at >= timezone('utc', now()) - interval '1 minute';

  if recent_invalid_attempts >= 5 then
    raise exception 'rate limit exceeded for join submissions';
  end if;

  select
    join_links.organization_id,
    join_links.cycle_id,
    join_links.is_active,
    organizations.status,
    recruitment_cycles.status,
    organizations.name,
    recruitment_cycles.term,
    recruitment_cycles.year
  into
    resolved_organization_id,
    resolved_cycle_id,
    resolved_is_active,
    resolved_organization_status,
    resolved_cycle_status,
    resolved_organization_name,
    resolved_cycle_term,
    resolved_cycle_year
  from public.join_links
  join public.organizations on organizations.id = join_links.organization_id
  join public.recruitment_cycles on recruitment_cycles.id = join_links.cycle_id
  where join_links.code = normalized_code
  limit 1;

  if resolved_organization_id is null then
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
      'interest_submission_invalid_code',
      'join_link',
      null,
      jsonb_build_object('join_code', normalized_code, 'source', normalized_source)
    );

    raise exception 'invalid join code';
  end if;

  if not resolved_is_active or resolved_organization_status <> 'active' or resolved_cycle_status <> 'active' then
    insert into public.audit_logs (
      actor_user_id,
      organization_id,
      action,
      entity_type,
      entity_id,
      metadata
    ) values (
      current_user_id,
      resolved_organization_id,
      'interest_submission_inactive_code',
      'join_link',
      null,
      jsonb_build_object('join_code', normalized_code, 'source', normalized_source)
    );

    raise exception 'join code inactive';
  end if;

  insert into public.interest_entries (user_id, organization_id, cycle_id, source)
  values (current_user_id, resolved_organization_id, resolved_cycle_id, normalized_source)
  on conflict (user_id, organization_id, cycle_id) do nothing
  returning * into entry_record;

  if entry_record.id is null then
    select *
    into entry_record
    from public.interest_entries
    where user_id = current_user_id
      and organization_id = resolved_organization_id
      and cycle_id = resolved_cycle_id;

    created_new_entry := false;
  else
    created_new_entry := true;
  end if;

  insert into public.audit_logs (
    actor_user_id,
    organization_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    current_user_id,
    resolved_organization_id,
    case when created_new_entry then 'interest_submitted' else 'interest_submission_duplicate' end,
    'interest_entry',
    entry_record.id,
    jsonb_build_object(
      'join_code', normalized_code,
      'source', normalized_source,
      'cycle_id', resolved_cycle_id,
      'was_created', created_new_entry
    )
  );

  return query
  select
    entry_record.id,
    entry_record.user_id,
    entry_record.organization_id,
    entry_record.cycle_id,
    entry_record.source,
    entry_record.created_at,
    resolved_organization_name,
    resolved_cycle_term,
    resolved_cycle_year,
    created_new_entry;
end;
$$;
