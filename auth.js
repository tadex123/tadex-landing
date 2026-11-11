// TADEX Hub auth module.
// Public interface: signIn, signOut, getSession, requestAccess, requestPasswordReset,
// verifyEmailLink + setNewPassword (used by /auth/confirm) (+ admin helpers listUsers, updateUser).
// Backend: Supabase (supabase-js v2, vendored), configured in config.js.
// Without config the hub is "not connected": submissions show a message, and
// ?preview=apps | ?preview=noapps | ?preview=admin render sample data for design review only.
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_STORAGE_KEY } from "./config.js";

// supabase-js v2 vendored (vendor/supabase.js, esbuild bundle of @supabase/supabase-js) — no CDN (jsDelivr is unreliable from China).
const SUPABASE_LIB = "/vendor/supabase.js";

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const p = new URLSearchParams(location.search).get("preview");
export const previewMode = !isConfigured && ["apps", "noapps", "admin", "direktor"].includes(p) ? p : null;

export class AuthError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// Capture what Supabase put in the URL after an email-confirmation link, before supabase-js consumes it.
const _hash = new URLSearchParams(location.hash.replace(/^#/, ""));
const _query = new URLSearchParams(location.search);
const _redirect = (() => {
  const err = _hash.get("error_description") || _query.get("error_description");
  const code = _hash.get("error_code") || _query.get("error_code");
  if (err || code) {
    return { kind: "error", message: code === "otp_expired"
      ? "This confirmation link has expired or was already used. Try signing in, or request access again."
      : "That link didn't work: " + (err || code).replace(/\+/g, " ") };
  }
  const type = _hash.get("type") || _query.get("type");
  if (_hash.get("access_token") && (type === "signup" || type === "email" || type === "invite")) return { kind: "confirmed" };
  return null;
})();

/** Info about an auth redirect in the URL (email confirmation), or null. Cleans the URL. */
export function consumeAuthRedirect() {
  if (_redirect || _hash.get("access_token") || _hash.get("error")) {
    history.replaceState(null, "", location.pathname + (previewParam() ? location.search : ""));
  }
  return _redirect;
}
function previewParam() { return new URLSearchParams(location.search).get("preview"); }

const MSG = {
  notConnected: "Sign-in is not connected yet.",
  requestNotConnected: "Requesting access is not connected yet.",
  pending: "Your account is waiting for approval.",
  confirmedPending: "Your email is confirmed. Your account is waiting for approval.",
};

// ---------- Supabase client (lazy) ----------
let clientPromise = null;
function sb() {
  if (!isConfigured) return Promise.reject(new AuthError("not_connected", MSG.notConnected));
  if (!clientPromise) {
    clientPromise = import(SUPABASE_LIB).then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit", storageKey: SUPABASE_STORAGE_KEY } })
    );
  }
  return clientPromise;
}

/** Same Supabase client the hub uses for sign-in, so other hub pages share that session. */
export function hubDb() {
  return sb();
}

async function fetchProfile(client, userId) {
  const { data, error } = await client
    .from("profiles").select("id,email,full_name,approved,is_admin,apps,app_roles,rank,app_perms,direktor_id,created_at")
    .eq("id", userId).maybeSingle();
  if (error) throw new AuthError("profile_error", "Could not load your account. Please try again.");
  return data;
}

function friendly(error) {
  const m = (error && error.message) || "";
  if (/invalid login credentials/i.test(m)) return "Wrong email or password.";
  if (/email not confirmed/i.test(m)) return "Please confirm your email first, then sign in.";
  if (/already registered/i.test(m)) return "This email already has an account. Try signing in.";
  if (/password/i.test(m) && /(at least|characters|weak)/i.test(m)) return m;
  if (/not authori[sz]ed/i.test(m) || /error sending/i.test(m)) return "We couldn't send the confirmation email right now. Please contact your admin.";
  if (/rate limit/i.test(m)) return "Too many attempts. Please wait a moment and try again.";
  const wait = m.match(/only request this after (\d+) seconds?/i);
  if (wait) return `Please wait ${wait[1]} seconds before asking for another email.`;
  if (/should be different from the old password/i.test(m)) return "Please choose a password that is different from your old one.";
  return m || "Something went wrong. Please try again.";
}

// ---------- Preview sample data (design review only, never real) ----------
const now = Date.now(), day = 86400000;
const preview = {
  users: [
    { id: "p1", email: "admin@example.com", full_name: "Admin Example", approved: true, is_admin: true, apps: ["calculator", "app2"], app_roles: { calculator: "admin", app2: "admin" }, app_perms: {}, direktor_id: null, created_at: new Date(now - 30 * day).toISOString() },
    { id: "p4", email: "direktor@example.com", full_name: "Direktor Example", approved: true, is_admin: false, apps: ["calculator", "app2", "crm"], app_roles: { calculator: "direktor", app2: "direktor", crm: "direktor" }, app_perms: {}, direktor_id: null, created_at: new Date(now - 20 * day).toISOString() },
    { id: "p2", email: "magda@example.com", full_name: "Magda Example", approved: true, is_admin: false, apps: ["calculator"], app_roles: { calculator: "operator" }, app_perms: {}, direktor_id: "p4", created_at: new Date(now - 12 * day).toISOString() },
    { id: "p3", email: "new.colleague@example.com", full_name: "New Colleague", approved: false, is_admin: false, apps: [], app_roles: {}, app_perms: {}, direktor_id: null, created_at: new Date(now - 1 * day).toISOString() },
  ],
};
function previewSession() {
  if (previewMode === "admin") return { user: { id: "p1", email: "admin@example.com" }, profile: preview.users[0] };
  if (previewMode === "direktor") {
    const d = preview.users.find(u => u.id === "p4");
    return { user: { id: d.id, email: d.email }, profile: { ...d } };
  }
  if (previewMode === "noapps") return { user: { id: "px", email: "team.member@example.com" }, profile: { id: "px", email: "team.member@example.com", approved: true, is_admin: false, apps: [] } };
  return { user: { id: "p2", email: "magda@example.com" }, profile: { ...preview.users.find(u => u.id === "p2"), apps: ["calculator", "app2"] } };
}

// ---------- Public API ----------

/** Returns { user, profile } for an approved user, or null. Throws AuthError('pending') if the stored session isn't approved. */
export async function getSession() {
  if (previewMode) return previewSession();
  if (!isConfigured) return null;
  const client = await sb();
  const { data } = await client.auth.getSession();
  const user = data && data.session && data.session.user;
  if (!user) return null;
  const profile = await fetchProfile(client, user.id);
  if (!profile || !profile.approved) {
    await client.auth.signOut();
    throw new AuthError("pending", _redirect && _redirect.kind === "confirmed" ? MSG.confirmedPending : MSG.pending);
  }
  return { user: { id: user.id, email: user.email }, profile };
}

/** Signs in with email + password. Resolves to { user, profile } or throws AuthError. */
export async function signIn(email, password) {
  if (!isConfigured) throw new AuthError("not_connected", MSG.notConnected);
  const client = await sb();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new AuthError("auth_error", friendly(error));
  const profile = await fetchProfile(client, data.user.id);
  if (!profile || !profile.approved) {
    await client.auth.signOut();
    throw new AuthError("pending", MSG.pending);
  }
  return { user: { id: data.user.id, email: data.user.email }, profile };
}

/** Creates an account that waits for admin approval. */
export async function requestAccess(email, password, fullName) {
  if (!isConfigured) throw new AuthError("not_connected", MSG.requestNotConnected);
  const full_name = String(fullName || "").trim().slice(0, 120);
  if (full_name.length < 2) throw new AuthError("signup_error", "Please enter your full name.");
  const client = await sb();
  const { data, error } = await client.auth.signUp({
    email, password,
    options: { emailRedirectTo: CONFIRM_URL(), data: { full_name } },
  });
  if (error) throw new AuthError("signup_error", friendly(error));
  // If "Confirm email" is off, Supabase signs the user in right away; they're not approved yet, so sign out.
  if (data && data.session) await client.auth.signOut();
  return true;
}

// Email links (signup confirmation, password reset, invite) point straight at tadexhub.com/auth/confirm
// (email templates use {{ .SiteURL }}/auth/confirm?token_hash=…&type=…), never at *.supabase.co.
// The page verifies the one-time token through our same-origin /sb proxy, so it also works from China.
const CONFIRM_URL = () => location.origin + "/auth/confirm";

/** Sends a password-reset email (no error for unknown emails: Supabase does not reveal whether an account exists). */
export async function requestPasswordReset(email) {
  if (!isConfigured) throw new AuthError("not_connected", MSG.notConnected);
  const client = await sb();
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: CONFIRM_URL() });
  if (error) throw new AuthError("reset_error", friendly(error));
  return true;
}

