# TADEX Hub + Kalkulator on Vercel (branch `vercel`)

This branch serves the hub from Vercel instead of GitHub Pages, with the calculator at `/kalkulator`.
`main` (GitHub Pages, live on tadexhub.com) is unchanged.

## Layout (two Vercel projects, one domain)

| Path | Served by | Source |
|---|---|---|
| `tadexhub.com/` (+ `app.js`, `auth.js`, `login/`, …) | Vercel project **tadex-hub** (static) | this repo, branch `vercel` |
| `tadexhub.com/crm` | redirect → `/kalkulator/crm` (TADEX CRM, served by the calculator project, hub app key `crm`) | `tadex123/tadex-kalkulator`, route `src/routes/crm.tsx` |
| `tadexhub.com/kalkulator/*` | proxied by `vercel.json` rewrites → project **tadex-kalkulator** (`https://tadex-kalkulator.vercel.app/kalkulator/*`) | `tadex123/tadex-kalkulator`, branch `selfhost-kalkulator-basepath` |

The calculator is built with base path `/kalkulator` (assets, server functions, `/kalkulator/api/auth`,
cookies scoped to `Path=/kalkulator`), so the proxy passes paths through 1:1 and the browser only ever
sees `tadexhub.com`. Only the hub project gets the custom domain; the calculator keeps its `*.vercel.app` URL.

Changes vs `main`: `vercel.json` (rewrites + noindex header), `.vercelignore` (don't publish
`supabase/`, `SETUP.md`, `CNAME`), `/login/` now redirects to `/kalkulator/`, the Kalkulator tile links to `/kalkulator/`.

## Calculator env (Vercel project tadex-kalkulator, Production + Preview)

`DATABASE_URL` (Neon pooled), `DATABASE_URL_UNPOOLED` (Neon direct, used by migrations), `BETTER_AUTH_SECRET`,
`BETTER_AUTH_URL` (`https://tadex-hub.vercel.app/kalkulator` now, `https://tadexhub.com/kalkulator` after switch),
`TRUSTED_ORIGINS` (`https://tadex-kalkulator.vercel.app`), `ADMIN_EMAILS` (`tadijasaric92@gmail.com`).
Function region: `fra1`. Neon project `tadex-kalkulator` (aws-eu-central-1, Postgres 17).
Migrations run in the Vercel build (`npm run build` → `scripts/migrate.mjs`).

## Switch-over (when approved)

1. **Calculator env:** set `BETTER_AUTH_URL=https://tadexhub.com/kalkulator` (Production) and add
   `https://tadex-hub.vercel.app` to `TRUSTED_ORIGINS` if the vercel.app hub should keep working; redeploy the calculator.
2. **Vercel → project tadex-hub → Settings → Domains:** add `tadexhub.com` and `www.tadexhub.com`
   (redirect `www` → apex). Vercel shows "Invalid configuration" until DNS changes.
3. **GitHub Pages:** AFTER the DNS change, remove the custom domain:
   `echo '{"cname":null}' | gh api -X PUT repos/tadex123/tadex-landing/pages --input -` (or Settings → Pages → Custom domain → Remove)
   so GitHub stops claiming the domain. Optionally merge `vercel` into `main` and connect the repo to the project.
4. **DNS at Spaceship (tadexhub.com → Advanced DNS):**
   - Delete the 4 GitHub Pages `A @` records: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
   - Add `A  @  216.198.79.1` and `A  @  64.29.17.1` (Vercel's project-specific recommendation; the
     legacy `76.76.21.21` also works).
   - Change `CNAME www` from `tadex123.github.io.` to `1d7597e984a28101.vercel-dns-017.com.`
     (legacy `cname.vercel-dns.com.` also works).
   - Leave every other record (e.g. Resend/email `send`, `resend._domainkey`, TXT) alone. No TXT
     verification is needed (domains verified on the Vercel side on 2026-10-04).
5. Vercel issues the TLS certificate automatically once DNS resolves (minutes, up to the old TTL).
6. **Supabase (hub sign-in):** Site URL / Redirect URLs already use `https://tadexhub.com/` — nothing to change.
   (While testing on `tadex-hub.vercel.app`, email-confirmation links still point at tadexhub.com.)

Rollback: put the 4 GitHub `A` records and `www → tadex123.github.io.` back and re-add the custom domain in GitHub Pages.
