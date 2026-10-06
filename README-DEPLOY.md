# Deploying Phase 1

This replaces the static `motori.us` site with a real Next.js app. Same
look, same pages — the new things are: accounts (Privy), a database
(Supabase), and the seeded-Admin login (you).

## 1. Get the files into your GitHub repo

1. In Finder, open your cloned `motori.us` repo folder (the one GitHub
   Desktop made).
2. Delete everything currently in it (the old static files — `index.html`,
   `about/`, `assets/`, etc.) except the hidden `.git` folder.
3. Copy everything from this project folder into that same repo folder.
4. Open GitHub Desktop — it'll show a big changeset (old files removed, new
   ones added). Write a commit message like "Migrate to Next.js app
   (Phase 1)" and push.

## 2. Connect Vercel to build it correctly

Your existing Vercel project is already linked to this GitHub repo, so the
push above will trigger a deploy automatically. Two things to check in the
Vercel dashboard first (Project Settings):

- **Framework Preset** should auto-detect as "Next.js" once it sees this
  code (it previously would have been "Other" for the static files). **It
  doesn't always auto-detect on an existing project that was previously set
  to "Other"** — check Project Settings -> Build and Deployment ->
  Framework Preset yourself and set it to "Next.js" if it still says
  "Other". A deploy under the wrong preset will report "Ready" and look
  successful, but only serves the static files in `public/` (check the
  deployment's **Output** tab — if it shows just `assets/`/`images/` with
  no route/function entries, this is the cause). After changing the
  preset, trigger a fresh **Redeploy** with the build cache unchecked —
  changing the setting alone doesn't rebuild the existing deployment.
- **Build Command** / **Output Directory** can stay on their Next.js
  defaults (Override toggles switched off) — don't need to set these
  manually.

## 3. Set environment variables in Vercel

Project Settings -> Environment Variables. Add these (get the values from
Privy's and Supabase's own dashboards):

| Name | Where to find it |
|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy dashboard -> your app -> Settings -> Basics |
| `PRIVY_APP_SECRET` | Privy dashboard -> your app -> Settings -> Basics (click "reveal") |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard -> your project -> Settings -> API -> Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard -> your project -> Settings -> API -> `service_role` secret key |
| `ADMIN_SEED_EMAIL` | `rolfjhaag@gmail.com` (already set to this) |
| `ANTHROPIC_API_KEY` | console.anthropic.com -> API Keys (needed for AI-drafted Build pages) |

Set all of these for the **Production** environment (and Preview, if you want
preview deployments to work the same way). After adding them, trigger a
redeploy (Vercel does this automatically on the next push, or you can hit
"Redeploy" on the latest deployment in the dashboard).

## 4. Run the database migrations in Supabase

1. Supabase dashboard -> your project -> SQL Editor -> New query.
2. Run each file in `supabase/migrations/` **in filename order**, pasting
   its entire contents and running it as its own query before moving to the
   next one:
   - `0001_init.sql` — creates `users` with the `admin` / `builder` /
     `applicant` roles.
   - `0002_phase2.sql` — applications, builders, and builds tables.
   - `0003_build_vin.sql` — adds the `vin` column to `builds`.
   - `0004_build_status_draft.sql` — adds the `'draft'` build status.
     **Must be run as its own query, separate from `0005`** — Postgres
     won't allow a transaction to both add an enum value and reference it.
   - `0005_build_fields.sql` — adds `make` / `model` / `trim` / `theme` /
     `builder_notes` columns to `builds` (the Submit Build form fields).
   - `0006_seed_mahlzeit_builder.sql` — one-time data seed: gives your
     existing Admin account (`rolfjhaag@gmail.com`) an approved Builder
     profile under the `mahlzeit-motorsport` handle, so your own account
     can use the Submit Build flow. Safe to re-run.
   - `0007_build_status_changes_requested.sql` — adds the
     `'changes_requested'` build status (the Builder dashboard's "Needs
     response" row). **Must be run as its own query**, same restriction as
     `0004`.
   - `0008_seed_e9_build.sql` — registers the existing E9 page as a row under
     your Builder so it shows in your dashboard.
   - `0009_build_draft_state.sql` — AI draft state columns on `builds`.
   - `0010_build_private_and_stale.sql` — private publishing (visibility +
     password hash) and stale-draft tracking columns on `builds`.
3. You only need to run each one once. Storage buckets for application
   photos and Build photos/documents are created automatically on first use
   — nothing to set up by hand for those.

## 5. Log in as Admin

Once deployed with the env vars set:

1. Visit the live site.
2. Click "Log in" (top-right corner) and sign in with
   `rolfjhaag@gmail.com` (Privy will email you a one-time code — that's the
   whole "login," no password or wallet talk shown to you).
3. Your account is automatically created with the Admin role, since your
   email matches `ADMIN_SEED_EMAIL`. The button should then show your email
   and "admin" next to it.

That confirms Phase 1 end-to-end: auth works, your Supabase `users` table
has your row with `role = 'admin'`, and an embedded Ethereum wallet exists
for your account behind the scenes (nothing to do with it yet — that's
Phase 4).

## What's *not* here yet

No Applicant/Builder flows, no Admin dashboard, no AI photo/doc processing.
The login button is intentionally plain — it's just proving the plumbing
works before Phase 2 builds the actual features on top of it.

## One open item

Privy's Bitcoin embedded-wallet support isn't exposed in the current React
SDK's auto-create config the way Ethereum's is — flagged for investigation
before Phase 4 (the on-chain ownership record), not something needed now.
