do $migration$
begin
  if exists (
    select 1
    from public.analysis_reviews
    group by analysis_session_id
    having count(*) > 1
  ) then
    raise exception 'Cannot enforce one review per analysis session: duplicate reviews already exist';
  end if;
end;
$migration$;

create unique index if not exists analysis_reviews_one_per_session_idx
  on public.analysis_reviews (analysis_session_id);

revoke insert on public.analysis_reviews from authenticated;
drop policy if exists "active members can save own analysis reviews" on public.analysis_reviews;

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
  v_source_observations jsonb;
  v_item jsonb;
  v_detection_id text;
  v_seen_ids text[] := array[]::text[];
  v_source_count integer;
  v_review_count integer;
  v_quantity numeric;
  v_quantity_known boolean;
  v_existing_review_id uuid;
  v_existing_reviewer_id uuid;
  v_existing_review_json jsonb;
  v_existing_created_at timestamptz;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_analysis_session_id is null
     or p_review_json is null
     or jsonb_typeof(p_review_json) <> 'object'
     or p_review_json ->> 'schemaVersion' is distinct from 'human-review-1.0'
     or case
          when jsonb_typeof(p_review_json -> 'observations') = 'array'
          then jsonb_array_length(p_review_json -> 'observations') not between 1 and 200
          else true
        end then
    raise exception 'Invalid analysis review payload' using errcode = '22023';
  end if;

  select s.store_id, s.result_json -> 'observations'
    into v_store_id, v_source_observations
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

  if jsonb_typeof(v_source_observations) <> 'array' then
    raise exception 'Source observations are invalid' using errcode = '22023';
  end if;

  select count(*) into v_source_count
  from jsonb_array_elements(v_source_observations);
  select count(*) into v_review_count
  from jsonb_array_elements(p_review_json -> 'observations');
  if v_source_count < 1 or v_source_count > 200 or v_source_count <> v_review_count then
    raise exception 'Review must cover every source observation' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_review_json -> 'observations')
  loop
    if jsonb_typeof(v_item) <> 'object'
       or jsonb_typeof(v_item -> 'detectionId') is distinct from 'string'
       or length(v_item ->> 'detectionId') = 0
       or (v_item ->> 'detectionId') = any(v_seen_ids)
       or not (v_item ? 'verifiedQuantity')
       or jsonb_typeof(v_item -> 'verifiedQuantity') is distinct from 'null'
          and jsonb_typeof(v_item -> 'verifiedQuantity') is distinct from 'number'
       or jsonb_typeof(v_item -> 'accepted') is distinct from 'boolean'
       or (v_item ? 'note' and (jsonb_typeof(v_item -> 'note') <> 'string' or length(v_item ->> 'note') > 500)) then
      raise exception 'Invalid review observation' using errcode = '22023';
    end if;

    v_detection_id := v_item ->> 'detectionId';
    if not exists (
      select 1 from jsonb_array_elements(v_source_observations) source_item
      where source_item ->> 'detectionId' = v_detection_id
    ) then
      raise exception 'Review contains an unknown detection ID' using errcode = '22023';
    end if;

    v_quantity_known := jsonb_typeof(v_item -> 'verifiedQuantity') = 'number';
    if v_quantity_known then
      v_quantity := (v_item ->> 'verifiedQuantity')::numeric;
      if v_quantity < 0 or v_quantity > 100000 or trunc(v_quantity) <> v_quantity then
        raise exception 'Verified quantity is out of range' using errcode = '22023';
      end if;
    end if;
    if (v_item ->> 'accepted')::boolean <> v_quantity_known then
      raise exception 'Accepted flag does not match verified quantity' using errcode = '22023';
    end if;
    v_seen_ids := array_append(v_seen_ids, v_detection_id);
  end loop;

  if cardinality(v_seen_ids) <> v_source_count or
     (select count(distinct source_item ->> 'detectionId')
      from jsonb_array_elements(v_source_observations) source_item) <> v_source_count then
    raise exception 'Source observation IDs are duplicated or invalid' using errcode = '22023';
  end if;

  select r.id, r.reviewer_id, r.review_json, r.created_at
    into v_existing_review_id, v_existing_reviewer_id, v_existing_review_json, v_existing_created_at
  from public.analysis_reviews r
  where r.analysis_session_id = p_analysis_session_id
  order by r.created_at asc
  limit 1;

  if found then
    if v_existing_reviewer_id = v_user_id and v_existing_review_json = p_review_json then
      update public.analysis_sessions
      set status = 'reviewed',
          reviewed_at = v_existing_created_at
      where id = p_analysis_session_id;
      return query select v_existing_review_id, v_existing_created_at;
      return;
    end if;
    raise exception 'Analysis session already has a completed review'
      using errcode = '23505';
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

revoke update (status, reviewed_at) on public.analysis_sessions from authenticated;
drop policy if exists "active members can mark sessions reviewed" on public.analysis_sessions;
