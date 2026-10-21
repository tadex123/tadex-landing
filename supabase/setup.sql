-- TADEX Hub: Supabase setup. Run once in the Supabase SQL Editor.
-- Safe to re-run.
--
-- Future NEW public tables (after 30 Oct 2026): Supabase no longer auto-GRANTs
-- anon/authenticated/service_role. Copy supabase/_template_new_table.sql and follow
-- supabase/MIGRATIONS.md — revoke + explicit GRANT + RLS. Do not re-GRANT old tables.

-- 1) Profiles: one row per auth user
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  approved    boolean not null default false,
  is_admin    boolean not null default false,
  apps        text[]  not null default '{}',
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 1b) Full name (collected on "Request access", stored in auth user metadata `full_name` too).
--     Visible through the same RLS as the rest of the row: the user themself and admins only.
alter table public.profiles add column if not exists full_name text not null default '';

-- 1c) Per-app role, e.g. {"calculator":"admin","app2":"direktor","crm":"operator"}. One role model for every
--     app: admin / direktor / operator (anything unknown = operator). Admin-only writable (RLS + grants below).
--     "komercijalist" is a legacy CRM value (= operator), still accepted; migrated to "operator" below.
alter table public.profiles add column if not exists app_roles jsonb not null default '{}'::jsonb;
alter table public.profiles drop constraint if exists profiles_app_roles_shape;
alter table public.profiles add constraint profiles_app_roles_shape check (
  jsonb_typeof(app_roles) = 'object'
  and (not app_roles ? 'calculator' or app_roles->>'calculator' in ('admin', 'direktor', 'operator'))
  and (not app_roles ? 'app2' or app_roles->>'app2' in ('admin', 'direktor', 'operator'))
  and (not app_roles ? 'crm' or app_roles->>'crm' in ('admin', 'direktor', 'operator', 'komercijalist'))
);
update public.profiles set app_roles = jsonb_set(app_roles, '{crm}', '"operator"') where app_roles->>'crm' = 'komercijalist';

-- 1d) Per-person rank (job title, e.g. Direktor, Voditelj, Komercijalista) and per-app permission
--     overrides on top of the role defaults, e.g. {"calculator":{"seeMargin":true,"editArticles":false}}.
--     The calculator reads them with the verified session and enforces them server-side. Admin-only writable.
alter table public.profiles add column if not exists rank text not null default '';
alter table public.profiles add column if not exists app_perms jsonb not null default '{}'::jsonb;
alter table public.profiles drop constraint if exists profiles_rank_len;
alter table public.profiles add constraint profiles_rank_len check (char_length(rank) <= 60);
alter table public.profiles drop constraint if exists profiles_app_perms_shape;
alter table public.profiles add constraint profiles_app_perms_shape check (
  jsonb_typeof(app_perms) = 'object'
  and (not app_perms ? 'calculator' or jsonb_typeof(app_perms->'calculator') = 'object')
  and (not app_perms ? 'app2' or jsonb_typeof(app_perms->'app2') = 'object')
);

-- 2) Helper: is the current user an admin? (security definer avoids RLS recursion)
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 3) Create a profile automatically on sign-up (unapproved, no apps).
--    Owner rule: the hub owner emails (see hub_owner_emails) become admin + approved with all apps,
--    but only once that email address is CONFIRMED (so nobody can claim it by just signing up with it).
create or replace function public.hub_owner_emails()
returns text[] language sql immutable as $$
  select array['tadijasaric92@gmail.com']::text[]
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, left(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), 120))
  on conflict (id) do nothing;
  if lower(new.email) = any (public.hub_owner_emails()) and new.email_confirmed_at is not null then
    update public.profiles set approved = true, is_admin = true, apps = array['calculator','app2','crm'], app_roles = '{"calculator":"admin","app2":"admin","crm":"admin"}'::jsonb where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- When an owner confirms their email, promote them.
create or replace function public.handle_user_confirmed()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if lower(new.email) = any (public.hub_owner_emails())
     and new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.profiles set approved = true, is_admin = true, apps = array['calculator','app2','crm'], app_roles = '{"calculator":"admin","app2":"admin","crm":"admin"}'::jsonb where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.handle_user_confirmed();

-- 4) Row Level Security
drop policy if exists "profiles: read own or admin reads all" on public.profiles;
create policy "profiles: read own or admin reads all"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles: admins update" on public.profiles;
create policy "profiles: admins update"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No insert/delete policies: rows are created by the trigger only.
-- Non-admins have no update policy at all, so they can't change approved / is_admin / apps.

-- 5) Table privileges (defence in depth on top of RLS)
-- Revoke everything first (Supabase grants ALL incl. TRUNCATE by default, and RLS does not apply to TRUNCATE).
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- Admins may change only these columns from the app. is_admin can only be changed here in the SQL Editor.
grant update (approved, apps, app_roles, rank, app_perms) on public.profiles to authenticated;

-- 6) Guard: an admin can't revoke their own approval from the app (prevents locking yourself out)
create or replace function public.guard_self_revoke()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and new.id = auth.uid() and old.approved and not new.approved then
    raise exception 'You cannot revoke your own access.';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_guard_self_revoke on public.profiles;
create trigger profiles_guard_self_revoke
  before update on public.profiles
  for each row execute function public.guard_self_revoke();

-- Trigger functions are not meant to be called directly
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.guard_self_revoke() from public, anon, authenticated;
revoke all on function public.handle_user_confirmed() from public, anon, authenticated;
revoke all on function public.hub_owner_emails() from public, anon, authenticated;
drop function if exists public.hub_owner_email();  -- replaced by hub_owner_emails()

