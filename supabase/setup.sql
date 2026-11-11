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
--     editRates and seeRates are not overridable: section 1h forces both true for every profile
--     (EUR/USD kurs is open for every approved member). A stored false blocks that person.
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

-- 1h) EUR/USD kurs is open for every member (editRates / seeRates forced true).
--     Same SQL as supabase/direktor-team-kurs.sql — keep them in sync when editing.
create or replace function public.hub_open_kurs_perms(p jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  -- jsonb_set will not create a missing parent key, so '{}' would stay locked.
  -- Merge onto calculator and keep every other permission on that object.
  select jsonb_set(
    coalesce(p, '{}'::jsonb),
    '{calculator}',
    coalesce(p -> 'calculator', '{}'::jsonb)
      || jsonb_build_object('editRates', true, 'seeRates', true),
    true
  );
$$;
revoke all on function public.hub_open_kurs_perms(jsonb) from public, anon, authenticated;

create or replace function public.hub_force_open_kurs()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.app_perms := public.hub_open_kurs_perms(new.app_perms);
  return new;
end;
$$;
revoke all on function public.hub_force_open_kurs() from public, anon, authenticated;

drop trigger if exists profiles_kurs_open on public.profiles;
create trigger profiles_kurs_open
  before insert or update of app_perms on public.profiles
  for each row execute function public.hub_force_open_kurs();

update public.profiles
   set app_perms = public.hub_open_kurs_perms(app_perms);

create or replace function public.hub_is_calculator_direktor()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles me
     where me.id = auth.uid()
       and me.approved
       and (me.app_roles ->> 'calculator') = 'direktor'
  );
$$;
revoke all on function public.hub_is_calculator_direktor() from public, anon;
grant execute on function public.hub_is_calculator_direktor() to authenticated;

create or replace function public.hub_direktor_team_kurs()
returns table (
  id uuid,
  email text,
  full_name text,
  edit_rates text,
  see_rates text
)
language sql stable security definer
set search_path = public
as $$
  select
    p.id,
    p.email,
    p.full_name,
    case
      when (p.app_perms -> 'calculator') ? 'editRates'
        then case when (p.app_perms -> 'calculator' ->> 'editRates')::boolean then 'allow' else 'deny' end
      else ''
    end as edit_rates,
    case
      when (p.app_perms -> 'calculator') ? 'seeRates'
        then case when (p.app_perms -> 'calculator' ->> 'seeRates')::boolean then 'allow' else 'deny' end
      else ''
    end as see_rates
  from public.profiles p
  where p.direktor_id = auth.uid()
    and p.approved
    and public.hub_is_calculator_direktor()
  order by p.full_name nulls last, p.email;
$$;
revoke all on function public.hub_direktor_team_kurs() from public, anon;
grant execute on function public.hub_direktor_team_kurs() to authenticated;

create or replace function public.hub_direktor_set_team_kurs(
  p_member uuid,
  p_key text,
  p_value text
)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_perms jsonb;
  v_norm text;
begin
  if p_key is null or p_key not in ('editRates', 'seeRates') then
    raise exception 'invalid key';
  end if;
  v_norm := lower(coalesce(p_value, ''));
  if v_norm not in ('allow', 'deny', 'default', '') then
    raise exception 'invalid value';
  end if;
  if not public.hub_is_calculator_direktor() then
    raise exception 'only a calculator Direktor can change team kurs permissions';
  end if;
  if not exists (
    select 1 from public.profiles m
     where m.id = p_member and m.approved and m.direktor_id = auth.uid()
  ) then
    raise exception 'person is not on your team';
  end if;

  select coalesce(app_perms, '{}'::jsonb)
    into v_perms
    from public.profiles
   where id = p_member
   for update;

  v_perms := public.hub_open_kurs_perms(v_perms);

  update public.profiles
     set app_perms = v_perms
   where id = p_member;

  return v_perms;
end;
$$;
revoke all on function public.hub_direktor_set_team_kurs(uuid, text, text) from public, anon;
grant execute on function public.hub_direktor_set_team_kurs(uuid, text, text) to authenticated;

-- 1i) Email kontakti (hub tile). Canonical copy: supabase/email-kontakti.sql.
--     Inlined so a full setup.sql re-run creates the same table.
--     Does not update or delete existing rows.

