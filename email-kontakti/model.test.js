import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  EMPTY_HINT,
  FIELD_DEFS,
  SEND_NEEDS_FROM_AND_WHO,
  STATUSES,
  activitySummary,
  brandChoices,
  brandTitle,
  buildWrite,
  contactCountLabel,
  countryChoices,
  formatDate,
  formatTimestamp,
  hrefFor,
  parseRoute,
  rowsForPartition,
  searchContacts,
} from "./model.js";

const sql = readFileSync(new URL("../supabase/email-kontakti.sql", import.meta.url), "utf8");
const setup = readFileSync(new URL("../supabase/setup.sql", import.meta.url), "utf8");

test("email only is a valid contact and does not fill the send fields", () => {
  const result = buildWrite({ email: "  aida@example.com  " }, "tadex", "HR");
  assert.equal(result.ok, true);
  assert.equal(result.row.email, "aida@example.com");
  assert.equal(result.row.brand, "tadex");
  assert.equal(result.row.country, "HR");
  for (const field of FIELD_DEFS) {
    if (field.key === "email") continue;
    assert.equal(result.row[field.key], null, field.key);
  }
  assert.equal(result.row.from_address, null);
  assert.equal(result.row.sent_by, null);
  assert.equal(result.row.source, undefined);
  assert.equal(result.row.tags, undefined);
});

test("company name without an email is valid", () => {
  const result = buildWrite({ company_name: "  Strong d.o.o.  " }, "strong", "BA");
  assert.equal(result.ok, true);
  assert.equal(result.row.company_name, "Strong d.o.o.");
  assert.equal(result.row.email, null);
  assert.equal(result.row.from_address, null);
  assert.equal(result.row.sent_by, null);
  assert.equal(result.row.brand, "strong");
  assert.equal(result.row.country, "BA");
});

test("a blank form is refused and nothing is invented", () => {
  const result = buildWrite({ email: "   ", company_name: "", owner_name: "  " }, "tadex", "HR");
  assert.equal(result.ok, false);
  assert.equal(result.row, undefined);
});

test("owner is not copied into the sender", () => {
  const result = buildWrite({ email: "a@b.c", owner_name: "Aida" }, "tadex", "HR");
  assert.equal(result.ok, true);
  assert.equal(result.row.owner_name, "Aida");
  assert.equal(result.row.sent_by, null);
  assert.equal(result.row.from_address, null);
});

test("a recorded send stores the mailbox and the colleague", () => {
  const result = buildWrite({
    last_email_on: "2026-11-01",
    last_email_subject: "  Ponuda  ",
    from_address: "  aida@example.com ",
    sent_by: "Aida",
  }, "strong", "BA");
  assert.equal(result.ok, true);
  assert.equal(result.row.last_email_on, "2026-11-01");
  assert.equal(result.row.last_email_subject, "Ponuda");
  assert.equal(result.row.from_address, "aida@example.com");
  assert.equal(result.row.sent_by, "Aida");
  assert.equal(result.row.email, null);
  assert.equal(result.row.brand, "strong");
  assert.equal(result.row.country, "BA");
});

test("date or subject without the mailbox and the colleague is refused", () => {
  const dateOnly = buildWrite({ last_email_on: "2026-11-01", email: "a@b.c" }, "tadex", "HR");
  assert.equal(dateOnly.ok, false);
  assert.equal(dateOnly.message, SEND_NEEDS_FROM_AND_WHO);
  assert.equal(dateOnly.row, undefined);

  const subjectOnly = buildWrite({ last_email_subject: "Bok", sent_by: "Mladen" }, "tadex", "HR");
  assert.equal(subjectOnly.ok, false);
  assert.equal(subjectOnly.row, undefined);

  const missingWho = buildWrite({
    last_email_subject: "Bok",
    from_address: "mladen@example.com",
  }, "strong", "HR");
  assert.equal(missingWho.ok, false);
});

test("mailbox and colleague may be stored before a date exists", () => {
  const result = buildWrite({ from_address: "ured@example.com", sent_by: "Tadija" }, "tadex", "BA");
  assert.equal(result.ok, true);
  assert.equal(result.row.from_address, "ured@example.com");
  assert.equal(result.row.sent_by, "Tadija");
  assert.equal(result.row.last_email_on, null);
  assert.equal(result.row.last_email_subject, null);
});

test("invalid status and invalid dates are not replaced with defaults", () => {
  const status = buildWrite({ email: "a@b.c", status: "maybe" }, "tadex", "HR");
  assert.equal(status.ok, false);
  assert.equal(status.row, undefined);
  const date = buildWrite({ email: "a@b.c", next_follow_up: "sutra" }, "tadex", "HR");
  assert.equal(date.ok, false);
  assert.equal(date.row, undefined);
});

test("the form cannot move a contact into the other baza", () => {
  const result = buildWrite({
    email: "a@b.c",
    brand: "strong",
    country: "BA",
    source: "sajam",
    tags: "vip",
  }, "tadex", "HR");
  assert.equal(result.ok, true);
  assert.equal(result.row.brand, "tadex");
  assert.equal(result.row.country, "HR");
  assert.equal(result.row.source, undefined);
  assert.equal(result.row.tags, undefined);
});

