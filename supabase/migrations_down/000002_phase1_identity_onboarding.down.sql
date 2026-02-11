drop function if exists public.upsert_profile(text, text);

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.sync_auth_user_profile();

drop policy if exists users_update_own on public.users;
drop policy if exists users_select_own on public.users;

drop trigger if exists users_normalize_phone_e164 on public.users;
drop function if exists public.normalize_user_phone_e164();

drop table if exists public.users;

drop function if exists public.normalize_phone_e164(text);
