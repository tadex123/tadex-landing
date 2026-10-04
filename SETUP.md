# TADEX Hub: connecting the sign-in (Supabase)

The hub has its own accounts, separate from the app accounts. Until `config.js` is filled in, the sign-in form shows "Sign-in is not connected yet".

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
6. **Make yourself admin.** Use **Request access** on tadexhub.com with your email. Then, in the SQL Editor, put your email into the last statement of `setup.sql` and run only that statement.
7. Commit and push `config.js`. Sign in and use **Admin** in the header to approve people and tick which apps each person sees.

## How access works

- `profiles.approved`: users can't sign in until this is true.
- `profiles.apps`: the app ids a person sees (`calculator`, `app2`).
- `profiles.is_admin`: shows the Admin panel. It can only be changed in the SQL Editor.

## Previews (only while not connected)

- `/?preview=apps`: signed-in view with sample apps
- `/?preview=noapps`: signed-in view with no apps assigned
- `/?preview=admin`: admin panel with sample users

These show sample data only and stop working once `config.js` is filled in.

Note: the hub controls which tiles a person sees. Each app behind a tile still uses its own login.
