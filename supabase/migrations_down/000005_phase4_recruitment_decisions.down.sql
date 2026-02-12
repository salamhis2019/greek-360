drop function if exists public.write_recruitment_stage2_decision(uuid, text, text);
drop function if exists public.write_recruitment_stage1_decision(uuid, text, text);
drop function if exists public.list_recruitment_stage2_queue(uuid, uuid);
drop function if exists public.list_recruitment_stage1_queue(uuid, uuid);
drop function if exists public.assert_recruitment_decision_actor(uuid);

drop policy if exists recruitment_decisions_admin_select_org on public.recruitment_decisions;
drop policy if exists organization_admins_select_own on public.organization_admins;

drop index if exists public.recruitment_decisions_stage_decision_decided_at_idx;
drop table if exists public.recruitment_decisions;
