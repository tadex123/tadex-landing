// Email kontakti. Signed-in hub members open one baza, then one country.
// Tadex and Strong are separate queries. This page does not send email.
import { getSession, hubDb, signOut, startHeartbeat } from "/auth.js";
import * as model from "./model.js";

const app = document.querySelector("#app");
const COLUMNS = ["id", "brand", "country", "updated_at", ...model.FIELD_DEFS.map(field => field.key)].join(",");

const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[ch]));

function goLogin() {
  const next = location.pathname + location.search;
  location.replace("/?next=" + encodeURIComponent(next));
}

function dbMessage(error) {
  const blob = `${error && error.message || ""} ${error && error.details || ""} ${error && error.hint || ""}`;
  if (/email_contacts_send_record/.test(blob)) return model.SEND_NEEDS_FROM_AND_WHO;
  if (/email_contacts_has_detail/.test(blob)) return model.NEED_ONE;
  if (/email_contacts_status/.test(blob)) return "Status nije prepoznat. Ostavite prazno ili odaberite jedan sa liste.";
  if (/email_contacts_lengths/.test(blob)) return "Jedno polje je predugo.";
  if (/email_contacts_partition|istoj bazi/.test(blob)) return "Kontakt ostaje u istoj bazi i državi.";
  if ((error && error.code) === "42501" || /permission denied|row-level security/i.test(blob)) {
    return "Nemate pristup. Prijavite se odobrenim hub nalogom.";
  }
  if (error && error.message === "missing") return "Kontakt nije pronađen u ovoj bazi i državi.";
  return "Radnja nije uspjela. Pokušajte ponovo.";
}

function crumbs(route) {
  const bits = [`<a href="${esc(model.hrefFor())}">Email kontakti</a>`];
  if (route.brand) bits.push(`<a href="${esc(model.hrefFor({ brand: route.brand }))}">${esc(model.brandTitle(route.brand))}</a>`);
  if (route.country) bits.push(`<span>${esc(model.COUNTRIES[route.country])}</span>`);
  return `<p class="crumbs">${bits.join(" <span aria-hidden=\"true\">/</span> ")}</p>`;
}

function where(route) {
  return `${model.brandTitle(route.brand)} · ${model.COUNTRIES[route.country]}`;
}

function fieldControl(field) {
  const hint = field.hint ? `<p class="hint">${esc(field.hint)}</p>` : "";
  const placeholder = field.placeholder ? ` placeholder="${esc(field.placeholder)}"` : "";
  if (field.type === "textarea") {
    return `<label class="field wide"><span>${esc(field.label)}</span><textarea name="${esc(field.key)}" rows="4" maxlength="${field.max}" autocomplete="off"></textarea>${hint}</label>`;
  }
  if (field.type === "status") {
    const options = model.STATUSES.map(item => `<option value="${esc(item.value)}">${esc(item.label)}</option>`).join("");
    return `<label class="field"><span>${esc(field.label)}</span><select name="status"><option value="">—</option>${options}</select></label>`;
  }
  if (field.type === "date") {
    return `<label class="field"><span>${esc(field.label)}</span><input name="${esc(field.key)}" type="date" autocomplete="off"></label>`;
  }
  const list = field.suggestions ? ` list="suggest-${esc(field.key)}"` : "";
  const datalist = field.suggestions
    ? `<datalist id="suggest-${esc(field.key)}">${field.suggestions.map(item => `<option value="${esc(item)}"></option>`).join("")}</datalist>`
    : "";
  const mode = field.key === "email" || field.key === "from_address" ? ` inputmode="email"` : "";
  const type = field.key === "phone" ? "tel" : "text";
  return `<label class="field${field.wide ? " wide" : ""}"><span>${esc(field.label)}</span><input name="${esc(field.key)}" type="${type}" maxlength="${field.max}"${placeholder}${list}${mode} autocomplete="off">${datalist}${hint}</label>`;
}

