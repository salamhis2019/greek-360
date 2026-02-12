create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint universities_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  name text not null,
  slug text not null,
  type text not null check (type in ('fraternity', 'sorority')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint organizations_university_slug_unique unique (university_id, slug),
  constraint organizations_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.recruitment_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  term text not null,
  year int not null check (year >= 2000 and year <= 2100),
  status text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint recruitment_cycles_org_term_year_unique unique (organization_id, term, year),
  constraint recruitment_cycles_term_format check (term ~ '^[a-z][a-z0-9_-]{1,31}$')
);

create table if not exists public.join_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cycle_id uuid not null references public.recruitment_cycles(id) on delete cascade,
  code text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint join_links_org_cycle_unique unique (organization_id, cycle_id),
  constraint join_links_code_format check (code ~ '^[A-Z0-9]{6,12}$')
);

create table if not exists public.organization_admins (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (organization_id, user_id)
);

create table if not exists public.super_admin_users (
  user_id uuid primary key references public.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists users_university_name_idx on public.users (university_id, name);
create index if not exists organizations_university_name_idx on public.organizations (university_id, name);

drop trigger if exists universities_set_updated_at on public.universities;
create trigger universities_set_updated_at
before update on public.universities
for each row
execute procedure public.set_updated_at();

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
before update on public.organizations
for each row
execute procedure public.set_updated_at();

drop trigger if exists recruitment_cycles_set_updated_at on public.recruitment_cycles;
create trigger recruitment_cycles_set_updated_at
before update on public.recruitment_cycles
for each row
execute procedure public.set_updated_at();

drop trigger if exists join_links_set_updated_at on public.join_links;
create trigger join_links_set_updated_at
before update on public.join_links
for each row
execute procedure public.set_updated_at();

alter table public.universities enable row level security;
alter table public.organizations enable row level security;
alter table public.recruitment_cycles enable row level security;
alter table public.join_links enable row level security;
alter table public.organization_admins enable row level security;
alter table public.super_admin_users enable row level security;

create or replace function public.current_user_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.super_admin_users
    where user_id = auth.uid()
  );
$$;

create policy super_admin_users_select_own on public.super_admin_users
for select
using (auth.uid() = user_id or public.current_user_is_super_admin());

create policy super_admin_users_super_admin_mutation on public.super_admin_users
for all
using (public.current_user_is_super_admin())
with check (public.current_user_is_super_admin());

create policy universities_super_admin_all on public.universities
for all
using (public.current_user_is_super_admin())
with check (public.current_user_is_super_admin());

create policy organizations_super_admin_all on public.organizations
for all
using (public.current_user_is_super_admin())
with check (public.current_user_is_super_admin());

create policy recruitment_cycles_super_admin_all on public.recruitment_cycles
for all
using (public.current_user_is_super_admin())
with check (public.current_user_is_super_admin());

create policy join_links_super_admin_all on public.join_links
for all
using (public.current_user_is_super_admin())
with check (public.current_user_is_super_admin());

create policy organization_admins_super_admin_all on public.organization_admins
for all
using (public.current_user_is_super_admin())
with check (public.current_user_is_super_admin());

create or replace function public.assert_super_admin()
returns uuid
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

  if not public.current_user_is_super_admin() then
    raise exception 'forbidden';
  end if;

  return current_user_id;
end;
$$;

create or replace function public.create_university(
  university_name text,
  university_slug text,
  university_status text default 'active'
)
returns public.universities
language plpgsql
security definer
set search_path = public
as $$
declare
  created_record public.universities;
  normalized_name text;
  normalized_slug text;
  normalized_status text;
begin
  perform public.assert_super_admin();

  normalized_name := trim(coalesce(university_name, ''));
  normalized_slug := lower(trim(coalesce(university_slug, '')));
  normalized_status := lower(trim(coalesce(university_status, 'active')));

  if length(normalized_name) < 2 then
    raise exception 'university name must be at least 2 characters';
  end if;

  if normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid university slug';
  end if;

  if normalized_status not in ('active', 'inactive') then
    raise exception 'invalid university status';
  end if;

  insert into public.universities (name, slug, status)
  values (normalized_name, normalized_slug, normalized_status)
  returning * into created_record;

  return created_record;
end;
$$;

create or replace function public.create_organization(
  org_university_id uuid,
  org_name text,
  org_slug text,
  org_type text,
  org_status text default 'active'
)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  created_record public.organizations;
  normalized_name text;
  normalized_slug text;
  normalized_type text;
  normalized_status text;
