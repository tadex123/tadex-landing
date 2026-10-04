// TADEX Hub UI. Renders the signed-out form, the apps grid and the admin panel.
import * as auth from "./auth.js";

const APPS = [
  { id: "calculator", title: "Kalkulator", label: "Open app", href: "/kalkulator/",
    icon: '<rect x="5" y="2.5" width="14" height="19" rx="2.5"/><rect x="8" y="5.5" width="8" height="3.5" rx="1"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01"/>' },
  { id: "app2", title: "Coming soon", label: "Reserved for a new app", href: "#", placeholder: true,
    icon: '<path d="M12 5v14M5 12h14"/>' },
];
const ADMIN_APPS = [{ id: "calculator", label: "Calculator" }, { id: "app2", label: "App 2" }];

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
  setStatus("");
}

async function onSubmit(e) {
  e.preventDefault();
  const email = $("#email").value.trim();
  const password = $("#password").value;
  const btn = $("#submit");
  btn.disabled = true; btn.classList.add("busy");
  try {
    if (mode === "request") {
      await auth.requestAccess(email, password);
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
  $("#chip-initial").textContent = (user.email || "?").charAt(0).toUpperCase();
  $("#chip-email").textContent = user.email;
  $("#admin-link").hidden = !profile.is_admin;
}

function renderApps() {
  const allowed = new Set(session.profile.apps || []);
  const visible = APPS.filter(a => allowed.has(a.id));
  const grid = $("#apps-grid");
  if (!visible.length) {
    grid.innerHTML = '<p class="empty">No apps assigned yet. Contact your admin.</p>';
    return;
  }
  grid.innerHTML = visible.map(a => `
    <a class="tile${a.placeholder ? " placeholder" : ""}" href="${a.href}"${a.placeholder ? ' data-placeholder="1"' : ""}>
      <span class="tile-ic"><svg viewBox="0 0 24 24" aria-hidden="true">${a.icon}</svg></span>
      <span class="tile-title">${esc(a.title)}</span>
      <span class="tile-label">${esc(a.label)}${a.placeholder ? "" : ' <span aria-hidden="true">→</span>'}</span>
    </a>`).join("");
  grid.querySelectorAll("[data-placeholder]").forEach(el => el.addEventListener("click", e => e.preventDefault()));
}

async function renderAdmin() {
  const body = $("#admin-body");
  body.innerHTML = '<p class="muted">Loading users…</p>';
  try {
    const users = await auth.listUsers();
    if (!users.length) { body.innerHTML = '<p class="muted">No users yet.</p>'; return; }
    body.innerHTML = `
      <table class="users">
        <thead><tr><th>Email</th><th>Requested</th><th>Status</th><th>Apps</th><th><span class="sr">Action</span></th></tr></thead>
        <tbody>${users.map(u => {
          const self = u.id === session.user.id;
          return `<tr data-id="${esc(u.id)}">
            <td data-k="Email" class="em">${esc(u.email)}${u.is_admin ? ' <span class="tag">Admin</span>' : ""}</td>
            <td data-k="Requested">${esc(fmtDate(u.created_at))}</td>
            <td data-k="Status"><span class="badge ${u.approved ? "ok" : "wait"}">${u.approved ? "Approved" : "Pending"}</span></td>
            <td data-k="Apps"><div class="checks">${ADMIN_APPS.map(a => `
              <label><input type="checkbox" data-app="${a.id}" ${(u.apps || []).includes(a.id) ? "checked" : ""}> ${a.label}</label>`).join("")}</div></td>
            <td class="act">${self ? '<span class="muted small">You</span>' :
              `<button class="ab ${u.approved ? "revoke" : "approve"}" data-approved="${u.approved ? 1 : 0}">${u.approved ? "Revoke" : "Approve"}</button>`}</td>
          </tr>`; }).join("")}</tbody>
      </table>`;
    body.querySelectorAll("tr[data-id]").forEach(tr => {
      const id = tr.dataset.id;
      tr.querySelectorAll("input[data-app]").forEach(cb => cb.addEventListener("change", async () => {
        const apps = [...tr.querySelectorAll("input[data-app]:checked")].map(x => x.dataset.app);
        cb.disabled = true;
        try { await auth.updateUser(id, { apps }); toast("Saved"); }
        catch (e) { cb.checked = !cb.checked; toast(e.message, true); }
        finally { cb.disabled = false; }
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

function renderSignedIn() {
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
