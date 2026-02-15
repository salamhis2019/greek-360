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
  cycle_id uuid,
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
    interest_entries.cycle_id,
    offers.status,
    offers.offered_at,
    offers.responded_at
  from public.offers
  join public.interest_entries
    on interest_entries.id = offers.interest_entry_id
  where interest_entries.user_id = current_user_id
  order by offers.offered_at desc;
end;
$$;

create or replace function public.list_my_memberships()
returns table (
  membership_id uuid,
  user_id uuid,
  organization_id uuid,
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
    memberships.status,
    memberships.joined_at,
    memberships.ended_at
  from public.memberships
  where memberships.user_id = current_user_id
  order by memberships.joined_at desc;
end;
$$;
