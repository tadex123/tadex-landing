# TADEX Hub: connecting the sign-in (Supabase)

The hub has its own accounts, separate from the app accounts.

**Status (Oct 4, 2026):** connected to Supabase project `tadex-hub` (ref `ichcxptnnzakwzlmixvk`, eu-central-1). Steps 1–5 are done. `setup.sql` has been applied, and `config.js` holds the project URL and the publishable (anon) key. Owner admins are automatic, see below.


## New public tables (GRANTs after 30 Oct 2026)

When you add a **new** table in the hub Supabase project, bake in explicit privileges — Supabase will stop auto-granting `public` tables to API roles on **30 Oct 2026** (existing tables stay OK). Copy `supabase/_template_new_table.sql`, follow the checklist in `supabase/MIGRATIONS.md`, and mirror the same `revoke` / `grant` / RLS block used for `profiles` and `hub_presence` in `setup.sql`. Do not blanket-GRANT old tables.

## Steps

1. **Create a project.** Go to [supabase.com](https://supabase.com), open **New project** on the free plan, and pick an **EU region** (e.g. Frankfurt `eu-central-1`). Save the database password somewhere safe.
2. **Run the SQL.** Open **SQL Editor**, then **New query**, paste all of `supabase/setup.sql`, and click **Run**. Don't run the last `update …` block yet (step 6).
3. **Set the URLs.** Under **Authentication → URL Configuration**, set **Site URL** to `https://tadexhub.com` and add `https://tadexhub.com/` to **Redirect URLs**.
4. **Email confirmation (optional).** Under **Authentication → Sign In / Providers → Email**, turn **Confirm email** on if new users should verify their email before they can sign in. It works either way, because nobody gets in until an admin approves them.
5. **Paste the keys.** Under **Project Settings → API**, copy the **Project URL** and the **anon public** key into `config.js`:
   ```js
   export const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   export const SUPABASE_ANON_KEY = "eyJ...";
   ```
   The anon key is meant to be public. Never put the `service_role` key in this repo.
7. Commit and push `config.js`. Sign in and use **Admin** in the header to approve people and tick which apps each person sees.

## How access works

- `profiles.approved`: users can't sign in until this is true.
- `profiles.apps`: the app ids a person sees (`calculator`, `app2`).
- `profiles.is_admin`: shows the Admin panel. It can only be changed in the SQL Editor.

## Email sending

Supabase's built-in email sender only delivers to the project's team members and is limited to a few emails per hour. For co-workers to receive confirmation emails, set up custom SMTP under **Authentication → Emails → SMTP Settings** (e.g. Resend or Brevo, both have free plans).

## Account emails (confirm, password reset, invite)

Every account email opens **tadexhub.com directly**, never a `*.supabase.co` page (works from China too).

- **Site URL** (Authentication → URL Configuration) = `https://tadexhub.com`; Redirect URLs allow `https://tadexhub.com/**`.
- **Email templates** (Authentication → Emails → Templates: Confirm signup, Reset password, Invite user, Magic link) link to
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email|recovery|invite|magiclink` instead of `{{ .ConfirmationURL }}`.
  Source files: `supabase/email-templates/*.html` + `subjects.json`; apply with `bash -lc 'python3 supabase/email-templates/apply.py'`.
- **`/auth/confirm`** (`auth/confirm/index.html` + `auth-confirm.js`) checks the one-time token through the same-origin `/sb` proxy:
  signup confirmation → "Email confirmed, waiting for approval" (or straight into the hub if already approved);
  password reset / invite → choose a password first (the token is only used on Save, so mail scanners can't burn it) → hub.
  Expired or used links show a clear message and a "Send a new reset link" button.
- **Forgot password?** on the sign-in card sends the reset email (`/?reset=1` opens that mode directly).
- Email change + reauthentication keep Supabase's default templates (the hub has no email-change feature).

## Previews (only while not connected)

- `/?preview=apps`: signed-in view with sample apps
- `/?preview=noapps`: signed-in view with no apps assigned
- `/?preview=admin`: admin panel with sample users
- `/?preview=direktor`: Direktor view with “Moj tim — kursevi” (sample Magda)

These show sample data only and stop working once `config.js` is filled in.

Note: the hub controls which tiles a person sees. Each app behind a tile still uses its own login.