const LINK_TYPES = { email: "email", signup: "email", magiclink: "email", recovery: "recovery", invite: "invite", email_change: "email_change" };
export const linkKind = t => LINK_TYPES[t] || null;

/**
 * Verifies the one-time token from an email link and signs the person in.
 * Resolves to { user, profile } (profile may be unapproved — the caller decides what to show).
 */
export async function verifyEmailLink(tokenHash, type) {
  if (!isConfigured) throw new AuthError("not_connected", MSG.notConnected);
  const kind = linkKind(type);
  if (!tokenHash || !kind) throw new AuthError("bad_link", "This link is incomplete. Please open it again from the email.");
  const client = await sb();
  const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: kind });
  if (error || !data || !data.user) {
    const m = (error && error.message) || "";
    const expired = (error && (error.code === "otp_expired" || error.status === 403)) || /expired|invalid/i.test(m);
    throw new AuthError(expired ? "link_expired" : "link_error", expired
      ? "This link has expired or was already used."
      : "That link didn't work: " + (m || "please try again."));
  }
  const profile = await fetchProfile(client, data.user.id).catch(() => null);
  return { user: { id: data.user.id, email: data.user.email }, profile };
}

/** Sets a new password for the signed-in person (after a recovery/invite link). */
export async function setNewPassword(password) {
  const client = await sb();
  const { error } = await client.auth.updateUser({ password });
  if (error) throw new AuthError("password_error", friendly(error));
  return true;
}

