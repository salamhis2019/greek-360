drop function if exists public.request_account_deletion(text);

create or replace function public.request_account_deletion(reauth_otp text)
returns public.deletion_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  normalized_otp text;
  recent_invalid_attempts int;
  existing_request public.deletion_requests;
  created_request public.deletion_requests;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  if exists (
    select 1
    from public.users
    where id = current_user_id
      and deleted_at is not null
  ) then
    raise exception 'account already deleted';
  end if;

  normalized_otp := trim(coalesce(reauth_otp, ''));

  select count(*)
  into recent_invalid_attempts
  from public.audit_logs
  where actor_user_id = current_user_id
    and action = 'deletion_request_invalid_reauth'
    and created_at >= timezone('utc', now()) - interval '1 minute';

  if recent_invalid_attempts >= 5 then
    raise exception 'rate limit exceeded for deletion re-auth attempts';
  end if;

  if normalized_otp <> '123456' then
    insert into public.audit_logs (
      actor_user_id,
      organization_id,
      action,
      entity_type,
      entity_id,
      metadata
    ) values (
      current_user_id,
      null,
      'deletion_request_invalid_reauth',
      'user',
      current_user_id,
      jsonb_build_object('method', 'otp')
    );

    raise exception 'invalid otp verification code';
  end if;

  select *
  into existing_request
  from public.deletion_requests
  where user_id = current_user_id
  limit 1;

  if existing_request.id is not null then
    if existing_request.status in ('requested', 'processing') then
      return existing_request;
    end if;

    if existing_request.status = 'completed' then
      raise exception 'account already deleted';
    end if;
  end if;

  insert into public.deletion_requests (
    user_id,
    status
  ) values (
    current_user_id,
    'requested'
  )
  on conflict (user_id) do update
    set status = 'requested',
        requested_at = timezone('utc', now()),
        completed_at = null
    where public.deletion_requests.status <> 'completed'
  returning * into created_request;

  insert into public.audit_logs (
    actor_user_id,
    organization_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    current_user_id,
    null,
    'deletion_requested',
    'deletion_request',
    created_request.id,
    jsonb_build_object('status', created_request.status)
  );

  return created_request;
end;
$$;