function formFields() {
  return model.fieldGroups().map(group => {
    const inner = `<div class="grid">${group.fields.map(fieldControl).join("")}</div>`;
    if (group.group === "send") {
      return `<fieldset class="send"><legend>Zadnji poslani email</legend><p class="hint">${esc(model.SEND_NEEDS_FROM_AND_WHO)} Ako email još nije poslan, ostavite cijeli blok prazan.</p>${inner}</fieldset>`;
    }
    return inner;
  }).join("");
}

function readForm(form) {
  const out = {};
  for (const field of model.FIELD_DEFS) {
    const el = form.elements.namedItem(field.key);
    out[field.key] = el ? el.value : "";
  }
  return out;
}

function valueForInput(field, row) {
  if (!row || row[field.key] == null || row[field.key] === "") return "";
  const raw = String(row[field.key]);
  if (field.type === "date") {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
    return match ? match[1] : "";
  }
  return raw;
}

function fillForm(form, row) {
  for (const field of model.FIELD_DEFS) {
    const el = form.elements.namedItem(field.key);
    if (el) el.value = valueForInput(field, row);
  }
}

function showValue(field, row) {
  const raw = row ? row[field.key] : null;
  if (raw == null || raw === "") return "—";
  if (field.type === "date") return model.formatDate(raw) || String(raw);
  if (field.key === "status") return model.statusLabel(raw) || String(raw);
  return String(raw);
}

async function db() {
  return hubDb();
}

async function loadContacts(brand, country) {
  const client = await db();
  const { data, error } = await client.from("email_contacts").select(COLUMNS)
    .eq("brand", brand).eq("country", country)
    .order("updated_at", { ascending: false }).limit(2000);
  if (error) throw error;
  return model.rowsForPartition(data || [], brand, country);
}

async function loadOne(brand, country, id) {
  const client = await db();
  const { data, error } = await client.from("email_contacts").select(COLUMNS)
    .eq("id", id).eq("brand", brand).eq("country", country).maybeSingle();
  if (error) throw error;
  if (!model.samePartition(data, brand, country)) return null;
  return data;
}

async function saveContact(row, id) {
  const client = await db();
  if (id) {
    const { data, error } = await client.from("email_contacts").update(row)
      .eq("id", id).eq("brand", row.brand).eq("country", row.country)
      .select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("missing");
    return data.id;
  }
  const { data, error } = await client.from("email_contacts").insert(row).select("id").single();
  if (error) throw error;
  return data.id;
}

async function countsFor(brand) {
  const client = await db();
  const pairs = await Promise.all(["HR", "BA"].map(async country => {
    const { count, error } = await client.from("email_contacts").select("id", { count: "exact", head: true })
      .eq("brand", brand).eq("country", country);
    return [country, error ? null : count];
  }));
  return Object.fromEntries(pairs);
}

function renderBrands() {
  const cards = model.brandChoices().map(choice => `
    <a class="choice ${esc(choice.id)}" href="${esc(choice.href)}">
      <span class="kicker">${esc(choice.id === "strong" ? "Strong" : "Tadex")}</span>
      <strong>${esc(choice.title)}</strong>
      <span>${esc(choice.text)}</span>
    </a>`).join("");
  app.innerHTML = `
    <h1>Email kontakti</h1>
    <p class="lead">Odaberite bazu. Svaki kontakt pripada samo jednoj: Tadex ili Strong.</p>
    <div class="choices">${cards}</div>`;
}

