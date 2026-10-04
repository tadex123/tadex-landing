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
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 3) Create a profile automatically on sign-up (unapproved, no apps)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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
revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
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

-- 7) Make Tadija admin. First request access on tadexhub.com with this email, then run:
update public.profiles
   set approved = true, is_admin = true, apps = array['calculator', 'app2']
 where email = 'REPLACE_WITH_TADIJA_EMAIL';
