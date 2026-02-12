drop function if exists public.search_directory_people(text, uuid);
drop view if exists public.directory_profile_memberships_v;

drop index if exists users_university_lower_name_idx;
drop index if exists organizations_university_lower_name_idx;
