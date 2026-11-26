-- TADEX Hub · Email kontakti: sadržaj poslanog maila + baza po firmi (26.11.2026).
-- Forward change for a database that already has email_contacts. Idempotent.
--
-- 1. last_email_body: the text of the last email sent to the client (so colleagues see what was written).
-- 2. Access per baza: the Tadex baza only for people with the TADEX side, the Strong baza only for people
--    with the STRONG side (profiles.companies). Admins see both. Before this, every approved member saw both.

alter table public.email_contacts add column if not exists last_email_body text;

alter table public.email_contacts drop constraint if exists email_contacts_body_length;
alter table public.email_contacts add constraint email_contacts_body_length check (
  last_email_body is null or char_length(last_email_body) <= 20000
);

-- A recorded send (date, subject or text) needs the mailbox it was sent from.
alter table public.email_contacts drop constraint if exists email_contacts_send_record;
alter table public.email_contacts add constraint email_contacts_send_record check (
  (last_email_on is null and last_email_subject is null and last_email_body is null)
  or (from_address is not null)
);

-- Trim the new text like the other fields (keeps every rule of the existing trigger).
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
  new.last_email_body := nullif(btrim(new.last_email_body), '');
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

-- Baza per firma: approved, and the brand is one of my sides (or I am admin).
create or replace function public.hub_email_contacts_brand_allowed(p_brand text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.approved
      and (me.is_admin or p_brand = any (me.companies))
  );
$$;

revoke all on function public.hub_email_contacts_brand_allowed(text) from public, anon;
grant execute on function public.hub_email_contacts_brand_allowed(text) to authenticated;

drop policy if exists "email_contacts: approved read" on public.email_contacts;
create policy "email_contacts: approved read"
  on public.email_contacts for select
  to authenticated
  using (public.hub_email_contacts_brand_allowed(brand));

drop policy if exists "email_contacts: approved insert" on public.email_contacts;
create policy "email_contacts: approved insert"
  on public.email_contacts for insert
  to authenticated
  with check (public.hub_email_contacts_brand_allowed(brand));

drop policy if exists "email_contacts: approved update" on public.email_contacts;
create policy "email_contacts: approved update"
  on public.email_contacts for update
  to authenticated
  using (public.hub_email_contacts_brand_allowed(brand))
  with check (public.hub_email_contacts_brand_allowed(brand));

comment on column public.email_contacts.last_email_body is
  'Text of the last email sent to this contact (pasted from the mailbox). Null when not recorded.';
