create or replace function public.write_recruitment_stage2_decision(
  decision_interest_entry_id uuid,
  decision_value text,
  decision_notes text default null
)
returns public.recruitment_decisions
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  normalized_decision text;
  normalized_notes text;
  interest_record public.interest_entries;
  stage1_decision public.recruitment_decisions;
  existing_decision public.recruitment_decisions;
  created_decision public.recruitment_decisions;
begin
  normalized_decision := lower(trim(coalesce(decision_value, '')));
  normalized_notes := nullif(trim(coalesce(decision_notes, '')), '');

  if normalized_decision not in ('yes', 'no') then
    raise exception 'invalid stage 2 decision';
  end if;

  select *
  into interest_record
  from public.interest_entries
  where id = decision_interest_entry_id
  for update;

  if interest_record.id is null then
    raise exception 'interest entry not found';
  end if;

  current_user_id := public.assert_recruitment_decision_actor(interest_record.organization_id);

  select *
  into stage1_decision
  from public.recruitment_decisions
  where interest_entry_id = interest_record.id
    and stage = 'shortlist';

  if stage1_decision.id is null or stage1_decision.decision <> 'yes' then
    raise exception 'stage 2 requires shortlist yes first';
  end if;

  select *
  into existing_decision
  from public.recruitment_decisions
  where interest_entry_id = interest_record.id
    and stage = 'final';

  if existing_decision.id is not null then
    if existing_decision.decision = normalized_decision then
      return existing_decision;
    end if;

    raise exception 'stage 2 decision already recorded';
  end if;

  begin
    insert into public.recruitment_decisions (
      interest_entry_id,
      stage,
      decision,
      decided_by,
      notes
    ) values (
      interest_record.id,
      'final',
      normalized_decision,
      current_user_id,
      normalized_notes
    )
    returning * into created_decision;
  exception
    when unique_violation then
      select *
      into existing_decision
      from public.recruitment_decisions
      where interest_entry_id = interest_record.id
        and stage = 'final';

      if existing_decision.id is not null and existing_decision.decision = normalized_decision then
        return existing_decision;
      end if;

      raise exception 'stage 2 decision already recorded';
  end;

  insert into public.audit_logs (
    actor_user_id,
    organization_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    current_user_id,
    interest_record.organization_id,
    'recruitment_stage2_decision_recorded',
    'recruitment_decision',
    created_decision.id,
    jsonb_build_object(
      'interest_entry_id', interest_record.id,
      'stage', created_decision.stage,
      'decision', created_decision.decision
    )
  );

  return created_decision;
end;
$$;

drop function if exists public.respond_to_offer(uuid, text);
drop function if exists public.create_offer_for_final_yes(uuid);
drop function if exists public.list_my_memberships();
drop function if exists public.list_my_offers();

drop policy if exists memberships_super_admin_select_all on public.memberships;
drop policy if exists memberships_chapter_admin_select_org on public.memberships;
drop policy if exists memberships_student_select_own on public.memberships;
drop policy if exists offers_super_admin_select_all on public.offers;
drop policy if exists offers_chapter_admin_select_org on public.offers;
drop policy if exists offers_student_select_own on public.offers;

drop index if exists public.memberships_user_active_unique_idx;
drop index if exists public.memberships_user_status_idx;
drop index if exists public.memberships_organization_status_idx;

drop table if exists public.memberships;
drop table if exists public.offers;