begin
  perform public.assert_super_admin();

  normalized_name := trim(coalesce(org_name, ''));
  normalized_slug := lower(trim(coalesce(org_slug, '')));
  normalized_type := lower(trim(coalesce(org_type, '')));
  normalized_status := lower(trim(coalesce(org_status, 'active')));

  if normalized_name = '' then
    raise exception 'organization name is required';
  end if;

  if normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid organization slug';
  end if;

  if normalized_type not in ('fraternity', 'sorority') then
    raise exception 'invalid organization type';
  end if;

  if normalized_status not in ('active', 'inactive') then
    raise exception 'invalid organization status';
  end if;

  if not exists (select 1 from public.universities where id = org_university_id) then
    raise exception 'university not found';
  end if;

  insert into public.organizations (university_id, name, slug, type, status)
  values (org_university_id, normalized_name, normalized_slug, normalized_type, normalized_status)
  returning * into created_record;

  return created_record;
end;
$$;

create or replace function public.create_recruitment_cycle(
  cycle_organization_id uuid,
  cycle_term text,
  cycle_year int,
  cycle_status text default 'draft',
  cycle_starts_at timestamptz default null,
  cycle_ends_at timestamptz default null
)
returns public.recruitment_cycles
language plpgsql
security definer
set search_path = public
as $$
declare
  created_record public.recruitment_cycles;
  normalized_term text;
  normalized_status text;
begin
  perform public.assert_super_admin();

  normalized_term := lower(trim(coalesce(cycle_term, '')));
  normalized_status := lower(trim(coalesce(cycle_status, 'draft')));

  if normalized_term !~ '^[a-z][a-z0-9_-]{1,31}$' then
    raise exception 'invalid recruitment cycle term';
  end if;

  if cycle_year < 2000 or cycle_year > 2100 then
    raise exception 'invalid recruitment cycle year';
  end if;

  if normalized_status not in ('draft', 'active', 'closed') then
    raise exception 'invalid recruitment cycle status';
  end if;

  if cycle_starts_at is not null and cycle_ends_at is not null and cycle_ends_at < cycle_starts_at then
    raise exception 'cycle end must be after cycle start';
  end if;

  if not exists (select 1 from public.organizations where id = cycle_organization_id) then
    raise exception 'organization not found';
  end if;

  insert into public.recruitment_cycles (organization_id, term, year, status, starts_at, ends_at)
  values (
    cycle_organization_id,
    normalized_term,
    cycle_year,
    normalized_status,
    cycle_starts_at,
    cycle_ends_at
  )
  returning * into created_record;

  return created_record;
end;
$$;

create or replace function public.create_join_link(
  link_organization_id uuid,
  link_cycle_id uuid,
  link_code text,
  link_is_active boolean default true
)
returns public.join_links
language plpgsql
security definer
set search_path = public
as $$
declare
  created_record public.join_links;
  normalized_code text;
begin
  perform public.assert_super_admin();

  normalized_code := upper(trim(coalesce(link_code, '')));

  if normalized_code !~ '^[A-Z0-9]{6,12}$' then
    raise exception 'invalid join code';
  end if;

  if not exists (
    select 1
    from public.recruitment_cycles
    where id = link_cycle_id and organization_id = link_organization_id
  ) then
    raise exception 'recruitment cycle not found for organization';
  end if;

  insert into public.join_links (organization_id, cycle_id, code, is_active)
  values (link_organization_id, link_cycle_id, normalized_code, coalesce(link_is_active, true))
  returning * into created_record;

  return created_record;
end;
$$;

create or replace function public.assign_organization_admin(
  target_organization_id uuid,
  target_user_id uuid
)
returns public.organization_admins
language plpgsql
security definer
set search_path = public
as $$
declare
  created_record public.organization_admins;
begin
  perform public.assert_super_admin();

  if not exists (select 1 from public.organizations where id = target_organization_id) then
    raise exception 'organization not found';
  end if;

  if not exists (select 1 from public.users where id = target_user_id) then
    raise exception 'user not found';
  end if;

  insert into public.organization_admins (organization_id, user_id)
  values (target_organization_id, target_user_id)
  returning * into created_record;

  return created_record;
end;
$$;

create or replace function public.revoke_organization_admin(
  target_organization_id uuid,
  target_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_super_admin();

  delete from public.organization_admins
  where organization_id = target_organization_id and user_id = target_user_id;

  return found;
end;
$$;
