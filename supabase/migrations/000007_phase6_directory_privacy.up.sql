create or replace view public.directory_profile_memberships_v as
select
  users.id as user_id,
  coalesce(
    users.university_id,
    active_membership_data.university_id,
    interest_university_data.university_id
  ) as university_id,
  users.name,
  users.avatar_path,
  users.phone_e164,
  users.email,
  active_membership_data.organization_ids,
  active_membership_data.organization_names
from public.users
left join lateral (
  select
    (array_agg(organizations.university_id order by organizations.university_id))[1] as university_id,
    coalesce(array_agg(distinct memberships.organization_id), array[]::uuid[]) as organization_ids,
    coalesce(array_agg(distinct organizations.name), array[]::text[]) as organization_names
  from public.memberships
  join public.organizations
    on organizations.id = memberships.organization_id
  where memberships.user_id = users.id
    and memberships.status = 'active'
) as active_membership_data on true
left join lateral (
  select (array_agg(organizations.university_id order by organizations.university_id))[1] as university_id
  from public.interest_entries
  join public.organizations
    on organizations.id = interest_entries.organization_id
  where interest_entries.user_id = users.id
) as interest_university_data on true
where users.deleted_at is null;

create index if not exists users_university_lower_name_idx
  on public.users (university_id, lower(name));

create index if not exists organizations_university_lower_name_idx
  on public.organizations (university_id, lower(name));

create or replace function public.search_directory_people(
  lookup_search text default null,
  filter_organization_id uuid default null
)
returns table (
  user_id uuid,
  university_id uuid,
  name text,
  avatar_path text,
  organization_ids uuid[],
  organization_names text[],
  phone_e164 text,
  email text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  current_university_id uuid;
  current_org_ids uuid[];
  normalized_search text;
  super_admin_access boolean;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  normalized_search := nullif(lower(trim(coalesce(lookup_search, ''))), '');
  super_admin_access := public.current_user_is_super_admin();

  select directory_profile_memberships_v.university_id
  into current_university_id
  from public.directory_profile_memberships_v
  where directory_profile_memberships_v.user_id = current_user_id
  limit 1;

  if current_university_id is null and not super_admin_access then
    return;
  end if;

  select coalesce(array_agg(distinct memberships.organization_id), array[]::uuid[])
  into current_org_ids
  from public.memberships
  where memberships.user_id = current_user_id
    and memberships.status = 'active';

  return query
  select
    profile.user_id,
    profile.university_id,
    profile.name,
    profile.avatar_path,
    profile.organization_ids,
    profile.organization_names,
    case
      when super_admin_access
        or profile.user_id = current_user_id
        or profile.organization_ids && current_org_ids
      then profile.phone_e164
      else null
    end as phone_e164,
    case
      when super_admin_access
        or profile.user_id = current_user_id
        or profile.organization_ids && current_org_ids
      then profile.email
      else null
    end as email
  from public.directory_profile_memberships_v as profile
  where
    (super_admin_access or profile.university_id = current_university_id)
    and (filter_organization_id is null or filter_organization_id = any(profile.organization_ids))
    and (
      normalized_search is null
      or lower(profile.name) like '%' || normalized_search || '%'
      or exists (
        select 1
        from unnest(profile.organization_names) as organization_name
        where lower(organization_name) like '%' || normalized_search || '%'
      )
    )
  order by lower(profile.name), profile.user_id;
end;
$$;
