-- TADEX Hub: which company side(s) a person can use — any of 'tadex', 'strong', 'ruyi'.
-- Idempotent. Run in the Supabase SQL Editor when the Strong apps go live (not before).
-- Admins (is_admin) always see all sides regardless of this column. Everyone sees every side in the hub;
-- sides without access are shown locked, and the app servers refuse them.

alter table public.profiles add column if not exists companies text[] not null default array['tadex'];

alter table public.profiles drop constraint if exists profiles_companies_shape;
alter table public.profiles add constraint profiles_companies_shape check (
  cardinality(companies) between 1 and 3 and companies <@ array['tadex','strong','ruyi']
);

-- Admin panel edits this column (RLS "profiles: admins update" already limits who can update).
grant update (companies) on public.profiles to authenticated;

-- Aida (sales@tadexgroup.ba) works on both sides. Owner too.
update public.profiles set companies = array['tadex','strong']
 where lower(email) in ('sales@tadexgroup.ba', 'tadijasaric92@gmail.com');