-- TADEX Hub · Email kontakti
-- Project: tadex-hub (ref ichcxptnnzakwzlmixvk).
-- Run this file in the Supabase SQL Editor. The same SQL is inlined at the
-- bottom of setup.sql so a full hub schema re-run creates the same table.
--
-- New table only. Does not UPDATE or DELETE existing rows.
-- One contact belongs to one brand (tadex | strong) and one country (HR | BA).
-- Deal / predračun values are optional text. CRM deals live on Neon, not here.
--
-- Last sent email stores date, subject, from_address (mailbox it was sent from)
-- and sent_by (colleague, e.g. Tadija, Aida, Magdalena, Mladen).
-- Both new columns stay null until a send is recorded. A date or subject
-- requires from_address and sent_by (email_contacts_send_record).

create table if not exists public.email_contacts (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  country text not null,
  company_name text,
  first_name text,
  last_name text,
  job_title text,
  email text,
  phone text,
  city text,
  language text,
  what_they_buy text,
  owner_name text,
  last_email_on date,
  last_email_subject text,
  from_address text,
  sent_by text,
  status text,
  next_follow_up date,
  deal_ref text,
  predracun_ref text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.email_contacts add column if not exists company_name text;
alter table public.email_contacts add column if not exists first_name text;
alter table public.email_contacts add column if not exists last_name text;
alter table public.email_contacts add column if not exists job_title text;
alter table public.email_contacts add column if not exists email text;
alter table public.email_contacts add column if not exists phone text;
alter table public.email_contacts add column if not exists city text;
alter table public.email_contacts add column if not exists language text;
alter table public.email_contacts add column if not exists what_they_buy text;
alter table public.email_contacts add column if not exists owner_name text;
alter table public.email_contacts add column if not exists last_email_on date;
alter table public.email_contacts add column if not exists last_email_subject text;
alter table public.email_contacts add column if not exists from_address text;
alter table public.email_contacts add column if not exists sent_by text;
alter table public.email_contacts add column if not exists status text;
alter table public.email_contacts add column if not exists next_follow_up date;
alter table public.email_contacts add column if not exists deal_ref text;
alter table public.email_contacts add column if not exists predracun_ref text;
alter table public.email_contacts add column if not exists note text;
alter table public.email_contacts add column if not exists created_at timestamptz not null default now();
alter table public.email_contacts add column if not exists updated_at timestamptz not null default now();
alter table public.email_contacts add column if not exists created_by uuid references public.profiles (id) on delete set null;
alter table public.email_contacts add column if not exists updated_by uuid references public.profiles (id) on delete set null;

alter table public.email_contacts enable row level security;

revoke all on public.email_contacts from anon, authenticated;
grant select, insert, update on public.email_contacts to authenticated;

alter table public.email_contacts drop constraint if exists email_contacts_partition;
alter table public.email_contacts add constraint email_contacts_partition check (
  brand in ('tadex', 'strong') and country in ('HR', 'BA')
);

alter table public.email_contacts drop constraint if exists email_contacts_status;
alter table public.email_contacts add constraint email_contacts_status check (
  status is null or status in ('poslano', 'čeka odgovor', 'odgovorio', 'dogovoreno')
);

alter table public.email_contacts drop constraint if exists email_contacts_lengths;
alter table public.email_contacts add constraint email_contacts_lengths check (
  (company_name is null or char_length(company_name) <= 200)
  and (first_name is null or char_length(first_name) <= 80)
  and (last_name is null or char_length(last_name) <= 80)
  and (job_title is null or char_length(job_title) <= 120)
  and (email is null or char_length(email) <= 320)
  and (phone is null or char_length(phone) <= 80)
  and (city is null or char_length(city) <= 120)
  and (language is null or char_length(language) <= 80)
  and (what_they_buy is null or char_length(what_they_buy) <= 500)
  and (owner_name is null or char_length(owner_name) <= 80)
  and (last_email_subject is null or char_length(last_email_subject) <= 300)
  and (from_address is null or char_length(from_address) <= 320)
  and (sent_by is null or char_length(sent_by) <= 80)
  and (deal_ref is null or char_length(deal_ref) <= 120)
  and (predracun_ref is null or char_length(predracun_ref) <= 120)
  and (note is null or char_length(note) <= 4000)
);

alter table public.email_contacts drop constraint if exists email_contacts_has_detail;
alter table public.email_contacts add constraint email_contacts_has_detail check (
  company_name is not null
  or first_name is not null
  or last_name is not null
  or job_title is not null
  or email is not null
  or phone is not null
  or city is not null
  or language is not null
  or what_they_buy is not null
  or owner_name is not null
  or last_email_on is not null
  or last_email_subject is not null
  or from_address is not null
  or sent_by is not null
  or status is not null
  or next_follow_up is not null
  or deal_ref is not null
  or predracun_ref is not null
  or note is not null
);

-- A recorded send (date or subject) always keeps the mailbox and the colleague.
-- Contacts with no send yet may leave both blank.
alter table public.email_contacts drop constraint if exists email_contacts_send_record;
alter table public.email_contacts add constraint email_contacts_send_record check (
  (last_email_on is null and last_email_subject is null)
  or (from_address is not null and sent_by is not null)
);

create index if not exists email_contacts_partition_idx
  on public.email_contacts (brand, country, updated_at desc);

create or replace function public.hub_email_contacts_allowed()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.approved
  );
