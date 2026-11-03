-- Direktor may grant/deny calculator editRates + seeRates for people on THEIR team only.
-- Admins keep the full Admin → Permissions UI (updateUser). This RPC does not widen Admin.
-- Apply in Supabase SQL Editor (idempotent). Also appended into setup.sql for full re-runs.
-- Project: tadex-hub (ref ichcxptnnzakwzlmixvk). Calc/CRM data stays on Neon — do not mix.

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

-- Team roster for the signed-in Direktor, with current calculator kurs overrides.
-- edit_rates / see_rates: 'allow' | 'deny' | '' (inherit role / company default).
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

-- Set one kurs override for a team member. p_key: editRates|seeRates.
-- p_value: allow|deny|default (or '') — default clears the override.
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
  v_calc jsonb;
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

  v_calc := coalesce(v_perms -> 'calculator', '{}'::jsonb);
  if v_norm in ('default', '') then
    v_calc := v_calc - p_key;
  else
    v_calc := jsonb_set(v_calc, array[p_key], to_jsonb(v_norm = 'allow'), true);
  end if;
  v_perms := jsonb_set(coalesce(v_perms, '{}'::jsonb), '{calculator}', v_calc, true);

  update public.profiles
     set app_perms = v_perms
   where id = p_member;

  return v_perms;
end;
$$;
revoke all on function public.hub_direktor_set_team_kurs(uuid, text, text) from public, anon;
grant execute on function public.hub_direktor_set_team_kurs(uuid, text, text) to authenticated;