test("routes stay inside one baza and one country", () => {
  assert.equal(parseRoute("").screen, "brands");
  assert.deepEqual(parseRoute("?baza=nope&drzava=HR"), { screen: "brands" });
  assert.deepEqual(parseRoute("?baza=strong"), { screen: "countries", brand: "strong" });
  assert.equal(parseRoute("?baza=strong&drzava=XX").screen, "countries");
  const list = parseRoute("?baza=tadex&drzava=HR&q=strong");
  assert.equal(list.brand, "tadex");
  assert.equal(list.country, "HR");
  assert.equal(list.q, "strong");
  assert.equal(list.mode, "list");

  const id = "550e8400-e29b-41d4-a716-446655440000";
  const edit = parseRoute(`?baza=strong&drzava=BA&id=${id}&uredi=1`);
  assert.equal(edit.mode, "edit");
  assert.equal(edit.brand, "strong");
  assert.equal(edit.id, id);
  assert.equal(parseRoute("?baza=tadex&drzava=HR&id=not-a-uuid&uredi=1").mode, "list");
  assert.equal(parseRoute("?baza=strong&drzava=BA&novi=1").mode, "create");

  assert.equal(hrefFor({ brand: "strong", country: "BA" }), "/email-kontakti/?baza=strong&drzava=BA");
  assert.equal(hrefFor({ brand: "strong" }).includes("tadex"), false);
  assert.deepEqual(countryChoices("strong").map(item => item.href), [
    "/email-kontakti/?baza=strong&drzava=HR",
    "/email-kontakti/?baza=strong&drzava=BA",
  ]);
  assert.deepEqual(brandChoices().map(item => item.title), ["Tadex Baza", "Strong Baza"]);
  assert.equal(brandTitle("strong").includes("Tadex"), false);
});

test("search covers email, name and company inside the open partition only", () => {
  const rows = [
    { brand: "tadex", country: "HR", email: "a@tadex.test", first_name: "Aida", last_name: "Hadžić", company_name: "Tadex Firma", phone: "061", from_address: "tajno@sanduce.test" },
    { brand: "strong", country: "HR", email: "a@strong.test", first_name: "Mladen", last_name: "Strong", company_name: "Strong Firma" },
    { brand: "tadex", country: "BA", email: "b@tadex.test", first_name: "Ana", last_name: "Anić", company_name: "Tadex BA" },
  ];
  const scoped = rowsForPartition(rows, "tadex", "HR");
  assert.equal(scoped.length, 1);
  assert.equal(searchContacts(scoped, "strong").length, 0);
  assert.equal(searchContacts(scoped, "tadex firma").length, 1);
  assert.equal(searchContacts(scoped, "HADŽIĆ").length, 1);
  assert.equal(searchContacts(scoped, "aida hadžić").length, 1);
  assert.equal(searchContacts(scoped, "061").length, 0);
  assert.equal(searchContacts(scoped, "tajno@sanduce.test").length, 0);
});

test("activity summary shows the mailbox and the colleague only when they were stored", () => {
  assert.deepEqual(activitySummary({ email: "a@b.c" }), []);
  assert.deepEqual(
    activitySummary({
      last_email_on: "2026-11-01",
      last_email_subject: "Bok",
      from_address: "aida@example.com",
      sent_by: "Aida",
    }).map(line => line.k),
    ["Datum", "Naslov", "Sanduče", "Tko"],
  );
  assert.equal(formatDate("2026-11-01"), "1.11.2026.");
  assert.match(formatTimestamp("2026-11-11T12:00:00Z"), /13/);
});

test("field list has the send pair, no required flags, and no source or tags", () => {
  const keys = FIELD_DEFS.map(field => field.key);
  assert.equal(keys.includes("from_address"), true);
  assert.equal(keys.includes("sent_by"), true);
  assert.equal(keys.includes("source"), false);
  assert.equal(keys.includes("tags"), false);
  assert.equal(FIELD_DEFS.every(field => !field.required), true);
  assert.deepEqual(FIELD_DEFS.find(field => field.key === "sent_by").suggestions, ["Tadija", "Aida", "Magdalena", "Mladen"]);
  assert.deepEqual(FIELD_DEFS.find(field => field.key === "owner_name").suggestions, ["Aida", "Magdalena", "Mladen"]);
  assert.match(EMPTY_HINT, /samo email/);
  assert.equal(contactCountLabel(1), "1 kontakt");
  assert.equal(contactCountLabel(3), "3 kontakta");
  assert.equal(contactCountLabel(11), "11 kontakata");
  assert.equal(contactCountLabel(22), "22 kontakta");
});

test("migration grants authenticated read and write and keeps the send rule", () => {
  for (const file of [sql, setup]) {
    assert.match(file, /grant select, insert, update on public\.email_contacts to authenticated;/);
    assert.match(file, /revoke all on public\.email_contacts from anon, authenticated;/);
    assert.match(file, /enable row level security/);
    assert.match(file, /from_address/);
    assert.match(file, /sent_by/);
    assert.match(file, /email_contacts_send_record/);
    assert.match(file, /\(last_email_on is null and last_email_subject is null\)\s+or \(from_address is not null and sent_by is not null\)/);
  }
  assert.doesNotMatch(sql, /\bto anon\b/i);
  assert.doesNotMatch(sql, /to service_role/);
  assert.doesNotMatch(sql, /update\s+public\.profiles/i);
  assert.doesNotMatch(sql, /delete\s+from/i);
  assert.doesNotMatch(sql, /grant delete/i);
  for (const status of STATUSES) assert.ok(sql.includes(`'${status.value}'`), status.value);
  for (const field of FIELD_DEFS) {
    if (!field.max) continue;
    assert.match(sql, new RegExp(`char_length\\(${field.key}\\) <= ${field.max}`));
  }
});
