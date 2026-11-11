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
