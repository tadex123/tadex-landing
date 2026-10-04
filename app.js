// TADEX Hub UI. Renders the signed-out form, the apps grid and the admin panel.
import * as auth from "./auth.js";

const APPS = [
  { id: "calculator", title: "Kalkulator", label: "Open app", href: "/kalkulator/",
    icon: '<rect x="5" y="2.5" width="14" height="19" rx="2.5"/><rect x="8" y="5.5" width="8" height="3.5" rx="1"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01"/>' },
  { id: "app2", title: "Povijest kalkulacija", label: "Open app", href: "/kalkulator/historija",
    icon: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v4.5h4.5"/><path d="M12 7.5V12l3 2"/>' },
  { id: "crm", title: "CRM", label: "Open app", href: "/kalkulator/crm",
    icon: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><path d="M15.5 5.3a3 3 0 0 1 0 5.4M17.5 14.8c1.7.6 2.7 2.2 3 4.7"/>' },
  // Placeholder for the next app: no access settings, shown to every signed-in person.
  { id: "app3", title: "Coming soon", label: "Reserved for a new app", href: "#", placeholder: true, public: true,
    icon: '<path d="M12 5v14M5 12h14"/>' },
];
const ADMIN_APPS = [{ id: "calculator", label: "Calculator" }, { id: "app2", label: "Povijest kalkulacija" }, { id: "crm", label: "CRM", noPerms: true }];
// One role model for every hub app: Admin / Direktor / Operator (Operator default). Enforced server-side by each app.
// Calculator: Admin = full + company settings + Operator policy + export; Direktor = full view, edits articles and
//   per-line duty, sees the team (read-only); Operator = company Operator defaults + per-person overrides.
// Povijest kalkulacija (app2): Admin and Direktor see everyone's calculations; Operator only their own
//   (unless the per-person "Sees all calculations" permission is allowed).
// CRM: Operator owns and sees only their own clients; Direktor sees all, assigns/reassigns clients and
//   approves final invoices; Admin = full (also deletes clients).
const ROLE_CHOICES = [["admin", "Admin"], ["direktor", "Direktor"], ["operator", "Operator"]];
const APP_ROLES = { calculator: ROLE_CHOICES, app2: ROLE_CHOICES, crm: ROLE_CHOICES };
const DEFAULT_ROLE = "operator";
// Teams: each Operator belongs to at most ONE Direktor (profiles.direktor_id). A Direktor's default view in
// Povijest kalkulacija and the CRM is their team (+ own); they can switch to "Svi". Admin sees everything.
const isDirektor = u => Object.values(u.app_roles || {}).includes("direktor");
const defaultRole = () => DEFAULT_ROLE;

// Calculator permission toggles (same keys as the calculator's company policy). Labels/defaults are
// loaded from /kalkulator/api/hub-policy when available; this list is the fallback.
const CALC_PERMS_FALLBACK = {
  operatorDefaults: null,
  edit: [["editArticles","Artikli"],["editLineDuty","Carina po artiklu"],["editRates","Kursevi"],["editFreight","Prijevoz"],
         ["editDefaultDuty","Podrazumijevana carina"],["editMargin","Marža"],["editVat","PDV stopa"]].map(([key,label]) => ({ key, label })),
  see: [["seePrices","Nabavne cijene"],["seeRates","Kursevi"],["seeFreight","Prijevoz"],["seeDuty","Carinske stope"],["seeMargin","Marža"],
        ["seeVat","PDV stopa"],["seeCost","Trošak uvoza (prijevoz, carina, trošak)"],["seeVpc","VPC"],["seeMpc","MPC"],
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

const HISTORY_PERMS = { operatorDefaults: { seeAll: false }, edit: [], see: [{ key: "seeAll", label: "Sees all calculations (all operators)" }] };
const permsFor = app => app === "app2" ? Promise.resolve(HISTORY_PERMS) : loadCalcPerms();

function permsEditor(u, perms, app = "calculator") {
  const over = ((u.app_perms || {})[app]) || {};
  const role = ((u.app_roles || {})[app]) || DEFAULT_ROLE;
  const isAdmin = role !== "operator"; // overrides apply to Operators only
  const defs = perms.operatorDefaults;
  const row = (o) => {
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
      <p class="muted small">${isAdmin ? (role === "admin" ? "Admin" : "Direktor") + " sees everyone's calculations." :
        "Operator sees only their own calculations by default. Allow to let this person see all operators' calculations."}</p>
      <div class="perm-cols"><div>${perms.see.map(row).join("")}</div></div></div>`;
  }
  return `<div class="perms"><h4>Calculator</h4>
    <p class="muted small">${role === "admin" ? "Calculator Admin has full access; per-person overrides apply to Operators only." :
      role === "direktor" ? "Direktor sees everything and edits articles and per-line duties; company settings stay Admin-only. Per-person overrides apply to Operators only." :
      "Inherits the Operator defaults set in the calculator (Admin panel). Choose Allow / Deny to override for this person only."}</p>
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
  const req = m === "request";
  $("#form-title").textContent = req ? "Request access" : "Sign in";
  $("#submit-label").textContent = req ? "Send request" : "Sign in";
  $("#toggle").textContent = req ? "Back to sign in" : "Request access";
  $("#toggle-lead").textContent = req ? "Already approved?" : "No account yet?";
  $("#password").autocomplete = req ? "new-password" : "current-password";
  $("#password").minLength = req ? 8 : 0;
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
    if (mode === "request") {
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

function renderApps() {
  const allowed = new Set(session.profile.apps || []);
  const visible = APPS.filter(a => a.public || allowed.has(a.id));
  const grid = $("#apps-grid");
  const none = !visible.some(a => !a.public) ? '<p class="empty">No apps assigned yet. Contact your admin.</p>' : "";
  grid.innerHTML = none + visible.map(a => `
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

async function renderAdmin() {
  const body = $("#admin-body");
  body.innerHTML = '<p class="muted">Loading users…</p>';
  try {
    const users = await auth.listUsers();
    if (!users.length) { body.innerHTML = '<p class="muted">No users yet.</p>'; return; }
    body.innerHTML = `
      <table class="users">
        <thead><tr><th>Person</th><th>Rank</th><th>Hub role</th><th>Requested</th><th>Status</th><th>Apps</th><th>Team (Direktor)</th><th><span class="sr">Action</span></th></tr></thead>
        <tbody>${users.map(u => {
          const self = u.id === session.user.id;
          return `<tr data-id="${esc(u.id)}">
            <td data-k="Person" class="who"><div><span class="who-name">${esc(u.full_name || "—")}</span><span class="who-email">${esc(u.email)}</span></div></td>
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
                ${a.noPerms ? "" : `<button type="button" class="perms-btn" data-perms="${a.id}" ${on ? "" : "disabled"}>Permissions${Object.keys(((u.app_perms || {})[a.id]) || {}).length ? " •" : ""}</button>`}</div>`; }).join("")}</div></td>
            <td data-k="Team (Direktor)">${teamCell(u, users)}</td>
            <td class="act">${self ? '<span class="muted small">You</span>' :
              `<button class="ab ${u.approved ? "revoke" : "approve"}" data-approved="${u.approved ? 1 : 0}">${u.approved ? "Revoke" : "Approve"}</button>`}</td>
          </tr>`; }).join("")}</tbody>
      </table>`;
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
            pbtn.textContent = "Permissions" + (Object.keys((saved.app_perms || {})[app] || {}).length ? " •" : "");
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
  else { setState("apps"); renderApps(); }
}

/** After sign-in: return to the app that sent the person here (if they have it). */
function goNext() {
  if (!NEXT || !session || auth.previewMode) return false;
  if (!(session.profile.apps || []).includes(NEXT.app)) {
    setStatus("");
    toast("You don't have access to that app yet. Ask your admin.", true);
    return false;
  }
  location.replace(NEXT.path);
  return true;
}

function renderSignedIn() {
  if (goNext()) return;
  renderChip();
  if (auth.previewMode === "admin" && !location.hash) history.replaceState(null, "", "#admin");
  route();
}

async function doSignOut(e) {
  e.preventDefault();
  await auth.signOut();
  session = null;
  if (auth.previewMode) { location.href = location.pathname; return; }
  history.replaceState(null, "", location.pathname + location.search);
  setMode("signin"); setState("out");
}

async function init() {
  $("#form").addEventListener("submit", onSubmit);
  $("#toggle").addEventListener("click", e => { e.preventDefault(); setMode(mode === "signin" ? "request" : "signin"); $("#email").focus(); });
  $("#signout").addEventListener("click", doSignOut);
  window.addEventListener("hashchange", route);
  if (auth.previewMode) $("#preview-flag").hidden = false;
  setMode("signin");
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
