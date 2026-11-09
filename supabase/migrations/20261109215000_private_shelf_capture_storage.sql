insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shelf-captures', 'shelf-captures', false, 20971520, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "store members can read shelf captures" on storage.objects;
create policy "store members can read shelf captures"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'shelf-captures'
    and exists (
      select 1 from public.store_memberships m
      where m.store_id::text = (storage.foldername(name))[1]
        and m.user_id = (select auth.uid())
        and m.status = 'active'
    )
  );

drop policy if exists "members can upload own shelf captures" on storage.objects;
create policy "members can upload own shelf captures"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shelf-captures'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (
      select 1 from public.store_memberships m
      where m.store_id::text = (storage.foldername(name))[1]
        and m.user_id = (select auth.uid())
        and m.status = 'active'
        and m.role in ('owner','admin','manager','employee')
    )
  );
