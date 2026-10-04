-- TADEX Hub: Supabase setup. Run once in the Supabase SQL Editor.
-- Safe to re-run.

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
  select array['tadijasaric92@gmail.com', 'info@tadextrade.com']::text[]
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  if lower(new.email) = any (public.hub_owner_emails()) and new.email_confirmed_at is not null then
    update public.profiles set approved = true, is_admin = true, apps = array['calculator','app2'] where id = new.id;
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
    update public.profiles set approved = true, is_admin = true, apps = array['calculator','app2'] where id = new.id;
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
grant update (approved, apps) on public.profiles to authenticated;

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
--    hub_owner_emails() (tadijasaric92@gmail.com, info@tadextrade.com) signs up and confirms the email. If the account already exists and is confirmed, this catches it up:
update public.profiles p
   set approved = true, is_admin = true, apps = array['calculator', 'app2']
  from auth.users u
 where u.id = p.id
   and lower(u.email) = any (public.hub_owner_emails())
   and u.email_confirmed_at is not null;
