create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  interest_entry_id uuid not null unique references public.interest_entries(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined', 'expired')),
  offered_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null check (status in ('active', 'inactive')),
  joined_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz
);

create index if not exists memberships_organization_status_idx
  on public.memberships (organization_id, status);
create index if not exists memberships_user_status_idx
  on public.memberships (user_id, status);
create unique index if not exists memberships_user_active_unique_idx
  on public.memberships (user_id)
  where status = 'active';

alter table public.offers enable row level security;
alter table public.memberships enable row level security;

create policy offers_student_select_own on public.offers
for select
using (
  exists (
    select 1
    from public.interest_entries
    where interest_entries.id = offers.interest_entry_id
      and interest_entries.user_id = auth.uid()
  )
);

create policy offers_chapter_admin_select_org on public.offers
for select
using (
  public.current_user_is_super_admin()
  or exists (
    select 1
    from public.interest_entries
    join public.organization_admins
      on organization_admins.organization_id = interest_entries.organization_id
    where interest_entries.id = offers.interest_entry_id
      and organization_admins.user_id = auth.uid()
  )
);

create policy offers_super_admin_select_all on public.offers
for select
using (public.current_user_is_super_admin());

create policy memberships_student_select_own on public.memberships
for select
using (user_id = auth.uid());

create policy memberships_chapter_admin_select_org on public.memberships
for select
using (
  public.current_user_is_super_admin()
  or exists (
    select 1
    from public.organization_admins
    where organization_admins.organization_id = memberships.organization_id
      and organization_admins.user_id = auth.uid()
  )
);

create policy memberships_super_admin_select_all on public.memberships
for select
using (public.current_user_is_super_admin());

create or replace function public.list_my_offers()
returns table (
  offer_id uuid,
  interest_entry_id uuid,
  user_id uuid,
  organization_id uuid,
  cycle_id uuid,
  offer_status text,
  offered_at timestamptz,
  responded_at timestamptz
)
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

  return query
  select
    offers.id,
    offers.interest_entry_id,
    interest_entries.user_id,
    interest_entries.organization_id,
    interest_entries.cycle_id,
    offers.status,
    offers.offered_at,
    offers.responded_at
  from public.offers
  join public.interest_entries
    on interest_entries.id = offers.interest_entry_id
  where interest_entries.user_id = current_user_id
  order by offers.offered_at desc;
end;
$$;

create or replace function public.list_my_memberships()
returns table (
  membership_id uuid,
  user_id uuid,
  organization_id uuid,
  membership_status text,
  membership_joined_at timestamptz,
  membership_ended_at timestamptz
)
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

  return query
  select
    memberships.id,
    memberships.user_id,
    memberships.organization_id,
    memberships.status,
    memberships.joined_at,
    memberships.ended_at
  from public.memberships
  where memberships.user_id = current_user_id
  order by memberships.joined_at desc;
end;
$$;

create or replace function public.create_offer_for_final_yes(target_interest_entry_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  interest_record public.interest_entries;
  final_decision public.recruitment_decisions;
  existing_offer public.offers;
  created_offer public.offers;
begin
  select *
  into interest_record
  from public.interest_entries
  where id = target_interest_entry_id
  for update;

  if interest_record.id is null then
    raise exception 'interest entry not found';
  end if;

  current_user_id := public.assert_recruitment_decision_actor(interest_record.organization_id);

  select *
  into final_decision
  from public.recruitment_decisions
  where interest_entry_id = interest_record.id
    and stage = 'final';

  if final_decision.id is null or final_decision.decision <> 'yes' then
    raise exception 'final yes decision required';
  end if;

  select *
  into existing_offer
  from public.offers
  where interest_entry_id = interest_record.id;

  if existing_offer.id is not null then
    return existing_offer;
  end if;

  begin
    insert into public.offers (interest_entry_id, status, offered_at)
    values (interest_record.id, 'pending', timezone('utc', now()))
    returning * into created_offer;
  exception
    when unique_violation then
      select *
      into existing_offer
      from public.offers
      where interest_entry_id = interest_record.id;

      if existing_offer.id is not null then
        return existing_offer;
      end if;

      raise;
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
    'offer_created',
    'offer',
    created_offer.id,
    jsonb_build_object(
      'interest_entry_id', interest_record.id,
      'status', created_offer.status
    )
  );

  return created_offer;
end;
$$;

