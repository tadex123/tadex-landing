// /auth/confirm — where every TADEX Hub account email lands (tadexhub.com, never *.supabase.co).
// Email templates link to {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<email|recovery|invite>.
// The token is verified here through the same-origin /sb proxy (works from China), so:
//   type=email (signup confirmation): confirm, then "waiting for approval" or straight into the hub;
//   type=recovery / invite: ask for a new password first, verify on submit (mail scanners that pre-open
//   links can't burn the one-time token), save it, then into the hub.
import * as auth from "./auth.js";

const $ = s => document.querySelector(s);
const q = new URLSearchParams(location.search);
const tokenHash = q.get("token_hash");
const type = q.get("type");
const kind = auth.linkKind(type);

// Old-style links (#access_token=… from emails sent before the switch) are handled by the hub page.
if (!tokenHash && /access_token=|error=/.test(location.hash)) location.replace("/" + location.hash);
// Keep the one-time token out of the address bar / history once we've read it.
history.replaceState(null, "", location.pathname);

function show({ title, lead, icon = "lock", spinner = false, form = false, status = "", statusKind = "ok", action = null }) {
  $("#title").textContent = title;
  $("#lead").textContent = lead || "";
  $("#lead").hidden = !lead;
  $("#icon").classList.toggle("ok", icon === "ok");
  if (icon === "ok") $("#icon").innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  $("#spinner").hidden = !spinner;
  $("#pw-form").hidden = !form;
  const st = $("#status");
  st.textContent = status;
  st.className = "status" + (status ? " show " + statusKind : "");
  const a = $("#action");
  a.hidden = !action;
  if (action) { a.href = action.href; $("#action-label").textContent = action.label; }
}

function goHub(title, lead) {
  show({ title, lead, icon: "ok", spinner: true });
  setTimeout(() => location.replace("/"), 1200);
}

function linkFailed(err, isPassword) {
  const expired = err && err.code === "link_expired";
  show({
    title: expired ? "This link has expired" : "That link didn't work",
    lead: expired
      ? (isPassword ? "Reset links work once and expire after an hour. Ask for a new one below." : "Confirmation links work once and expire after an hour. If you already confirmed your email, just sign in.")
      : (err && err.message) || "Please try again.",
    action: isPassword ? { href: "/?reset=1", label: "Send a new reset link" } : { href: "/#signin", label: "Go to sign in" },
  });
}

async function confirmEmail() {
  show({ title: "Confirming your email…", lead: "This takes a second.", spinner: true });
  let res;
  try { res = await auth.verifyEmailLink(tokenHash, type); }
  catch (err) { return linkFailed(err, false); }
  if (res.profile && res.profile.approved) return goHub("Email confirmed", "Opening TADEX Hub…");
  await auth.signOut().catch(() => {});
  show({ title: "Email confirmed", icon: "ok",
    lead: "Thanks! Your account is now waiting for the admin's approval. You'll be able to sign in at tadexhub.com as soon as it's approved.",
    action: { href: "/", label: "Go to TADEX Hub" } });
}

function askPassword() {
  const invite = kind === "invite";
  show({ title: invite ? "Choose your password" : "Choose a new password",
    lead: invite ? "Welcome to TADEX Hub. Pick a password to finish setting up your account." : "Pick a new password for your TADEX Hub account.",
    form: true });
  $("#pw-label").textContent = invite ? "Save password" : "Save new password";
  $("#pw1").focus();
  let verified = null; // verify once; if saving fails (e.g. too short) the person can retry without a new link
  $("#pw-form").addEventListener("submit", async e => {
    e.preventDefault();
    const p1 = $("#pw1").value, p2 = $("#pw2").value;
    const err = m => { $("#status").textContent = m; $("#status").className = "status show error"; };
    if (p1.length < 8) return err("Use at least 8 characters.");
    if (p1 !== p2) return err("The two passwords don't match.");
    const btn = $("#pw-submit"); btn.disabled = true; btn.classList.add("busy");
    try {
      if (!verified) {
        try { verified = await auth.verifyEmailLink(tokenHash, type); }
        catch (ex) { return linkFailed(ex, true); }
      }
      await auth.setNewPassword(p1);
      if (verified.profile && verified.profile.approved) return goHub("Password saved", "Signing you in to TADEX Hub…");
      await auth.signOut().catch(() => {});
      show({ title: "Password saved", icon: "ok",
        lead: "Your account is waiting for the admin's approval. You'll be able to sign in with this password as soon as it's approved.",
        action: { href: "/", label: "Go to TADEX Hub" } });
    } catch (ex) {
      err(ex.message || "Could not save the password. Please try again.");
    } finally { btn.disabled = false; btn.classList.remove("busy"); }
  });
}

if (!tokenHash || !kind) {
  show({ title: "Open the link from your email", lead: "This page finishes email confirmation and password resets. The link in the email looks like tadexhub.com/auth/confirm?… — open it directly.",
    action: { href: "/", label: "Go to TADEX Hub" } });
} else if (kind === "recovery" || kind === "invite") {
  askPassword();
} else {
  confirmEmail(); // email (signup), magic link, email change
}
