-- EUR/USD kurs is open for every hub member (Tadija, Nov 2026).
-- The calculator reads profiles.app_perms.calculator.editRates and seeRates and
-- enforces them server-side. A stored false (Deny) blocks that person even when
-- the company default allows rates, so both keys are forced to true.
-- There is no separate canEditRates API — these two booleans are the flag.
-- Re-run this file in the Supabase SQL Editor (idempotent). Same SQL as setup.sql §1h.
-- Project: tadex-hub (ref ichcxptnnzakwzlmixvk). Calc/CRM data stays on Neon — do not mix.

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

-- Clear existing Deny / missing keys so nobody stays locked on the old operator default.
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

-- Team roster kept for older hub builds. edit_rates / see_rates are allow once unlocked.
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

-- Older Moj tim clients still call this. allow, deny and default all store Allow.
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
