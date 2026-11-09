// TADEX Hub UI. Renders the signed-out form, the apps grid and the admin panel.
import * as auth from "./auth.js";

// Off on tadexhub.com (Coming soon) until a later China-only unlock. Other hosts keep the live tile.
const QUOTES_ENABLED = !/(^|\.)tadexhub\.com$/.test(location.hostname);
const APPS = [
  { id: "calculator", title: "Kalkulator", label: "Open app", href: "/kalkulator/",
    icon: '<rect x="5" y="2.5" width="14" height="19" rx="2.5"/><rect x="8" y="5.5" width="8" height="3.5" rx="1"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01"/>' },
  { id: "app2", title: "Povijest kalkulacija", label: "Open app", href: "/kalkulator/historija",
    icon: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v4.5h4.5"/><path d="M12 7.5V12l3 2"/>' },
  { id: "crm", title: "CRM", label: "Open app", href: "/kalkulator/crm",
    icon: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><path d="M15.5 5.3a3 3 0 0 1 0 5.4M17.5 14.8c1.7.6 2.7 2.2 3 4.7"/>' },
  // app3 = Ponude · 报价单 · Quotations. On tadexhub.com the tile stays Coming soon; the /kalkulator/ponude app is unchanged.
  QUOTES_ENABLED
    ? { id: "app3", title: "Ponude · 报价单 · Quotations", label: "Open app", href: "/kalkulator/ponude",
        icon: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 12h5M10 15.5h5M10 8.5h2"/>' }
    : { id: "app3", title: "Coming soon", label: "Reserved for a new app", href: "#", placeholder: true, public: true,
        icon: '<path d="M12 5v14M5 12h14"/>' },
  // Unfinished transport suite (Grok Build frame). Admin always sees these; others only after Admin enables.
  { id: "posiljke", title: "Pošiljke", label: "Nacrt · Admin", href: "/kalkulator/posiljke", adminDraft: true,
    icon: '<path d="M3 7h18v10H3z"/><path d="M3 11h18"/><path d="M7 7V5h4v2"/>' },
  { id: "ture", title: "Ture", label: "Nacrt · Admin", href: "/kalkulator/ture", adminDraft: true,
    icon: '<circle cx="7" cy="17" r="2.5"/><circle cx="17" cy="17" r="2.5"/><path d="M3 13V8h9l4 5h3v5h-2"/><path d="M3 13h10"/>' },
  { id: "flota", title: "Flota · Vozni park", label: "Nacrt · Admin", href: "/kalkulator/flota", adminDraft: true,
    icon: '<rect x="3" y="10" width="18" height="7" rx="1.5"/><path d="M6 10V7h7l3 3"/><circle cx="7.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/>' },
];
const ADMIN_APPS = [{ id: "calculator", label: "Calculator" }, { id: "app2", label: "Povijest kalkulacija" }, { id: "crm", label: "CRM", noPerms: true },
  ...(QUOTES_ENABLED ? [{ id: "app3", label: "Ponude · Quotations", noPerms: true }] : []),
  { id: "posiljke", label: "Pošiljke (nacrt)", noPerms: true },
  { id: "ture", label: "Ture (nacrt)", noPerms: true },
  { id: "flota", label: "Flota (nacrt)", noPerms: true }];
// One role model for every hub app: Admin / Direktor / Operator (Operator default). Enforced server-side by each app.
// Calculator: Admin = full + company settings + Operator policy + export; Direktor = full view, edits articles and
//   per-line duty, sees the team (read-only); Operator = company Operator defaults + per-person overrides.
// Povijest kalkulacija (app2): Admin and Direktor see everyone's calculations; Operator only their own
//   (unless the per-person "Sees all calculations" permission is allowed).
// CRM: Operator owns and sees only their own clients; Direktor sees all, assigns/reassigns clients and
//   approves final invoices; Admin = full (also deletes clients).
const ROLE_CHOICES = [["admin", "Admin"], ["direktor", "Direktor"], ["operator", "Operator"]];
const APP_ROLES = { calculator: ROLE_CHOICES, app2: ROLE_CHOICES, crm: ROLE_CHOICES, app3: ROLE_CHOICES, posiljke: ROLE_CHOICES, ture: ROLE_CHOICES, flota: ROLE_CHOICES };
const DEFAULT_ROLE = "operator";
// Teams: each Operator belongs to at most ONE Direktor (profiles.direktor_id). A Direktor's default view in
// Povijest kalkulacija and the CRM is their team (+ own); they can switch to "Svi". Admin sees everything.
const isDirektor = u => Object.values(u.app_roles || {}).includes("direktor");
const defaultRole = () => DEFAULT_ROLE;

// Calculator permission toggles (same keys as the calculator's company policy). Labels/defaults are
// loaded from /kalkulator/api/hub-policy when available; this list is the fallback.
const CALC_PERMS_FALLBACK = {
  // Mirrors calculator DEFAULT_POLICY, except EUR/USD kurs: editRates and seeRates are open for
  // every approved member (the live hub-policy response may still say false until kalkulator ships).
  operatorDefaults: {
    editArticles: true, editLineDuty: false, editRates: true, editFreight: false, editDefaultDuty: false, editMargin: false, editVat: false,
    seePrices: true, seeRates: true, seeFreight: false, seeDuty: true, seeMargin: false, seeVat: false,
    seeCost: false, seeVpc: true, seeMpc: true, seePdv: false, seeFormula: false,
  },
  edit: [["editArticles","Artikli"],["editLineDuty","Carina po artiklu"],["editRates","Kursevi"],["editFreight","Prijevoz"],
         ["editDefaultDuty","Podrazumijevana carina"],["editMargin","Marža"],["editVat","PDV stopa"]].map(([key,label]) => ({ key, label })),
  see: [["seePrices","Nabavne cijene"],["seeRates","Kursevi"],["seeFreight","Prijevoz"],["seeDuty","Carinske stope"],["seeMargin","Marža"],
        ["seeVat","PDV stopa"],["seeCost","Trošak uvoza"],["seeVpc","VPC"],["seeMpc","MPC"],
        ["seePdv","Tabla PDV-a"],["seeFormula","Objašnjenje računice"]].map(([key,label]) => ({ key, label })),
};
let calcPerms = null;
async function loadCalcPerms() {
  if (calcPerms) return calcPerms;
  try {
    const token = await auth.accessToken();
    if (!token) throw new Error("no token");
    const r = await fetch("/kalkulator/api/hub-policy", { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
    if (!r.ok) throw new Error("status " + r.status);
    calcPerms = await r.json();
  } catch { calcPerms = CALC_PERMS_FALLBACK; }
  return calcPerms;
}

// Fallback copy of the calculator's DIREKTOR_POLICY (src/lib/access.ts) if hub-policy is unreachable.
const DIREKTOR_FALLBACK = { editArticles: true, editLineDuty: true, editRates: true, editFreight: false, editDefaultDuty: false, editMargin: true, editVat: false,
  seePrices: true, seeRates: true, seeFreight: true, seeDuty: true, seeMargin: true, seeVat: true, seeCost: true, seeVpc: true, seeMpc: true, seePdv: true, seeFormula: true };
const HISTORY_PERMS = { operatorDefaults: { seeAll: false }, edit: [], see: [{ key: "seeAll", label: "Sees all calculations (all operators)" }] };
const permsFor = app => app === "app2" ? Promise.resolve(HISTORY_PERMS) : loadCalcPerms();

function permsEditor(u, perms, app = "calculator") {
  const over = ((u.app_perms || {})[app]) || {};
  const role = ((u.app_roles || {})[app]) || DEFAULT_ROLE;
  // Admin always has everything (locked). Direktor and Operator: role defaults + per-person Allow / Deny.
  const isAdmin = role === "admin";
  const defs = isAdmin ? null
    : role === "direktor" ? (app === "app2" ? { seeAll: true } : (perms.direktorPolicy || DIREKTOR_FALLBACK))
    : perms.operatorDefaults;
  const row = (o) => {
    if (app === "calculator" && (o.key === "editRates" || o.key === "seeRates")) {
      return `<label class="perm"><span>${esc(o.label)}</span>
      <select data-fixed="yes" disabled><option selected>Allow (svi odobreni)</option></select></label>`;
    }
    if (isAdmin) {
      return `<label class="perm"><span>${esc(o.label)}</span>
      <select data-perm="${esc(o.key)}" data-fixed="yes" disabled><option selected>Admin (✓ yes)</option></select></label>`;
    }
    const d = defs ? (defs[o.key] ? "yes" : "no") : null;
    const v = o.key in over ? (over[o.key] ? "allow" : "deny") : "default";
    return `<label class="perm"><span>${esc(o.label)}</span>
      <select data-perm="${esc(o.key)}" ${isAdmin ? "disabled" : ""}>
        <option value="default" ${v === "default" ? "selected" : ""}>Default${d ? (d === "yes" ? " (✓ yes)" : " (✕ no)") : ""}</option>
        <option value="allow" ${v === "allow" ? "selected" : ""}>Allow</option>
        <option value="deny" ${v === "deny" ? "selected" : ""}>Deny</option>
      </select></label>`;
  };
  if (app === "app2") {
    return `<div class="perms"><h4>Povijest kalkulacija</h4>
      <p class="muted small">${isAdmin ? "Admin sees everyone's calculations." :
        role === "direktor" ? "Direktor sees their team by default and can switch to everyone (Svi). Deny to limit this person to their team." :
        "Operator sees only their own calculations by default. Allow to let this person see all operators' calculations."}</p>
      <div class="perm-cols"><div>${perms.see.map(row).join("")}</div></div></div>`;
  }
  return `<div class="perms"><h4>Calculator</h4>
    <p class="muted small">${role === "admin" ? "Calculator Admin always has full access (locked)." :
      role === "direktor" ? "Direktor defaults: sees everything (incl. exchange rates and margin) and edits articles, per-line duties, and EUR/USD rates. Freight, default duty, margin and VAT stay on the role default until you choose Allow or Deny. Kursevi (EUR/USD) are open for every approved member." :
      "Inherits the Operator defaults set in the calculator (Admin panel). Choose Allow / Deny to override for this person only. Kursevi (EUR/USD) are open for every approved member. Trošak uvoza is off by default for Operators — set Allow to unlock it."}</p>
    <div class="perm-cols"><div><h4>Can edit</h4>${perms.edit.map(row).join("")}</div>
    <div><h4>Can see</h4>${perms.see.map(row).join("")}</div></div></div>`;
}

// ?next=/kalkulator/... : where to go after sign-in (same-origin app paths only).
const NEXT = (() => {
  const raw = new URLSearchParams(location.search).get("next") || "";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  const path = raw.split(/[?#]/)[0];
  const app = APPS.filter(a => !a.placeholder && (path === a.href.replace(/\/$/, "") || path.startsWith(a.href.endsWith("/") ? a.href : a.href + "/") || path === a.href))
    .sort((x, y) => y.href.length - x.href.length)[0];
  return app ? { path: raw, app: app.id } : null;
})();

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = iso => iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";

let session = null;
let mode = "signin"; // or "request"

function setStatus(text, kind = "info") {
  const el = $("#status");
  el.textContent = text || "";
  el.className = "status" + (text ? " show " + kind : "");
}

function setState(state) {
  document.body.dataset.state = state; // out | apps | admin
  $("#sub").textContent = state === "out"
    ? "Good to see you. This is your team space. Sign in to pick up where you left off."
    : "Good to see you. Here's everything you have access to.";
}

// ---------- Signed-out form ----------
function setMode(m) {
  mode = m;
  const req = m === "request", reset = m === "reset";
  $("#form-title").textContent = req ? "Request access" : reset ? "Reset password" : "Sign in";
  $("#submit-label").textContent = req ? "Send request" : reset ? "Send reset link" : "Sign in";
  $("#toggle").textContent = req || reset ? "Back to sign in" : "Request access";
  $("#toggle-lead").textContent = req ? "Already approved?" : reset ? "Remembered it?" : "No account yet?";
  $("#password").autocomplete = req ? "new-password" : "current-password";
  $("#password").minLength = req ? 8 : 0;
  $("#password").required = !reset;
  $("#password-field").hidden = reset;
  $("#forgot-row").hidden = m !== "signin";
  $("#reset-hint").hidden = !reset;
  $("#name-field").hidden = !req;
  $("#full-name").required = req;
  setStatus("");
}

async function onSubmit(e) {
  e.preventDefault();
  const email = $("#email").value.trim();
  const password = $("#password").value;
  const fullName = $("#full-name").value.trim();
  const btn = $("#submit");
  btn.disabled = true; btn.classList.add("busy");
  try {
    if (mode === "reset") {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setStatus("Please enter the email you use for TADEX Hub.", "error"); $("#email").focus(); return; }
      await auth.requestPasswordReset(email);
      setStatus(`If ${email} has a TADEX Hub account, a reset link is on its way. Open it on this or any device — it takes you to tadexhub.com to choose a new password.`, "ok");
    } else if (mode === "request") {
      if (fullName.length < 2) { setStatus("Please enter your full name (Ime i prezime).", "error"); $("#full-name").focus(); return; }
      await auth.requestAccess(email, password, fullName);
      $("#form").reset();
      setStatus("Your request was sent. You'll get access once the admin approves it.", "ok");
    } else {
      session = await auth.signIn(email, password);
      $("#form").reset();
      renderSignedIn();
    }
  } catch (err) {
    setStatus(err.message || "Something went wrong. Please try again.", err.code === "pending" ? "warn" : "error");
  } finally {
    btn.disabled = false; btn.classList.remove("busy");
  }
}

// ---------- Signed-in ----------
function renderChip() {
  const { user, profile } = session;
  $("#chip-initial").textContent = (profile.full_name || user.email || "?").charAt(0).toUpperCase();
  $("#chip-email").textContent = profile.full_name || user.email;
  $("#chip-email").title = user.email;
  $("#admin-link").hidden = !profile.is_admin;
}

function hasAppAccess(appId, allowed) {
  if (allowed.has(appId)) return true;
  // Ponude shares calculator access so the team does not need a separate Admin checkbox to open the live tile.
  if (appId === "app3" && QUOTES_ENABLED && allowed.has("calculator")) return true;
  return false;
}

function renderApps() {
  const allowed = new Set(session.profile.apps || []);
  const isAdmin = !!session.profile.is_admin;
  const isOwner = session.user.email === "tadijasaric92@gmail.com";
  const visible = APPS.filter(a => a.public || hasAppAccess(a.id, allowed) || (a.adminDraft && isAdmin));
  const grid = $("#apps-grid");
  const ownerTile = isOwner ? `
    <a class="tile" href="/kalendar/">
      <span class="tile-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></span>
      <span class="tile-title">Moj Kalendar</span>
      <span class="tile-label">Privatni raspored <span aria-hidden="true">→</span></span>
    </a>` : "";
  const none = !isOwner && !visible.some(a => !a.public) ? '<p class="empty">No apps assigned yet. Contact your admin.</p>' : "";
  grid.innerHTML = none + ownerTile + visible.map(a => `
    <a class="tile${a.placeholder ? " placeholder" : ""}" href="${a.href}"${a.placeholder ? ' data-placeholder="1"' : ""}>
      <span class="tile-ic"><svg viewBox="0 0 24 24" aria-hidden="true">${a.icon}</svg></span>
      <span class="tile-title">${esc(a.title)}</span>
      <span class="tile-label">${esc(a.label)}${a.placeholder ? "" : ' <span aria-hidden="true">→</span>'}</span>
    </a>`).join("");
  grid.querySelectorAll("[data-placeholder]").forEach(el => el.addEventListener("click", e => e.preventDefault()));
}

/** Team picker: which Direktor this person reports to (one per person). Direktors and admins lead, not join. */
function teamCell(u, users) {
  const leads = users.filter(x => x.id !== u.id && x.approved && isDirektor(x));
  if (u.is_admin) return '<span class="muted small">Admin — sees all</span>';
  if (isDirektor(u) && !u.direktor_id) {
    const n = users.filter(x => x.direktor_id === u.id).length;
    return `<span class="muted small">Direktor · team: ${n}</span>`;
  }
  if (!leads.length) return '<span class="muted small">No Direktor yet</span>';
  return `<select class="app-role" data-direktor aria-label="Team (Direktor)">
    <option value="">— none —</option>
    ${leads.map(d => `<option value="${esc(d.id)}" ${u.direktor_id === d.id ? "selected" : ""}>${esc(d.full_name || d.email)}</option>`).join("")}
  </select>`;
}


/** True when this hub profile is Kalkulator Direktor (sees the kurs notice). */
function isCalculatorDirektor(profile) {
  return ((profile && profile.app_roles) || {}).calculator === "direktor";
}

function renderTeamKurs() {
  const box = $("#team-kurs");
  const body = $("#team-kurs-body");
  if (!box || !body || !session) return;
  const show = isCalculatorDirektor(session.profile);
  box.hidden = !show;
  body.innerHTML = "";
}

/** Permissions dot ignores the always-on kurs flags so they don't look like a personal override. */
function permMark(perms, app) {
  const mine = { ...(((perms || {})[app]) || {}) };
  if (app === "calculator") {
    delete mine.editRates;
    delete mine.seeRates;
  }
  return Object.keys(mine).length ? " •" : "";
}

// ---------- Who's online (Admin only) ----------
const ONLINE_MS = 150000; // no heartbeat for 2.5 min (heartbeat is every 45 s) = offline
const APP_NAMES = { hub: "TADEX Hub", kalkulator: "Kalkulator", historija: "Povijest kalkulacija", crm: "CRM", ponude: "Ponude", posiljke: "Pošiljke", ture: "Ture", flota: "Flota" };
let presenceTimer = null;
function ago(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
function presenceOf(row, now) {
  if (!row) return { online: false, text: "Never seen" };
  const seen = Date.parse(row.last_seen_at);
  const out = row.signed_out_at && Date.parse(row.signed_out_at) >= seen;
  const where = APP_NAMES[row.app] || "TADEX Hub";
  if (!out && now - seen < ONLINE_MS) return { online: true, text: `Online · ${where}`, seen };
  return { online: false, text: out ? `Signed out ${ago(now - Date.parse(row.signed_out_at))}` : `Last seen ${ago(now - seen)} · ${where}`, seen };
}
async function refreshPresence(users) {
  const box = $("#online");
  if (!box) return;
  let rows;
  try { rows = await auth.listPresence(); } catch { box.querySelector(".online-list").innerHTML = '<p class="muted small">Could not load who\'s online.</p>'; return; }
  const now = Date.now(), by = new Map(rows.map(r => [r.user_id, r]));
  // The admin looking at this is online by definition (their own first heartbeat may still be in flight).
  const me = session.user.id;
  const people = users.filter(u => u.approved).map(u => ({ u, p: u.id === me ? { online: true, text: "Online · TADEX Hub", seen: now } : presenceOf(by.get(u.id), now) }))
    .sort((a, b) => (b.p.online - a.p.online) || ((b.p.seen || 0) - (a.p.seen || 0)));
  const n = people.filter(x => x.p.online).length;
  box.querySelector(".online-count").textContent = n === 1 ? "1 online" : `${n} online`;
  box.querySelector(".online-list").innerHTML = people.map(({ u, p }) => `
    <li class="pres-item${p.online ? " on" : ""}" data-pres-id="${esc(u.id)}">
      <span class="pres-dot${p.online ? " on" : ""}" aria-hidden="true"></span>
      <span class="pres-name">${esc(u.full_name || u.email)}${u.id === session.user.id ? ' <span class="muted small">(you)</span>' : ""}</span>
      <span class="pres-when" title="${p.seen ? esc(new Date(p.seen).toLocaleString()) : ""}">${esc(p.text)}</span>
    </li>`).join("") || '<li class="muted small">No approved people yet.</li>';
  document.querySelectorAll("tr[data-id] .who-dot").forEach(dot => {
    const id = dot.closest("tr").dataset.id;
    const p = id === me ? { online: true, text: "Online" } : presenceOf(by.get(id), now);
    dot.classList.toggle("on", p.online); dot.title = p.text;
  });
  box.dataset.updated = String(now);
}
function startPresence(users) {
  clearInterval(presenceTimer);
  refreshPresence(users);
  presenceTimer = setInterval(() => { if (document.body.dataset.state !== "admin") { clearInterval(presenceTimer); presenceTimer = null; return; } if (document.visibilityState === "visible") refreshPresence(users); }, 30000);
}

async function renderAdmin() {
  const body = $("#admin-body");
  body.innerHTML = '<p class="muted">Loading users…</p>';
  try {
    const users = await auth.listUsers();
    if (!users.length) { body.innerHTML = '<p class="muted">No users yet.</p>'; return; }
    body.innerHTML = `
      <section class="online" id="online" aria-labelledby="online-title">
        <div class="online-head"><h3 id="online-title"><span class="pres-dot on" aria-hidden="true"></span>Who's online</h3><span class="online-count"></span><span class="muted small online-note">Updates every 30 s · offline after 2–3 min without activity</span></div>
        <ul class="online-list"><li class="muted small">Loading…</li></ul>
      </section>
      <table class="users">
        <thead><tr><th>Person</th><th>Rank</th><th>Hub role</th><th>Requested</th><th>Status</th><th>Apps</th><th>Team (Direktor)</th><th><span class="sr">Action</span></th></tr></thead>
        <tbody>${users.map(u => {
          const self = u.id === session.user.id;
          return `<tr data-id="${esc(u.id)}">
            <td data-k="Person" class="who"><div><span class="who-name"><span class="who-dot" aria-hidden="true"></span>${esc(u.full_name || "—")}</span><span class="who-email">${esc(u.email)}</span></div></td>
            <td data-k="Rank"><input class="rank" data-rank type="text" maxlength="60" placeholder="e.g. Komercijalista" value="${esc(u.rank || "")}" aria-label="Rank"></td>
            <td data-k="Hub role"><span class="role ${u.is_admin ? "admin" : "operator"}">${u.is_admin ? "Admin" : "Operator"}</span></td>
            <td data-k="Requested">${esc(fmtDate(u.created_at))}</td>
            <td data-k="Status"><span class="badge ${u.approved ? "ok" : "wait"}">${u.approved ? "Approved" : "Pending"}</span></td>
            <td data-k="Apps"><div class="checks">${ADMIN_APPS.map(a => {
              const on = (u.apps || []).includes(a.id);
              const role = (u.app_roles || {})[a.id] || defaultRole(a.id);
              return `<div class="app-row"><label><input type="checkbox" data-app="${a.id}" ${on ? "checked" : ""}> ${a.label}</label>
              <select class="app-role" data-role-for="${a.id}" aria-label="${esc(a.label)} role" ${on ? "" : "disabled"}>${APP_ROLES[a.id].map(([v, l]) =>
                `<option value="${v}" ${v === role ? "selected" : ""}>${l}</option>`).join("")}</select>
                ${a.noPerms ? "" : `<button type="button" class="perms-btn" data-perms="${a.id}" ${on ? "" : "disabled"}>Permissions${permMark(u.app_perms, a.id)}</button>`}</div>`; }).join("")}</div></td>
            <td data-k="Team (Direktor)">${teamCell(u, users)}</td>
            <td class="act">${self ? '<span class="muted small">You</span>' :
              `<button class="ab ${u.approved ? "revoke" : "approve"}" data-approved="${u.approved ? 1 : 0}">${u.approved ? "Revoke" : "Approve"}</button>`}</td>
          </tr>`; }).join("")}</tbody>
      </table>`;
    startPresence(users);
    body.querySelectorAll("tr[data-id]").forEach(tr => {
      const id = tr.dataset.id;
      const current = users.find(x => x.id === id);
      const rolesNow = () => {
        const roles = { ...(current.app_roles || {}) };
        tr.querySelectorAll("select[data-role-for]").forEach(sel => {
          const on = tr.querySelector(`input[data-app="${sel.dataset.roleFor}"]`).checked;
          if (on) roles[sel.dataset.roleFor] = sel.value;
        });
        return roles;
      };
      tr.querySelectorAll("input[data-app]").forEach(cb => cb.addEventListener("change", async () => {
        const apps = [...tr.querySelectorAll("input[data-app]:checked")].map(x => x.dataset.app);
        const sel = tr.querySelector(`select[data-role-for="${cb.dataset.app}"]`);
        const app_roles = rolesNow();
        cb.disabled = true;
        try {
          const saved = await auth.updateUser(id, { apps, app_roles });
          current.apps = saved.apps; current.app_roles = saved.app_roles;
          if (sel) sel.disabled = !cb.checked;
          const pb = tr.querySelector(`button[data-perms="${cb.dataset.app}"]`);
          if (pb) pb.disabled = !cb.checked;
          toast("Saved");
        }
        catch (e) { cb.checked = !cb.checked; toast(e.message, true); }
        finally { cb.disabled = false; }
      }));
      const team = tr.querySelector("select[data-direktor]");
      if (team) team.addEventListener("change", async () => {
        const before = current.direktor_id || "";
        team.disabled = true;
        try { const saved = await auth.updateUser(id, { direktor_id: team.value || null }); current.direktor_id = saved.direktor_id; toast("Saved"); renderAdmin(); }
        catch (e) { team.value = before; toast(e.message, true); }
        finally { team.disabled = false; }
      });
      const rank = tr.querySelector("input[data-rank]");
      rank.addEventListener("change", async () => {
        rank.disabled = true;
        try { const saved = await auth.updateUser(id, { rank: rank.value }); current.rank = saved.rank; rank.value = saved.rank; toast("Saved"); }
        catch (e) { rank.value = current.rank || ""; toast(e.message, true); }
        finally { rank.disabled = false; }
      });
      const openPerms = async (pbtn) => {
        const app = pbtn.dataset.perms;
        const next = tr.nextElementSibling;
        const isOpen = next && next.classList.contains("perm-row");
        if (isOpen) { const same = next.dataset.app === app; next.remove(); if (same) return; }
        const perms = await permsFor(app);
        const pr = document.createElement("tr");
        pr.className = "perm-row";
        pr.dataset.app = app;
        pr.innerHTML = `<td colspan="9">${permsEditor(current, perms, app)}</td>`;
        tr.after(pr);
        pr.querySelectorAll("select[data-perm]").forEach(sel => sel.addEventListener("change", async () => {
          const all = { ...(current.app_perms || {}) };
          const mine = { ...(all[app] || {}) };
          const before = sel.dataset.perm in mine ? (mine[sel.dataset.perm] ? "allow" : "deny") : "default";
          if (sel.value === "default") delete mine[sel.dataset.perm]; else mine[sel.dataset.perm] = sel.value === "allow";
          all[app] = mine;
          sel.disabled = true;
          try {
            const saved = await auth.updateUser(id, { app_perms: all });
            current.app_perms = saved.app_perms;
            pbtn.textContent = "Permissions" + permMark(saved.app_perms, app);
            toast("Saved");
          } catch (e) { sel.value = before; toast(e.message, true); }
          finally { sel.disabled = false; }
        }));
      };
      tr.querySelectorAll("button[data-perms]").forEach(pbtn => pbtn.addEventListener("click", () => openPerms(pbtn)));
      tr.querySelectorAll("select[data-role-for]").forEach(sel => sel.addEventListener("change", async () => {
        const before = (current.app_roles || {})[sel.dataset.roleFor] || defaultRole(sel.dataset.roleFor);
        sel.disabled = true;
        try {
          const saved = await auth.updateUser(id, { app_roles: rolesNow() });
          current.app_roles = saved.app_roles;
          const pr = tr.nextElementSibling;
          if (pr && pr.classList.contains("perm-row") && pr.dataset.app === sel.dataset.roleFor) {
            pr.remove(); openPerms(tr.querySelector(`button[data-perms="${sel.dataset.roleFor}"]`));
          }
          toast("Saved");
        }
        catch (e) { sel.value = before; toast(e.message, true); }
        finally { sel.disabled = !tr.querySelector(`input[data-app="${sel.dataset.roleFor}"]`).checked; }
      }));
      const btn = tr.querySelector("button.ab");
      if (btn) btn.addEventListener("click", async () => {
        btn.disabled = true;
        try { await auth.updateUser(id, { approved: btn.dataset.approved !== "1" }); toast("Saved"); renderAdmin(); }
        catch (e) { toast(e.message, true); btn.disabled = false; }
      });
    });
  } catch (e) {
    body.innerHTML = `<p class="muted">${esc(e.message)}</p>`;
  }
}

let toastTimer;
function toast(text, bad) {
  const t = $("#toast");
  t.textContent = text; t.className = "toast show" + (bad ? " bad" : "");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = "toast"), 2200);
}

function route() {
  if (!session) return setState("out");
  if (location.hash === "#admin" && session.profile.is_admin) { setState("admin"); renderAdmin(); }
  else { setState("apps"); renderApps(); renderTeamKurs(); }
}

/** After sign-in: return to the app that sent the person here (if they have it). */
function goNext() {
  if (!NEXT || !session || auth.previewMode) return false;
  const apps = session.profile.apps || [];
  if (!hasAppAccess(NEXT.app, new Set(apps))) {
    setStatus("");
    toast("You don't have access to that app yet. Ask your admin.", true);
    return false;
  }
  location.replace(NEXT.path);
  return true;
}

function renderSignedIn() {
  if (goNext()) return;
  auth.startHeartbeat("hub");
  renderChip();
  if (auth.previewMode === "admin" && !location.hash) history.replaceState(null, "", "#admin");
  route();
}

async function doSignOut(e) {
  e.preventDefault();
  auth.stopHeartbeat();
  await auth.signOut();
  session = null;
  if (auth.previewMode) { location.href = location.pathname; return; }
  history.replaceState(null, "", location.pathname + location.search);
  setMode("signin"); setState("out");
}

async function init() {
  $("#form").addEventListener("submit", onSubmit);
  $("#toggle").addEventListener("click", e => { e.preventDefault(); setMode(mode === "signin" ? "request" : "signin"); $("#email").focus(); });
  $("#forgot").addEventListener("click", e => { e.preventDefault(); setMode("reset"); $("#email").focus(); });
  $("#signout").addEventListener("click", doSignOut);
  window.addEventListener("hashchange", route);
  if (auth.previewMode) $("#preview-flag").hidden = false;
  // /?reset=1 (from an expired reset link on /auth/confirm) opens "Reset password" directly.
  const wantsReset = new URLSearchParams(location.search).get("reset") === "1";
  setMode(wantsReset ? "reset" : "signin");
  if (wantsReset) history.replaceState(null, "", location.pathname + location.hash);
  let redirect = null;
  try {
    session = await auth.getSession();
    redirect = auth.consumeAuthRedirect();
    if (!session && redirect) setStatus(redirect.kind === "error" ? redirect.message : "Your email is confirmed. You can sign in now.", redirect.kind === "error" ? "error" : "ok");
  } catch (err) {
    session = null;
    auth.consumeAuthRedirect();
    setStatus(err.message, err.code === "pending" ? "warn" : "error");
  }
  if (session) renderSignedIn(); else setState("out");
  document.body.classList.remove("booting");
}
init();
