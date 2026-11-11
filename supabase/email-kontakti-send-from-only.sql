-- TADEX Hub · Email kontakti forward migration
-- Project: tadex-hub (ref ichcxptnnzakwzlmixvk).
-- Run this file in the Supabase SQL Editor on a database that already has
-- public.email_contacts. Do not run it from the app.
--
-- Relaxes email_contacts_send_record: a recorded send (last_email_on or
-- last_email_subject) requires from_address only. sent_by may stay null.
-- Does not drop sent_by and does not update or delete existing rows.
-- Existing values in sent_by are left as they are.

alter table public.email_contacts enable row level security;

revoke all on public.email_contacts from anon, authenticated;
grant select, insert, update on public.email_contacts to authenticated;

alter table public.email_contacts drop constraint if exists email_contacts_send_record;
alter table public.email_contacts add constraint email_contacts_send_record check (
  (last_email_on is null and last_email_subject is null)
  or (from_address is not null)
);

comment on column public.email_contacts.sent_by is
  'Retained for existing rows. Not shown and not required. Leave null on new writes.';
