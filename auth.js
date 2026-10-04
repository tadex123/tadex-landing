// TADEX Hub auth module.
// Public interface: signIn, signOut, getSession, requestAccess (+ admin helpers listUsers, updateUser).
// Backend: Supabase (supabase-js v2 from CDN), configured in config.js.
// Without config the hub is "not connected": submissions show a message, and
// ?preview=apps | ?preview=noapps | ?preview=admin render sample data for design review only.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const p = new URLSearchParams(location.search).get("preview");
export const previewMode = !isConfigured && ["apps", "noapps", "admin"].includes(p) ? p : null;

export class AuthError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const MSG = {
  notConnected: "Sign-in is not connected yet.",
  requestNotConnected: "Requesting access is not connected yet.",
  pending: "Your account is waiting for approval.",
};

// ---------- Supabase client (lazy) ----------
let clientPromise = null;
function sb() {
  if (!isConfigured) return Promise.reject(new AuthError("not_connected", MSG.notConnected));
  if (!clientPromise) {
    clientPromise = import(SUPABASE_CDN).then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
    );
  }
  return clientPromise;
}

async function fetchProfile(client, userId) {
  const { data, error } = await client
    .from("profiles").select("id,email,approved,is_admin,apps,created_at")
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
  if (/rate limit/i.test(m)) return "Too many attempts. Please wait a moment and try again.";
  return m || "Something went wrong. Please try again.";
}

// ---------- Preview sample data (design review only, never real) ----------
const now = Date.now(), day = 86400000;
const preview = {
  users: [
    { id: "p1", email: "admin@example.com", approved: true, is_admin: true, apps: ["calculator", "app2"], created_at: new Date(now - 30 * day).toISOString() },
    { id: "p2", email: "team.member@example.com", approved: true, is_admin: false, apps: ["calculator"], created_at: new Date(now - 12 * day).toISOString() },
    { id: "p3", email: "new.colleague@example.com", approved: false, is_admin: false, apps: [], created_at: new Date(now - 1 * day).toISOString() },
  ],
};
function previewSession() {
  if (previewMode === "admin") return { user: { id: "p1", email: "admin@example.com" }, profile: preview.users[0] };
  if (previewMode === "noapps") return { user: { id: "px", email: "team.member@example.com" }, profile: { id: "px", email: "team.member@example.com", approved: true, is_admin: false, apps: [] } };
  return { user: { id: "p2", email: "team.member@example.com" }, profile: { ...preview.users[1], apps: ["calculator", "app2"] } };
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
    throw new AuthError("pending", MSG.pending);
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
export async function requestAccess(email, password) {
  if (!isConfigured) throw new AuthError("not_connected", MSG.requestNotConnected);
  const client = await sb();
  const { data, error } = await client.auth.signUp({
    email, password,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  if (error) throw new AuthError("signup_error", friendly(error));
  // If "Confirm email" is off, Supabase signs the user in right away; they're not approved yet, so sign out.
  if (data && data.session) await client.auth.signOut();
  return true;
}

export async function signOut() {
  if (previewMode || !isConfigured) return;
  const client = await sb();
  await client.auth.signOut();
}

// ---------- Admin (RLS allows these only for profiles.is_admin = true) ----------
export async function listUsers() {
  if (previewMode) return preview.users.map(u => ({ ...u, apps: [...u.apps] }));
  const client = await sb();
  const { data, error } = await client
    .from("profiles").select("id,email,approved,is_admin,apps,created_at")
    .order("created_at", { ascending: false });
  if (error) throw new AuthError("admin_error", "Could not load users.");
  return data;
}

/** changes: { approved?: boolean, apps?: string[] } */
export async function updateUser(id, changes) {
  const patch = {};
  if ("approved" in changes) patch.approved = !!changes.approved;
  if ("apps" in changes) patch.apps = changes.apps;
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
