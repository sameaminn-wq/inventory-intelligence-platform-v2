create or replace function public.save_analysis_review(
  p_analysis_session_id uuid,
  p_review_json jsonb
)
returns table (review_id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_store_id uuid;
  v_review_id uuid;
  v_created_at timestamptz;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_analysis_session_id is null
     or p_review_json is null
     or jsonb_typeof(p_review_json) <> 'object'
     or p_review_json ->> 'schemaVersion' <> 'human-review-1.0'
     or case
          when jsonb_typeof(p_review_json -> 'observations') = 'array'
          then jsonb_array_length(p_review_json -> 'observations') not between 1 and 200
          else true
        end then
    raise exception 'Invalid analysis review payload' using errcode = '22023';
  end if;

  select s.store_id
    into v_store_id
  from public.analysis_sessions s
  where s.id = p_analysis_session_id
  for update;

  if not found then
    raise exception 'Analysis session not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.store_memberships m
    where m.store_id = v_store_id
      and m.user_id = v_user_id
      and m.status = 'active'
      and m.role in ('owner', 'admin', 'manager', 'employee')
  ) then
    raise exception 'Insufficient store permissions' using errcode = '42501';
  end if;

  insert into public.analysis_reviews (
    analysis_session_id, reviewer_id, review_json
  )
  values (
    p_analysis_session_id, v_user_id, p_review_json
  )
  returning id, analysis_reviews.created_at
    into v_review_id, v_created_at;

  update public.analysis_sessions
  set status = 'reviewed',
      reviewed_at = v_created_at
  where id = p_analysis_session_id;

  return query select v_review_id, v_created_at;
end;
$function$;

revoke all on function public.save_analysis_review(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_analysis_review(uuid, jsonb)
  to authenticated;
