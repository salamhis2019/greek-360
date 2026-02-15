drop function if exists public.list_organization_members(uuid);
drop function if exists public.list_my_admin_cycles();
drop function if exists public.list_my_student_home_summary();
drop function if exists public.list_my_memberships();
drop function if exists public.list_my_offers();

create or replace function public.list_my_offers()
returns table (
  offer_id uuid,
  interest_entry_id uuid,
  user_id uuid,
  organization_id uuid,
  organization_name text,
  cycle_id uuid,
  cycle_term text,
  cycle_year int,
  offer_status text,
  offered_at timestamptz,
  responded_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  return query
  select
    offers.id,
    offers.interest_entry_id,
    interest_entries.user_id,
    interest_entries.organization_id,
    organizations.name,
    interest_entries.cycle_id,
    recruitment_cycles.term,
    recruitment_cycles.year,
    offers.status,
    offers.offered_at,
    offers.responded_at
  from public.offers
  join public.interest_entries
    on interest_entries.id = offers.interest_entry_id
  join public.organizations
    on organizations.id = interest_entries.organization_id
  join public.recruitment_cycles
    on recruitment_cycles.id = interest_entries.cycle_id
  where interest_entries.user_id = current_user_id
  order by offers.offered_at desc;
end;
$$;

create or replace function public.list_my_memberships()
returns table (
  membership_id uuid,
  user_id uuid,
  organization_id uuid,
  organization_name text,
  membership_status text,
  membership_joined_at timestamptz,
  membership_ended_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  return query
  select
    memberships.id,
    memberships.user_id,
    memberships.organization_id,
    organizations.name,
    memberships.status,
    memberships.joined_at,
    memberships.ended_at
  from public.memberships
  join public.organizations
    on organizations.id = memberships.organization_id
  where memberships.user_id = current_user_id
  order by memberships.joined_at desc;
end;
$$;

create or replace function public.list_my_student_home_summary()
returns table (
  interest_entry_id uuid,
  organization_id uuid,
  organization_name text,
  cycle_id uuid,
  cycle_term text,
  cycle_year int,
  submitted_at timestamptz,
  offer_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  return query
  select
    interest_entries.id,
    interest_entries.organization_id,
    organizations.name,
    interest_entries.cycle_id,
    recruitment_cycles.term,
    recruitment_cycles.year,
    interest_entries.created_at,
    offers.status
  from public.interest_entries
  join public.organizations
    on organizations.id = interest_entries.organization_id
  join public.recruitment_cycles
    on recruitment_cycles.id = interest_entries.cycle_id
  left join public.offers
    on offers.interest_entry_id = interest_entries.id
  where interest_entries.user_id = current_user_id
  order by interest_entries.created_at desc;
end;
$$;

create or replace function public.list_my_admin_cycles()
returns table (
  organization_id uuid,
  organization_name text,
  cycle_id uuid,
  cycle_term text,
  cycle_year int,
  cycle_status text,
  stage1_pending_count int,
  stage2_pending_count int,
  pending_offers_count int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  if not public.current_user_is_super_admin()
    and not exists (
      select 1
      from public.organization_admins
      where organization_admins.user_id = current_user_id
    ) then
    raise exception 'forbidden';
  end if;

  return query
  select
    recruitment_cycles.organization_id,
    organizations.name,
    recruitment_cycles.id,
    recruitment_cycles.term,
    recruitment_cycles.year,
    recruitment_cycles.status,
    (
      select count(*)
      from public.interest_entries
      left join public.recruitment_decisions stage1_decisions
        on stage1_decisions.interest_entry_id = interest_entries.id
        and stage1_decisions.stage = 'shortlist'
      where interest_entries.organization_id = recruitment_cycles.organization_id
        and interest_entries.cycle_id = recruitment_cycles.id
        and stage1_decisions.id is null
    )::int,
    (
      select count(*)
      from public.interest_entries
      join public.recruitment_decisions stage1_decisions
        on stage1_decisions.interest_entry_id = interest_entries.id
        and stage1_decisions.stage = 'shortlist'
        and stage1_decisions.decision = 'yes'
      left join public.recruitment_decisions stage2_decisions
        on stage2_decisions.interest_entry_id = interest_entries.id
        and stage2_decisions.stage = 'final'
      where interest_entries.organization_id = recruitment_cycles.organization_id
        and interest_entries.cycle_id = recruitment_cycles.id
        and stage2_decisions.id is null
    )::int,
    (
      select count(*)
      from public.offers
      join public.interest_entries
        on interest_entries.id = offers.interest_entry_id
      where interest_entries.organization_id = recruitment_cycles.organization_id
        and interest_entries.cycle_id = recruitment_cycles.id
        and offers.status = 'pending'
    )::int
  from public.recruitment_cycles
  join public.organizations
    on organizations.id = recruitment_cycles.organization_id
  where public.current_user_is_super_admin()
    or exists (
      select 1
      from public.organization_admins
      where organization_admins.organization_id = recruitment_cycles.organization_id
        and organization_admins.user_id = current_user_id
    )
  order by organizations.name asc, recruitment_cycles.year desc, recruitment_cycles.term asc;
end;
$$;

create or replace function public.list_organization_members(target_organization_id uuid)
returns table (
  user_id uuid,
  name text,
  phone_e164 text,
  email text,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_organization_id is null then
    raise exception 'organization id is required';
  end if;

  perform public.assert_recruitment_decision_actor(target_organization_id);

  return query
  select
    users.id,
    users.name,
    users.phone_e164,
    users.email,
    memberships.joined_at
  from public.memberships
  join public.users
    on users.id = memberships.user_id
  where memberships.organization_id = target_organization_id
    and memberships.status = 'active'
    and users.deleted_at is null
  order by users.name asc, memberships.joined_at asc;
end;
$$;
