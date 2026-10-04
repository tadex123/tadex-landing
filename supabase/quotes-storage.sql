-- Ponude · 报价单 · Quotations (hub app "app3"): private Storage bucket for item photos.
-- The calculator server signs uploads / reads with the CALLER's token after its own access checks
-- (Operator own / Direktor team / Admin all); these policies only require an approved hub user with app3.
-- Object keys are random: q/<quote uuid>/<uuid>.jpg. Browser traffic goes through tadexhub.com/sb (proxy).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quotes', 'quotes', false, 614400, array['image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.has_app3() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.approved and 'app3' = any (p.apps));
$$;
revoke all on function public.has_app3() from public, anon;
grant execute on function public.has_app3() to authenticated;

drop policy if exists "quotes photos read" on storage.objects;
create policy "quotes photos read" on storage.objects for select to authenticated
  using (bucket_id = 'quotes' and public.has_app3());
drop policy if exists "quotes photos insert" on storage.objects;
create policy "quotes photos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'quotes' and public.has_app3() and name ~ '^q/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|webp)$');
drop policy if exists "quotes photos delete" on storage.objects;
create policy "quotes photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'quotes' and public.has_app3());
