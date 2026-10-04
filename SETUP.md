# TADEX Hub: connecting the sign-in (Supabase)

The hub has its own accounts, separate from the app accounts.

**Status (Oct 4, 2026):** connected to Supabase project `tadex-hub` (ref `ichcxptnnzakwzlmixvk`, eu-central-1). Steps 1–5 are done. `setup.sql` has been applied, and `config.js` holds the project URL and the publishable (anon) key. Owner admins are automatic, see below.

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
6. **Owner admins (automatic).** `tadijasaric92@gmail.com` and `info@tadextrade.com` (listed in `public.hub_owner_emails()`) become admin + approved with all apps as soon as they request access **and confirm their email**. To change the list, edit `hub_owner_emails()` in `setup.sql` and re-run it.
7. Commit and push `config.js`. Sign in and use **Admin** in the header to approve people and tick which apps each person sees.

## How access works

- `profiles.approved`: users can't sign in until this is true.
- `profiles.apps`: the app ids a person sees (`calculator`, `app2`).
- `profiles.is_admin`: shows the Admin panel. It can only be changed in the SQL Editor.

## Email sending

Supabase's built-in email sender only delivers to the project's team members and is limited to a few emails per hour. For co-workers to receive confirmation emails, set up custom SMTP under **Authentication → Emails → SMTP Settings** (e.g. Resend or Brevo, both have free plans).

## Previews (only while not connected)

- `/?preview=apps`: signed-in view with sample apps
- `/?preview=noapps`: signed-in view with no apps assigned
- `/?preview=admin`: admin panel with sample users

These show sample data only and stop working once `config.js` is filled in.

Note: the hub controls which tiles a person sees. Each app behind a tile still uses its own login.