async function renderCountries(route) {
  let counts = {};
  let note = "";
  try { counts = await countsFor(route.brand); }
  catch { note = `<p class="msg">Liste se trenutno ne mogu učitati. Baze i dalje otvorite odvojeno.</p>`; }
  const cards = model.countryChoices(route.brand).map(choice => {
    const count = counts[choice.id];
    const label = model.contactCountLabel(count);
    const extra = count === 0 ? ` ${model.EMPTY_HINT}` : "";
    return `
      <a class="choice ${esc(route.brand)}" href="${esc(choice.href)}">
        <span class="kicker">Država</span>
        <strong>${esc(choice.title)}</strong>
        <span>${esc(label || "Otvorite listu")}${esc(extra)}</span>
      </a>`;
  }).join("");
  app.innerHTML = `
    ${crumbs(route)}
    <h1>${esc(model.brandTitle(route.brand))}</h1>
    <p class="lead">${esc(model.BRANDS[route.brand].text)} Unutra su Hrvatska i Bosna i Hercegovina, svaka svoja lista.</p>
    ${note}
    <div class="choices">${cards}</div>`;
}

function contactCard(row, route) {
  const lines = [
    row.company_name && row.company_name !== model.cardTitle(row) ? row.company_name : "",
    row.email || "",
    row.phone || "",
    row.status ? model.statusLabel(row.status) : "",
    row.owner_name ? `Odgovorna osoba: ${row.owner_name}` : "",
    row.next_follow_up ? `Follow-up: ${model.formatDate(row.next_follow_up)}` : "",
  ].filter(Boolean);
  const activity = model.activitySummary(row).map(line => `<div><b>${esc(line.k)}:</b> ${esc(line.v)}</div>`).join("");
  return `
    <a class="contact" href="${esc(model.hrefFor({ brand: route.brand, country: route.country, mode: "view", id: row.id }))}">
      <h2>${esc(model.cardTitle(row))}</h2>
      ${lines.map(line => `<div class="meta">${esc(line)}</div>`).join("")}
      ${activity ? `<div class="activity">${activity}</div>` : ""}
    </a>`;
}

function renderList(route, rows) {
  const shown = model.searchContacts(rows, route.q);
  let body;
  if (!rows.length) {
    body = `<div class="empty"><p><strong>Još nema kontakata.</strong></p><p>${esc(model.EMPTY_HINT)}</p><p><a class="btn" href="${esc(model.hrefFor({ brand: route.brand, country: route.country, mode: "create" }))}">Dodaj kontakt</a></p></div>`;
  } else if (!shown.length) {
    body = `<div class="empty"><p>Nema rezultata za „${esc(route.q)}”. Pretraga gleda email, ime i naziv firme u ovoj bazi i državi.</p></div>`;
  } else {
    body = `<div class="contacts">${shown.map(row => contactCard(row, route)).join("")}</div>`;
  }
  app.innerHTML = `
    ${crumbs(route)}
    <h1>${esc(model.COUNTRIES[route.country])}</h1>
    <p class="lead">${esc(where(route))}. ${esc(model.EMPTY_HINT)}</p>
    <div class="toolbar">
      <form class="search" method="get" action="/email-kontakti/">
        <input type="hidden" name="baza" value="${esc(route.brand)}">
        <input type="hidden" name="drzava" value="${esc(route.country)}">
        <label><span>Pretraga</span><input name="q" value="${esc(route.q || "")}" placeholder="Email, ime ili firma" autocomplete="off"></label>
        <button class="btn" type="submit">Traži</button>
      </form>
      <a class="btn" href="${esc(model.hrefFor({ brand: route.brand, country: route.country, mode: "create" }))}">Dodaj kontakt</a>
    </div>
    ${body}`;
}