export async function signOut() {
  if (previewMode || !isConfigured) return;
  const client = await sb();
  await client.rpc("hub_presence_signed_out").then(() => {}, () => {}); // who's online: gone now, not in 2-3 min
  await client.auth.signOut();
}

// ---------- Who's online (heartbeat; only admins can read presence) ----------
const HEARTBEAT_MS = 45000;
let beatTimer = null;
/** Starts the presence heartbeat (every 45 s while the tab is visible, immediately when it becomes visible). */
export function startHeartbeat(app = "hub") {
  if (previewMode || !isConfigured || beatTimer) return;
  const beat = async () => {
    if (document.visibilityState !== "visible") return;
    try { const client = await sb(); const { data } = await client.auth.getSession(); if (data && data.session) await client.rpc("hub_heartbeat", { p_app: app }); } catch { /* offline: try next time */ }
  };
  beat();
  beatTimer = setInterval(beat, HEARTBEAT_MS);
  document.addEventListener("visibilitychange", () => { if (beatTimer && document.visibilityState === "visible") beat(); });
}
export function stopHeartbeat() { clearInterval(beatTimer); beatTimer = null; }

/** Admin: presence rows { user_id, last_seen_at, app, signed_out_at } (RLS returns nothing to non-admins). */
export async function listPresence() {
  if (previewMode) {
    const t = Date.now();
    return [{ user_id: "p1", last_seen_at: new Date(t - 20000).toISOString(), app: "hub" },
            { user_id: "p2", last_seen_at: new Date(t - 40 * 60000).toISOString(), app: "kalkulator" }];
  }
  const client = await sb();
  const { data, error } = await client.from("hub_presence").select("user_id,last_seen_at,app,signed_out_at");
  if (error) throw new AuthError("admin_error", "Could not load who's online.");
  return data || [];
}

