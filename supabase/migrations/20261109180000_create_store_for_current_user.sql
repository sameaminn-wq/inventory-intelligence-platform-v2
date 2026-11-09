create or replace function public.create_store_for_current_user(
  p_name text,
  p_slug text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_store_id uuid;
  v_name text;
  v_slug text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_name := btrim(coalesce(p_name, ''));
  v_slug := lower(btrim(coalesce(p_slug, '')));

  if char_length(v_name) < 1 or char_length(v_name) > 160 then
    raise exception 'Store name must contain between 1 and 160 characters'
      using errcode = '22023';
  end if;

  if char_length(v_slug) < 3 or char_length(v_slug) > 80
     or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Store slug must be 3-80 lowercase letters, numbers, or single hyphens'
      using errcode = '22023';
  end if;

  insert into public.stores (name, slug, status, created_by)
  values (v_name, v_slug, 'active', v_user_id)
  returning id into v_store_id;

  insert into public.store_memberships (store_id, user_id, role, status)
  values (v_store_id, v_user_id, 'owner', 'active');

  insert into public.store_membership_audit (
    store_id, actor_user_id, target_user_id, action,
    new_role, new_status
  )
  values (
    v_store_id, v_user_id, v_user_id, 'membership_added',
    'owner', 'active'
  );

  return v_store_id;
end;
$function$;

revoke all on function public.create_store_for_current_user(text, text)
  from public, anon, authenticated;
grant execute on function public.create_store_for_current_user(text, text)
  to authenticated;