function renderForm(route, row) {
  const editing = route.mode === "edit";
  app.innerHTML = `
    ${crumbs(route)}
    <h1>${editing ? "Uredi kontakt" : "Novi kontakt"}</h1>
    <p class="where">${esc(where(route))}</p>
    <form id="contact-form" class="form" novalidate autocomplete="off">
      <p class="hint">${esc(model.SAVE_HINT)}</p>
      ${formFields()}
      <div class="actions">
        <button class="btn" type="submit">Spremi</button>
        <a class="btn ghost" href="${esc(editing ? model.hrefFor({ brand: route.brand, country: route.country, mode: "view", id: route.id }) : model.hrefFor({ brand: route.brand, country: route.country, q: route.q }))}">Odustani</a>
      </div>
      <p class="status" role="status"></p>
    </form>`;
  const form = document.querySelector("#contact-form");
  fillForm(form, row);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const status = form.querySelector(".status");
    status.textContent = "";
    status.className = "status";
    const built = model.buildWrite(readForm(form), route.brand, route.country);
    if (!built.ok) {
      status.textContent = built.message;
      status.className = "status bad";
      return;
    }
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    try {
      const id = await saveContact(built.row, editing ? route.id : null);
      location.assign(model.hrefFor({ brand: route.brand, country: route.country, mode: "view", id }));
    } catch (error) {
      status.textContent = dbMessage(error);
      status.className = "status bad";
      button.disabled = false;
    }
  });
}

function renderView(route, row) {
  const blocks = model.fieldGroups().map(group => {
    const rows = group.fields.map(field => `<dt>${esc(field.label)}</dt><dd>${esc(showValue(field, row))}</dd>`).join("");
    const emptySend = group.group === "send" && model.activitySummary(row).length === 0
      ? `<p class="hint">${esc(model.EMPTY_SEND)}</p>` : "";
    const title = group.group === "send" ? "<h2>Zadnji poslani email</h2>" : "";
    return `<section class="panel">${title}${emptySend}<dl class="dl">${rows}</dl></section>`;
  }).join("");
  const edited = model.formatTimestamp(row.updated_at);
  app.innerHTML = `
    ${crumbs(route)}
    <h1>${esc(model.cardTitle(row))}</h1>
    <p class="where">${esc(where(route))}</p>
    <div class="actions" style="margin-bottom:16px">
      <a class="btn" href="${esc(model.hrefFor({ brand: route.brand, country: route.country, mode: "edit", id: row.id }))}">Uredi</a>
      <a class="btn ghost" href="${esc(model.hrefFor({ brand: route.brand, country: route.country }))}">Nazad na listu</a>
    </div>
    ${blocks}
    ${edited ? `<p class="meta">Zadnja izmjena: ${esc(edited)}</p>` : ""}`;
}

function renderMissing(route) {
  app.innerHTML = `
    ${crumbs(route)}
    <h1>Kontakt nije u ovoj bazi</h1>
    <p class="lead">U ${esc(where(route))} nema tog kontakta.</p>
    <p><a class="btn" href="${esc(model.hrefFor({ brand: route.brand, country: route.country }))}">Nazad na listu</a></p>`;
}

async function render() {
  const route = model.parseRoute(location.search);
  document.body.dataset.brand = route.brand || "";
  document.title = `${model.documentTitle(route)} · TADEX Hub`;
  try {
    if (route.screen === "brands") { renderBrands(); return; }
    if (route.screen === "countries") { await renderCountries(route); return; }
    if (route.mode === "create") { renderForm(route, null); return; }
    if (route.mode === "view" || route.mode === "edit") {
      const row = await loadOne(route.brand, route.country, route.id);
      if (!row) { renderMissing(route); return; }
      if (route.mode === "edit") renderForm(route, row);
      else renderView(route, row);
      return;
    }
    renderList(route, await loadContacts(route.brand, route.country));
  } catch (error) {
    app.innerHTML = `<p class="msg bad">${esc(dbMessage(error))}</p>`;
  }
}

async function boot() {
  let session = null;
  try { session = await getSession(); }
  catch (error) {
    if (error && error.code !== "pending" && error.code !== "not_connected") {
      app.textContent = error.message || "Prijava nije uspjela.";
      return;
    }
  }
  if (!session) { goLogin(); return; }
  startHeartbeat("hub");
  const who = document.querySelector("#who");
  if (who) who.textContent = session.profile.full_name || session.user.email;
  const out = document.querySelector("#signout");
  if (out) out.addEventListener("click", async () => { await signOut(); location.href = "/"; });
  await render();
}

boot();