$$;

revoke all on function public.hub_email_contacts_allowed() from public, anon;
grant execute on function public.hub_email_contacts_allowed() to authenticated;

create or replace function public.email_contacts_before_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.company_name := nullif(btrim(new.company_name), '');
  new.first_name := nullif(btrim(new.first_name), '');
  new.last_name := nullif(btrim(new.last_name), '');
  new.job_title := nullif(btrim(new.job_title), '');
  new.email := nullif(btrim(new.email), '');
  new.phone := nullif(btrim(new.phone), '');
  new.city := nullif(btrim(new.city), '');
  new.language := nullif(btrim(new.language), '');
  new.what_they_buy := nullif(btrim(new.what_they_buy), '');
  new.owner_name := nullif(btrim(new.owner_name), '');
  new.last_email_subject := nullif(btrim(new.last_email_subject), '');
  new.from_address := nullif(btrim(new.from_address), '');
  new.sent_by := nullif(btrim(new.sent_by), '');
  new.deal_ref := nullif(btrim(new.deal_ref), '');
  new.predracun_ref := nullif(btrim(new.predracun_ref), '');
  new.note := nullif(btrim(new.note), '');
  if new.status is not null then
    new.status := nullif(btrim(new.status), '');
  end if;

  if tg_op = 'INSERT' then
    new.id := gen_random_uuid();
    new.created_at := now();
    new.created_by := auth.uid();
  else
    if new.brand is distinct from old.brand or new.country is distinct from old.country then
      raise exception 'Kontakt ostaje u istoj bazi i državi.';
    end if;
    new.id := old.id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;

  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

revoke all on function public.email_contacts_before_write() from public, anon, authenticated;

drop trigger if exists email_contacts_before_write on public.email_contacts;
create trigger email_contacts_before_write
  before insert or update on public.email_contacts
  for each row execute function public.email_contacts_before_write();

drop policy if exists "email_contacts: approved read" on public.email_contacts;
create policy "email_contacts: approved read"
  on public.email_contacts for select
  to authenticated
  using (public.hub_email_contacts_allowed());

drop policy if exists "email_contacts: approved insert" on public.email_contacts;
create policy "email_contacts: approved insert"
  on public.email_contacts for insert
  to authenticated
  with check (public.hub_email_contacts_allowed());

drop policy if exists "email_contacts: approved update" on public.email_contacts;
create policy "email_contacts: approved update"
  on public.email_contacts for update
  to authenticated
  using (public.hub_email_contacts_allowed())
  with check (public.hub_email_contacts_allowed());

comment on table public.email_contacts is
  'Email kontakti hub tile. One row is one brand (tadex|strong) and one country (HR|BA). Not a second CRM.';
comment on column public.email_contacts.from_address is
  'Mailbox the last email was sent from. Null when no send is recorded.';
comment on column public.email_contacts.sent_by is
  'Colleague who sent the last email (Tadija, Aida, Magdalena, Mladen, or another name). Null when no send is recorded.';
comment on column public.email_contacts.deal_ref is
  'Optional existing deal id from the hub CRM. No foreign key; deals are not stored in this database.';
comment on column public.email_contacts.predracun_ref is
  'Optional existing predračun id. Leave null when there is none.';
