# TADEX Hub · Supabase SQL migrations

Project: **tadex-hub** (ref `ichcxptnnzakwzlmixvk`). Hub SSO + profiles live here.
Calc/CRM data is on **Neon**, not this database — do not mix.

## How we apply SQL today

There is no `supabase/migrations/` runner and no CI gate. We keep idempotent `.sql` files under `supabase/` and run them in the Supabase **SQL Editor** (or paste into a one-off apply script). Source of truth for the live schema:

| File | What |
| --- | --- |
| `setup.sql` | profiles, RLS, helpers, hub_presence — safe to re-run |
| `quotes-storage.sql` | Storage bucket `quotes` + policies (Ponude photos) |
| `direktor-team-kurs.sql` | EUR/USD kurs open for every member: `editRates` + `seeRates` forced true (clears Deny) |
| `_template_new_table.sql` | Copy this for every **new** public table |

## Rule (Tadija, 21 Oct 2026) — GRANTs on every new public table

From **30 Oct 2026** Supabase stops auto-granting new `public` tables to `anon` / `authenticated` / `service_role`. Existing tables keep their grants. New tables without an explicit `GRANT` make `supabase-js` fail with `42501 permission denied`.

**Every future `CREATE TABLE public.…` must include the privilege block** (same shape as `profiles` / `hub_presence` in `setup.sql`):

```sql
alter table public.YOUR_TABLE enable row level security;

revoke all on public.YOUR_TABLE from anon, authenticated;

grant select on public.YOUR_TABLE to authenticated;
-- + insert / update / delete (or column-level update) only as needed

-- only if a trusted server uses the service_role key on this table:
-- grant select, insert, update, delete on public.YOUR_TABLE to service_role;
```

Then add RLS policies for each operation you granted. Functions callable from the client:

```sql
revoke all on function public.your_fn(…) from public, anon;
grant execute on function public.your_fn(…) to authenticated;
```

Do **not** blanket-GRANT all existing tables unless Tadija asks — this rule is for **future** tables only.

## Checklist before you Run in SQL Editor

- [ ] Copied from `_template_new_table.sql` (or mirrored the `hub_presence` block in `setup.sql`)
- [ ] `enable row level security`
- [ ] `revoke all … from anon, authenticated`
- [ ] Explicit `grant … to authenticated` for every op the app needs
- [ ] Policies for those ops (`to authenticated`)
- [ ] Functions: revoke + `grant execute` (or revoke from authenticated if trigger-only)
- [ ] No `service_role` key in the hub repo / client
- [ ] Appended the same SQL into `setup.sql` if it should stay in the “full hub schema” re-run script

## Existing public tables (grants already applied — for copy, not re-run)

| Table | anon | authenticated | Notes |
| --- | --- | --- | --- |
| `profiles` | none (revoked) | `SELECT`; `UPDATE (approved, apps, app_roles, rank, app_perms, direktor_id)` | RLS: read own or admin; update admin-only |
| `hub_presence` | none (revoked) | `SELECT` | RLS: admin read; writes only via `hub_heartbeat` / `hub_presence_signed_out` |

`service_role` was never granted explicitly in our SQL (pre–30 Oct defaults covered it). New tables that a server must touch with the service key need an explicit `grant … to service_role`.

## Related

- Hub setup steps: `../SETUP.md`
- Changelog: [Tables not exposed to Data API automatically](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
