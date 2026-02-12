create table if not exists public.recruitment_decisions (
  id uuid primary key default gen_random_uuid(),
  interest_entry_id uuid not null references public.interest_entries(id) on delete cascade,
  stage text not null check (stage in ('shortlist', 'final')),
  decision text not null check (decision in ('yes', 'no')),
  decided_by uuid not null references public.users(id) on delete cascade,
  notes text,
  decided_at timestamptz not null default timezone('utc', now()),
  constraint recruitment_decisions_interest_stage_unique unique (interest_entry_id, stage)
);

create index if not exists recruitment_decisions_stage_decision_decided_at_idx
  on public.recruitment_decisions (stage, decision, decided_at desc);

alter table public.recruitment_decisions enable row level security;

create policy organization_admins_select_own on public.organization_admins
for select
using (user_id = auth.uid() or public.current_user_is_super_admin());

create policy recruitment_decisions_admin_select_org on public.recruitment_decisions
for select
using (
  public.current_user_is_super_admin()
  or exists (
    select 1
    from public.interest_entries
    join public.organization_admins
      on organization_admins.organization_id = interest_entries.organization_id
    where interest_entries.id = recruitment_decisions.interest_entry_id
      and organization_admins.user_id = auth.uid()
  )
);

create or replace function public.assert_recruitment_decision_actor(target_organization_id uuid)
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

  if public.current_user_is_super_admin() then
    return current_user_id;
  end if;

  if exists (
    select 1
    from public.organization_admins
    where organization_id = target_organization_id
      and user_id = current_user_id
  ) then
    return current_user_id;
  end if;

  raise exception 'forbidden';
end;
$$;

create or replace function public.list_recruitment_stage1_queue(
  queue_organization_id uuid,
  queue_cycle_id uuid
)
returns table (
  interest_entry_id uuid,
  user_id uuid,
  organization_id uuid,
  cycle_id uuid,
  source text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_recruitment_decision_actor(queue_organization_id);

  return query
  select
    interest_entries.id,
    interest_entries.user_id,
    interest_entries.organization_id,
    interest_entries.cycle_id,
    interest_entries.source,
    interest_entries.created_at
  from public.interest_entries
  left join public.recruitment_decisions stage1_decisions
    on stage1_decisions.interest_entry_id = interest_entries.id
    and stage1_decisions.stage = 'shortlist'
  where interest_entries.organization_id = queue_organization_id
    and interest_entries.cycle_id = queue_cycle_id
    and stage1_decisions.id is null
  order by interest_entries.created_at desc;
end;
$$;

create or replace function public.list_recruitment_stage2_queue(
  queue_organization_id uuid,
  queue_cycle_id uuid
)
returns table (
  interest_entry_id uuid,
  user_id uuid,
  organization_id uuid,
  cycle_id uuid,
  source text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_recruitment_decision_actor(queue_organization_id);

  return query
  select
    interest_entries.id,
    interest_entries.user_id,
    interest_entries.organization_id,
    interest_entries.cycle_id,
    interest_entries.source,
    interest_entries.created_at
  from public.interest_entries
  join public.recruitment_decisions stage1_decisions
    on stage1_decisions.interest_entry_id = interest_entries.id
    and stage1_decisions.stage = 'shortlist'
    and stage1_decisions.decision = 'yes'
  left join public.recruitment_decisions stage2_decisions
    on stage2_decisions.interest_entry_id = interest_entries.id
    and stage2_decisions.stage = 'final'
  where interest_entries.organization_id = queue_organization_id
    and interest_entries.cycle_id = queue_cycle_id
    and stage2_decisions.id is null
  order by interest_entries.created_at desc;
end;
$$;

create or replace function public.write_recruitment_stage1_decision(
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
  existing_decision public.recruitment_decisions;
  created_decision public.recruitment_decisions;
begin
  normalized_decision := lower(trim(coalesce(decision_value, '')));
  normalized_notes := nullif(trim(coalesce(decision_notes, '')), '');

  if normalized_decision not in ('yes', 'no') then
    raise exception 'invalid stage 1 decision';
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
  into existing_decision
  from public.recruitment_decisions
  where interest_entry_id = interest_record.id
    and stage = 'shortlist';

  if existing_decision.id is not null then
    if existing_decision.decision = normalized_decision then
      return existing_decision;
    end if;

    raise exception 'stage 1 decision already recorded';
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
      'shortlist',
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
        and stage = 'shortlist';

      if existing_decision.id is not null and existing_decision.decision = normalized_decision then
        return existing_decision;
      end if;

      raise exception 'stage 1 decision already recorded';
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
    'recruitment_stage1_decision_recorded',
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
