-- TADEX Hub · template for a NEW public table (copy into a new .sql under supabase/, rename, fill in).
-- Why: from 30 Oct 2026 Supabase no longer auto-GRANTs public tables to anon/authenticated/service_role.
--      Without an explicit GRANT, supabase-js gets: permission denied for table … (42501).
-- Existing tables keep their current grants — do NOT re-GRANT everything on old tables.
-- Pattern matches setup.sql (profiles, hub_presence): revoke defaults, grant only what RLS needs.
-- Checklist: see supabase/MIGRATIONS.md

-- 1) Table
create table if not exists public.YOUR_TABLE (
  id uuid primary key default gen_random_uuid(),
  -- …
  created_at timestamptz not null default now()
);

-- 2) RLS on (always for public tables the client can reach)
alter table public.YOUR_TABLE enable row level security;

-- 3) Privileges (defence in depth; RLS does NOT block TRUNCATE)
-- Strip Data-API defaults. After 30 Oct 2026 new tables start with NO grants.
revoke all on public.YOUR_TABLE from anon, authenticated;

-- Hub browser uses the anon key + user JWT → role is "authenticated".
-- We do NOT grant anon anything on hub tables (signed-out clients must not touch them).
grant select on public.YOUR_TABLE to authenticated;
-- Uncomment only the write ops the app actually does as the signed-in user:
-- grant insert on public.YOUR_TABLE to authenticated;
-- grant update on public.YOUR_TABLE to authenticated;
-- grant delete on public.YOUR_TABLE to authenticated;
-- Prefer column-level update when only a few fields are writable from the app:
-- grant update (col_a, col_b) on public.YOUR_TABLE to authenticated;

-- service_role bypasses RLS; needed only if a server uses the service_role key on this table.
-- Hub front-end never ships that key. Grant if/when a trusted server path needs it:
-- grant select, insert, update, delete on public.YOUR_TABLE to service_role;

-- 4) Policies (one per operation you granted)
drop policy if exists "YOUR_TABLE: read …" on public.YOUR_TABLE;
create policy "YOUR_TABLE: read …"
  on public.YOUR_TABLE for select
  to authenticated
  using (true /* tighten: e.g. user_id = auth.uid() or public.is_admin() */);

-- drop policy if exists "YOUR_TABLE: insert …" on public.YOUR_TABLE;
-- create policy "YOUR_TABLE: insert …"
--   on public.YOUR_TABLE for insert to authenticated
--   with check (…);

-- 5) If you add a helper function called from the client:
-- create or replace function public.your_fn(…)
-- returns … language sql stable security definer set search_path = public as $$ … $$;
-- revoke all on function public.your_fn(…) from public, anon;
-- grant execute on function public.your_fn(…) to authenticated;
-- (Trigger-only helpers: revoke from public, anon, authenticated — no grant.)
