drop function if exists public.revoke_organization_admin(uuid, uuid);
drop function if exists public.assign_organization_admin(uuid, uuid);
drop function if exists public.create_join_link(uuid, uuid, text, boolean);
drop function if exists public.create_recruitment_cycle(uuid, text, int, text, timestamptz, timestamptz);
drop function if exists public.create_organization(uuid, text, text, text, text);
drop function if exists public.create_university(text, text, text);
drop function if exists public.assert_super_admin();

drop policy if exists organization_admins_super_admin_all on public.organization_admins;
drop policy if exists join_links_super_admin_all on public.join_links;
drop policy if exists recruitment_cycles_super_admin_all on public.recruitment_cycles;
drop policy if exists organizations_super_admin_all on public.organizations;
drop policy if exists universities_super_admin_all on public.universities;
drop policy if exists super_admin_users_super_admin_mutation on public.super_admin_users;
drop policy if exists super_admin_users_select_own on public.super_admin_users;

drop function if exists public.current_user_is_super_admin();

drop trigger if exists join_links_set_updated_at on public.join_links;
drop trigger if exists recruitment_cycles_set_updated_at on public.recruitment_cycles;
drop trigger if exists organizations_set_updated_at on public.organizations;
drop trigger if exists universities_set_updated_at on public.universities;

drop index if exists public.organizations_university_name_idx;
drop index if exists public.users_university_name_idx;

drop table if exists public.organization_admins;
drop table if exists public.join_links;
drop table if exists public.recruitment_cycles;
drop table if exists public.organizations;
drop table if exists public.universities;
drop table if exists public.super_admin_users;
