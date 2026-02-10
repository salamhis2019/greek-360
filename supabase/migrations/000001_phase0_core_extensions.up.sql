create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

create or replace function public.set_created_at()
returns trigger
language plpgsql
as $$
begin
  if new.created_at is null then
    new.created_at := timezone('utc', now());
  end if;

  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;