-- 7) Owner admins: handled automatically by the triggers above once an address in
update public.profiles p
   set approved = true, is_admin = true, apps = array['calculator', 'app2', 'crm'], app_roles = '{"calculator":"admin","app2":"admin","crm":"admin"}'::jsonb
  from auth.users u
 where u.id = p.id
   and lower(u.email) = any (public.hub_owner_emails())
   and u.email_confirmed_at is not null;

-- 8) Backfill full_name for rows created before the column existed:
--    from auth metadata, else the email prefix (e.g. "ana.petrovic" -> "Ana Petrovic").
update public.profiles p
   set full_name = left(coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
                                 initcap(regexp_replace(split_part(p.email, '@', 1), '[._-]+', ' ', 'g'))), 120)
  from auth.users u
 where u.id = p.id and p.full_name = '';
update public.profiles set full_name = 'Tadija Saric'
 where lower(email) = 'tadijasaric92@gmail.com' and full_name in ('', 'Tadijasaric92');

-- 9) Backfill app_roles: every assigned app without a role gets "operator" (owner rows already set above).
update public.profiles p
   set app_roles = p.app_roles || coalesce((select jsonb_object_agg(a, 'operator') from unnest(p.apps) a
                                             where a in ('calculator', 'app2', 'crm') and not p.app_roles ? a), '{}'::jsonb)
 where exists (select 1 from unnest(p.apps) a where a in ('calculator', 'app2', 'crm') and not p.app_roles ? a);

-- 1e) TADEX CRM (hub app "crm", /kalkulator/crm). Roles in app_roles.crm:
--     operator (own clients only), direktor (all clients, assigns/reassigns, approves final invoices), admin.
--     crm_people(): colleagues who have the CRM app (for owner pickers / dispatch). Returns rows only
--     to an approved caller who has the CRM app; exposes id, email, full name and CRM role — nothing else.
create or replace function public.crm_people()
returns table (id uuid, email text, full_name text, crm_role text, is_admin boolean)
language sql stable security definer
set search_path = public
as $$
  select p.id, p.email, p.full_name, case when p.app_roles->>'crm' in ('admin', 'direktor') then p.app_roles->>'crm' else 'operator' end, p.is_admin
    from public.profiles p
   where p.approved and 'crm' = any (p.apps)
     and exists (select 1 from public.profiles me where me.id = auth.uid() and me.approved and 'crm' = any (me.apps))
   order by p.full_name, p.email;
$$;
revoke all on function public.crm_people() from public, anon;
grant execute on function public.crm_people() to authenticated;

-- 1f) Teams (approved suggestion 3, 4. 10. 2026): hub Admin assigns each Operator to ONE Direktor.
--     profiles.direktor_id = the Direktor's profile id (null = no team). A Direktor's default view in
--     Povijest kalkulacija and the CRM is their team; they can switch to "Svi" (everyone).
--     Only hub admins can set it (column grant + the existing "admins update" policy).
--     hub_my_team(): the caller's own team only (approved people whose direktor_id = caller).
alter table public.profiles add column if not exists direktor_id uuid references public.profiles (id) on delete set null;
alter table public.profiles drop constraint if exists profiles_direktor_not_self;
alter table public.profiles add constraint profiles_direktor_not_self check (direktor_id is null or direktor_id <> id);
grant update (approved, apps, app_roles, rank, app_perms, direktor_id) on public.profiles to authenticated;

create or replace function public.hub_my_team()
returns table (id uuid, email text, full_name text)
language sql stable security definer
set search_path = public
as $$
  select p.id, p.email, p.full_name
    from public.profiles p
   where p.direktor_id = auth.uid() and p.approved
     and exists (select 1 from public.profiles me where me.id = auth.uid() and me.approved)
   order by p.full_name, p.email;
$$;
revoke all on function public.hub_my_team() from public, anon;
grant execute on function public.hub_my_team() to authenticated;

-- 1g) Who's online (Admin only, 5. 10. 2026). Every signed-in, approved person's browser sends a heartbeat
--     (hub page + every app under /kalkulator) about every 45 s while the tab is visible.
--     hub_presence keeps ONE row per person: last_seen_at, where (app), signed_out_at.
--     Online = last heartbeat < 150 s ago and not signed out since. Only hub admins can read the table;
--     nobody writes it directly (no insert/update/delete policies) — only through the two functions below,
--     which only ever touch the caller's own row.
create table if not exists public.hub_presence (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  app text not null default 'hub',
  signed_out_at timestamptz
);
alter table public.hub_presence enable row level security;
revoke all on public.hub_presence from anon, authenticated;
grant select on public.hub_presence to authenticated;
drop policy if exists "presence: admins read" on public.hub_presence;
create policy "presence: admins read" on public.hub_presence for select to authenticated using (public.is_admin());

create or replace function public.hub_heartbeat(p_app text default 'hub')
returns void
language sql volatile security definer
set search_path = public
as $$
  insert into public.hub_presence as hp (user_id, last_seen_at, app, signed_out_at)
  select p.id, now(), case when p_app in ('hub', 'kalkulator', 'historija', 'crm', 'ponude') then p_app else 'hub' end, null
    from public.profiles p
   where p.id = auth.uid() and p.approved
  on conflict (user_id) do update set last_seen_at = excluded.last_seen_at, app = excluded.app, signed_out_at = null;
$$;
revoke all on function public.hub_heartbeat(text) from public, anon;
grant execute on function public.hub_heartbeat(text) to authenticated;

create or replace function public.hub_presence_signed_out()
returns void
language sql volatile security definer
set search_path = public
as $$
  update public.hub_presence set signed_out_at = now() where user_id = auth.uid();
$$;
revoke all on function public.hub_presence_signed_out() from public, anon;
grant execute on function public.hub_presence_signed_out() to authenticated;