// ---------- Admin (RLS allows these only for profiles.is_admin = true) ----------
export async function listUsers() {
  if (previewMode) return preview.users.map(u => ({ ...u, apps: [...u.apps], app_roles: { ...u.app_roles } }));
  const client = await sb();
  const { data, error } = await client
    .from("profiles").select("id,email,full_name,approved,is_admin,apps,app_roles,rank,app_perms,direktor_id,created_at")
    .order("created_at", { ascending: false });
  if (error) throw new AuthError("admin_error", "Could not load users.");
  return data;
}

/** EUR/USD kurs stays Allow. A stored editRates/seeRates false is a Deny the calculator enforces. */
function withOpenKurs(perms) {
  const all = { ...(perms || {}) };
  all.calculator = { ...(all.calculator || {}), editRates: true, seeRates: true };
  return all;
}

/** changes: { approved?: boolean, apps?: string[], app_roles?: { [appId]: "admin" | "operator" } } */
export async function updateUser(id, changes) {
  const patch = {};
  if ("approved" in changes) patch.approved = !!changes.approved;
  if ("apps" in changes) patch.apps = changes.apps;
  if ("app_roles" in changes) patch.app_roles = changes.app_roles;
  if ("rank" in changes) patch.rank = String(changes.rank || "").trim().slice(0, 60);
  if ("app_perms" in changes) patch.app_perms = withOpenKurs(changes.app_perms);
  if ("direktor_id" in changes) patch.direktor_id = changes.direktor_id || null;
  if (previewMode) {
    const u = preview.users.find(x => x.id === id);
    if (u) Object.assign(u, patch);
    return { ...u };
  }
  const client = await sb();
  const { data, error } = await client.from("profiles").update(patch).eq("id", id).select().maybeSingle();
  if (error || !data) throw new AuthError("admin_error", "Could not save the change.");
  return data;
}

/** Direktor: team members + current calculator kurs overrides (editRates / seeRates). */
export async function listDirektorTeamKurs() {
  if (previewMode) {
    if (previewMode !== "direktor") return [];
    return preview.users
      .filter(u => u.direktor_id === "p4" && u.approved)
      .map(u => {
        const calc = (u.app_perms && u.app_perms.calculator) || {};
        const flag = (k) => (k in calc ? (calc[k] ? "allow" : "deny") : "");
        return { id: u.id, email: u.email, full_name: u.full_name, edit_rates: flag("editRates"), see_rates: flag("seeRates") };
      });
  }
  const client = await sb();
  const { data, error } = await client.rpc("hub_direktor_team_kurs");
  if (error) throw new AuthError("admin_error", friendly(error) || "Could not load your team.");
  return data || [];
}

/** Older Moj tim clients. EUR/USD kurs stays Allow for every member (Deny is not stored). */
export async function setDirektorTeamKurs(memberId, key) {
  if (!["editRates", "seeRates"].includes(key)) throw new AuthError("admin_error", "Invalid permission key.");
  const v = "allow";
  if (previewMode) {
    const u = preview.users.find(x => x.id === memberId);
    if (!u || u.direktor_id !== "p4") throw new AuthError("admin_error", "Person is not on your team.");
    u.app_perms = withOpenKurs(u.app_perms);
    return u.app_perms;
  }
  const client = await sb();
  const { data, error } = await client.rpc("hub_direktor_set_team_kurs", {
    p_member: memberId,
    p_key: key,
    p_value: v,
  });
  if (error) throw new AuthError("admin_error", friendly(error) || "Could not save the change.");
  return data;
}

/** Current access token (for same-origin app APIs such as /kalkulator/api/hub-policy). */
export async function accessToken() {
  if (previewMode || !isConfigured) return null;
  const client = await sb();
  const { data } = await client.auth.getSession();
  return (data && data.session && data.session.access_token) || null;
}
