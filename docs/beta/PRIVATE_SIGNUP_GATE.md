# Private Signup Gate — invite-key-only account creation

Goal: **no one can create an account without a private invite key that only the founder can mint.** Testers use
the seeded persona accounts first; when they're ready for their own onboarding, you mint them a key.

## How it works (two layers — BOTH required)

1. **Supabase public signup DISABLED (the linchpin — founder action).** Client-side `supabase.auth.signUp` and
   magic-link signup are reachable directly with the _public_ anon key, so a UI-only gate is bypassable. The
   only way to truly close signup is to disable it in GoTrue. Then the sole account-creation path is our
   service-role route below.
2. **Invite-key redemption route (code, deployed).** `POST /api/auth/redeem-invite` validates an **email-bound
   invite key** and creates the account with the service role, stamping `app_metadata.invited=true` (which the
   private-beta proxy honors, so the new tester gets app access with no env change). The key is an HMAC of the
   email under `INVITE_SIGNING_SECRET` — only the holder of that secret can mint one, and a key works for **only
   the exact email** it was minted for (a leaked key helps no one else). It's effectively single-use: once the
   account exists, redeeming again returns `already_registered`.

The `/auth` "Create account" form now requires an **Invite key** field and calls this route (never client
`signUp`). Without a valid key → account is not created.

## Founder setup (one-time)

1. **Disable public signup in Supabase.** Dashboard → **Authentication → Sign In / Up → Email** → turn **OFF
   "Allow new users to sign up."** (Equivalent Management API: `PATCH /v1/projects/{ref}/config/auth` with
   `{"disable_signup": true}`.) Until this is off, the gate is bypassable.
2. **Set `INVITE_SIGNING_SECRET`** on Vercel (web project, Production) — a long random string (e.g.
   `openssl rand -base64 48`). Keep it secret; it's the master mint key.
3. Confirm **`SUPABASE_SERVICE_ROLE_KEY`** is set on Vercel (already used by other routes) — the redeem route
   needs it to create accounts.
4. Keep **`PRIVATE_BETA_ENABLED=true`** (the access gate). Redeemed testers are allowed via `app_metadata.invited`;
   the seeded beta1–5 accounts remain allowed via `PRIVATE_BETA_ALLOWED_EMAILS`.

## Inviting a tester

```
INVITE_SIGNING_SECRET='<same value as on Vercel>' node scripts/beta/mint_invite.mjs tester@example.com
```

Give the tester their **email + the printed key**. They go to `/auth` → **Create account**, paste the key, set a
password, and they're in — straight into onboarding. The key is worthless for any other email.

## Guarantees / behavior

- No invite key (or a wrong/other-email key) → `403 invalid_invite_key`, no account created.
- `INVITE_SIGNING_SECRET` unset → route returns `503 signup_disabled` (fails **closed**, never open).
- Account already exists → `409 already_registered` (invite is effectively single-use).
- A redeemed tester (`app_metadata.invited`) reaches the app even if not in `PRIVATE_BETA_ALLOWED_EMAILS`.

## Tests

`src/lib/auth/__tests__/inviteKey.test.ts` (mint/verify, email-binding, wrong-secret, fail-closed) +
`betaAccess.test.ts` (redeemed-invite access). The route wires these verified primitives.

## Honest caveat

Layer 2 (code) is deployed and tested, but the gate is only **airtight once Layer 1 (disable public signup in
Supabase) is done** — that toggle is a founder/dashboard action (or a Management-API call). I cannot set it from
the build environment. Until it's off, someone could still create an account by calling GoTrue's `/signup`
directly with the public anon key.

## Waitlist → grant access (expansion / pilot launch)

People who aren't invited yet can **request access** at `/waitlist` (public, no login). This does NOT create an
account — it records them in `public.waitlist_entries` (status `waiting`) so you can contact + grant access when
you're ready to expand.

- The page is linked as "Request access" from the login and `/private-beta` pages.
- `/api/waitlist` is public (bypasses the auth + private-beta gates) and writes to `public.waitlist_entries`
  (email, name, phone, notes, source='website', status='waiting'). **Fix:** the old route wrote to a
  non-existent `waitlist` table and swallowed the error, so requests were silently lost — now corrected +
  verified (returns `recorded: true` only when it actually persisted).

**Founder workflow to grant access:**

1. Review requests (Supabase SQL editor):
   ```sql
   select email, name, notes, created_at from public.waitlist_entries
   where status = 'waiting' order by priority_score desc, created_at asc;
   ```
2. Mint an invite key for the chosen email: `INVITE_SIGNING_SECRET=… node scripts/beta/mint_invite.mjs <email>`.
3. Email them their invite key (they redeem it at `/auth` → Create account).
4. Mark them invited:
   ```sql
   update public.waitlist_entries set status='invited', invited_at=now() where email='<email>';
   ```
   (When they finish signup you can set status='signed_up'.)

This composes the two systems: **waitlist collects demand, the invite key grants access** — one at a time, on
your schedule, all the way through the pilot launch.
