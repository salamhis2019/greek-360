create or replace function public.normalize_phone_e164(raw_phone text)
returns text
language plpgsql
as $$
declare
  candidate text;
  digits_only text;
begin
  candidate := trim(coalesce(raw_phone, ''));

  if candidate = '' then
    raise exception 'invalid phone number';
  end if;

  candidate := regexp_replace(candidate, '[\s().-]', '', 'g');

  if candidate like '00%' then
    candidate := '+' || substring(candidate from 3);
  end if;

  if left(candidate, 1) <> '+' then
    digits_only := regexp_replace(candidate, '\D', '', 'g');

    if length(digits_only) = 10 then
      candidate := '+1' || digits_only;
    else
      candidate := '+' || digits_only;
    end if;
  end if;

  candidate := '+' || regexp_replace(substring(candidate from 2), '\D', '', 'g');

  if candidate !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'invalid phone number';
  end if;

  return candidate;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  phone_e164 text not null unique,
  name text not null default '',
  email text,
  avatar_path text,
  university_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint users_phone_e164_format check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

create or replace function public.normalize_user_phone_e164()
returns trigger
language plpgsql
as $$
begin
  new.phone_e164 := public.normalize_phone_e164(new.phone_e164);

  if new.created_at is null then
    new.created_at := timezone('utc', now());
  end if;

  new.updated_at := timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists users_normalize_phone_e164 on public.users;

create trigger users_normalize_phone_e164
before insert or update on public.users
for each row
execute procedure public.normalize_user_phone_e164();

alter table public.users enable row level security;

create policy users_select_own on public.users
for select
using (auth.uid() = id);

create policy users_update_own on public.users
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.phone is null then
    return new;
  end if;

  insert into public.users (id, phone_e164, name, email)
  values (
    new.id,
    public.normalize_phone_e164(new.phone),
    '',
    new.email
  )
  on conflict (id) do update
    set phone_e164 = excluded.phone_e164,
        email = excluded.email,
        updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.sync_auth_user_profile();

create or replace function public.upsert_profile(profile_name text, profile_email text default null)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  updated_profile public.users;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  if length(trim(coalesce(profile_name, ''))) < 2 then
    raise exception 'display name must be at least 2 characters';
  end if;

  update public.users
  set
    name = trim(profile_name),
    email = coalesce(profile_email, email),
    updated_at = timezone('utc', now())
  where id = current_user_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'user profile not found';
  end if;

  return updated_profile;
end;
$$;