create or replace function public.respond_to_offer(
  target_offer_id uuid,
  offer_response text
)
returns table (
  offer_id uuid,
  interest_entry_id uuid,
  user_id uuid,
  organization_id uuid,
  cycle_id uuid,
  offer_status text,
  offered_at timestamptz,
  responded_at timestamptz,
  membership_id uuid,
  membership_status text,
  membership_joined_at timestamptz,
  membership_ended_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  normalized_response text;
  selected_interest_entry_id uuid;
  selected_offer_status text;
  selected_offered_at timestamptz;
  selected_responded_at timestamptz;
  selected_user_id uuid;
  selected_organization_id uuid;
  selected_cycle_id uuid;
  updated_offer public.offers;
  existing_membership public.memberships;
  created_membership public.memberships;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  normalized_response := lower(trim(coalesce(offer_response, '')));

  if normalized_response not in ('accept', 'decline') then
    raise exception 'invalid offer response';
  end if;

  select
    offers.interest_entry_id,
    offers.status,
    offers.offered_at,
    offers.responded_at,
    interest_entries.user_id,
    interest_entries.organization_id,
    interest_entries.cycle_id
  into
    selected_interest_entry_id,
    selected_offer_status,
    selected_offered_at,
    selected_responded_at,
    selected_user_id,
    selected_organization_id,
    selected_cycle_id
  from public.offers
  join public.interest_entries
    on interest_entries.id = offers.interest_entry_id
  where offers.id = target_offer_id
  for update;

  if selected_interest_entry_id is null then
    raise exception 'offer not found';
  end if;

  if selected_user_id <> current_user_id then
    raise exception 'forbidden';
  end if;

  if normalized_response = 'decline' then
    if selected_offer_status = 'declined' then
      return query
      select
        target_offer_id,
        selected_interest_entry_id,
        selected_user_id,
        selected_organization_id,
        selected_cycle_id,
        selected_offer_status,
        selected_offered_at,
        selected_responded_at,
        null::uuid,
        null::text,
        null::timestamptz,
        null::timestamptz;
      return;
    end if;

    if selected_offer_status <> 'pending' then
      raise exception 'offer is not pending';
    end if;

    update public.offers
    set status = 'declined',
        responded_at = timezone('utc', now())
    where id = target_offer_id
    returning * into updated_offer;

    insert into public.audit_logs (
      actor_user_id,
      organization_id,
      action,
      entity_type,
      entity_id,
      metadata
    ) values (
      current_user_id,
      selected_organization_id,
      'offer_declined',
      'offer',
      updated_offer.id,
      jsonb_build_object(
        'interest_entry_id', updated_offer.interest_entry_id,
        'status', updated_offer.status
      )
    );

    return query
    select
      updated_offer.id,
      updated_offer.interest_entry_id,
      selected_user_id,
      selected_organization_id,
      selected_cycle_id,
      updated_offer.status,
      updated_offer.offered_at,
      updated_offer.responded_at,
      null::uuid,
      null::text,
      null::timestamptz,
      null::timestamptz;
    return;
  end if;

  if selected_offer_status = 'accepted' then
    select *
    into existing_membership
    from public.memberships
    where user_id = current_user_id
      and organization_id = selected_organization_id
      and status = 'active'
    order by joined_at desc
    limit 1;

    return query
    select
      target_offer_id,
      selected_interest_entry_id,
      selected_user_id,
      selected_organization_id,
      selected_cycle_id,
      selected_offer_status,
      selected_offered_at,
      selected_responded_at,
      existing_membership.id,
      existing_membership.status,
      existing_membership.joined_at,
      existing_membership.ended_at;
    return;
  end if;

  if selected_offer_status <> 'pending' then
    raise exception 'offer is not pending';
  end if;

  select *
  into existing_membership
  from public.memberships
  where user_id = current_user_id
    and status = 'active'
  limit 1;

  if existing_membership.id is not null then
    raise exception 'active membership already exists';
  end if;

  update public.offers
  set status = 'accepted',
      responded_at = timezone('utc', now())
  where id = target_offer_id
  returning * into updated_offer;

  begin
    insert into public.memberships (
      user_id,
      organization_id,
      status,
      joined_at
    ) values (
      current_user_id,
      selected_organization_id,
      'active',
      timezone('utc', now())
    )
    returning * into created_membership;
  exception
    when unique_violation then
      raise exception 'active membership already exists';
  end;

  update public.offers
  set status = 'expired',
      responded_at = coalesce(responded_at, timezone('utc', now()))
  where id <> updated_offer.id
    and status = 'pending'
    and exists (
      select 1
      from public.interest_entries
      where interest_entries.id = offers.interest_entry_id
        and interest_entries.user_id = current_user_id
    );

  insert into public.audit_logs (
    actor_user_id,
    organization_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    current_user_id,
    selected_organization_id,
    'offer_accepted',
    'offer',
    updated_offer.id,
    jsonb_build_object(
      'interest_entry_id', updated_offer.interest_entry_id,
      'status', updated_offer.status
    )
  );

  insert into public.audit_logs (
    actor_user_id,
    organization_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    current_user_id,
    selected_organization_id,
    'membership_activated',
    'membership',
    created_membership.id,
    jsonb_build_object(
      'offer_id', updated_offer.id,
      'user_id', current_user_id
    )
  );

  return query
  select
    updated_offer.id,
    updated_offer.interest_entry_id,
    selected_user_id,
    selected_organization_id,
    selected_cycle_id,
    updated_offer.status,
    updated_offer.offered_at,
    updated_offer.responded_at,
    created_membership.id,
    created_membership.status,
    created_membership.joined_at,
    created_membership.ended_at;
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
      if existing_decision.decision = 'yes' then
        perform public.create_offer_for_final_yes(interest_record.id);
      end if;

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
        if existing_decision.decision = 'yes' then
          perform public.create_offer_for_final_yes(interest_record.id);
        end if;

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

  if created_decision.decision = 'yes' then
    perform public.create_offer_for_final_yes(interest_record.id);
  end if;

  return created_decision;
end;
$$;
