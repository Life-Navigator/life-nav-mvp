# AUTH_MAGIC_LINK_BETA_REPORT.md

**Date:** 2026-06-04
**Approach:** Supabase Auth **built-in** magic-link / invite-link. No custom auth, no password required.
**Deployed:** edge config (Mgmt API) + web (`5fb916c` → Vercel production).

---

## VERDICT: ✅ MAGIC_LINK_BETA_READY

Invite-only beta users receive an invite/magic link, click it, a session is established, and they land
directly in onboarding. Verified end-to-end against production with fresh emails (no inbox needed — links
minted via the admin `generate_link` API and followed programmatically).

---

## Requirement-by-requirement

| #   | Requirement                            | Status               | Evidence                                                                                                                                                                                                                                                                                                                  |
| --- | -------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Email provider configured              | ⚠️ **Built-in only** | `external_email_enabled: true`, but **no custom SMTP** → Supabase's built-in mailer, **rate-limited to 2 emails/hour** (`rate_limit_email_sent: 2`), not for production. **Beta sidesteps this** with admin-generated links (no mailer dependency). **P1: add Resend/SES SMTP before relying on emailed links at scale.** |
| 2   | Site URL + Redirect URLs               | ✅ Fixed             | `site_url = https://life-nav-mvp-web.vercel.app`; added `https://life-nav-mvp-web.vercel.app/**` to the redirect allow-list (was only `https://*.vercel.app`).                                                                                                                                                            |
| 3   | Invite/magic callback works            | ✅                   | `/auth/confirm` (`verifyOtp({token_hash,type})`) now handles `signup`, `email`, `magiclink`, **and `invite`**.                                                                                                                                                                                                            |
| 4   | Session established after click        | ✅                   | Following a fresh invite link returns `307` with `sb-…-auth-token` cookies set; the resulting session authenticates against protected routes.                                                                                                                                                                             |
| 5   | Redirect verified users to /onboarding | ✅                   | Non-onboarded users (authoritative `profiles.setup_completed !== true`) → `/onboarding/financial-profile`.                                                                                                                                                                                                                |
| 6   | Resend link flow                       | ✅                   | `/auth/magic` + `MagicLinkPanel` (`signInWithOtp`, `shouldCreateUser=false`) — request/resend a link; "check your email" + "send another link".                                                                                                                                                                           |
| 7   | Friendly expired-link handling         | ✅                   | `/auth/confirm` classifies `expired/invalid/not found` → `?error=link_expired`; `/auth/login` shows a friendly amber notice + "Request a new sign-in link →"; `/auth/magic?expired=true` pre-explains.                                                                                                                    |
| 8   | Admin/manual invite for first 20       | ✅                   | `apps/web/beta-invite.mjs generate <emails…>` mints `type:invite` links (creates the user, no password) pointed at `/auth/confirm?token_hash=…&type=invite&next=/onboarding` for manual distribution (Slack/personal email).                                                                                              |
| 9   | Test with 5 fresh emails               | ✅ **5/5 PASS**      | `node beta-invite.mjs test 5` on the live deploy: each fresh invite link → `307` + session cookies → `/onboarding/financial-profile`, authed. (Pre-deploy run: 2/2.)                                                                                                                                                      |
| 10  | This report                            | ✅                   | —                                                                                                                                                                                                                                                                                                                         |

### Verification (live, production deploy `5fb916c`)

```
PASS beta-invite-…-0@lifenav.test  status=307 session=true → /onboarding/financial-profile authed=true
PASS beta-invite-…-1@lifenav.test  status=307 session=true → /onboarding/financial-profile authed=true
PASS beta-invite-…-2@lifenav.test  status=307 session=true → /onboarding/financial-profile authed=true
PASS beta-invite-…-3@lifenav.test  status=307 session=true → /onboarding/financial-profile authed=true
PASS beta-invite-…-4@lifenav.test  status=307 session=true → /onboarding/financial-profile authed=true
5/5 fresh emails: invite link → session → /onboarding
```

---

## The email root cause (why verification emails "don't arrive")

`smtp_host` is **unset**, so Supabase uses its **built-in email service**, which is capped at **~2–4
emails/hour** and intended only for testing. A 20-user onboarding burst would exhaust it immediately —
this is the actual cause of unreliable verification/magic emails. Two responses:

1. **Beta (now):** don't depend on it. The admin **mints links directly** (`generate_link`) and distributes
   them manually — invite-only, deterministic, zero email-deliverability risk.
2. **Scale (P1):** configure a real SMTP provider (Resend recommended) in Supabase Auth settings; the email
   templates are already rewritten to the correct SSR `token_hash → /auth/confirm` format, so emailed
   links will work the moment SMTP is added.

---

## How the beta invite works (operational runbook)

1. **Invite 20 users:**
   `node apps/web/beta-invite.mjs generate alice@x.com bob@y.com …`
   → prints one secure link per email (valid 1 hour; regenerate as needed). Send each person their link.
2. **They click it** → `/auth/confirm` verifies the token, sets the session, and redirects to
   `/onboarding/financial-profile`.
3. **Returning users / lost link** → `/auth/magic`, enter the invited email, get a fresh link (resend).
4. **Expired/used link** → friendly message + one-click "request a new link".

No passwords. No custom auth. All built-in Supabase Auth.

---

## What changed (code + config)

- `apps/web/src/app/auth/confirm/route.ts` — handle invite/magiclink; authoritative onboarding gate;
  classified expired/invalid errors.
- `apps/web/src/components/auth/MagicLinkPanel.tsx`, `apps/web/src/app/auth/magic/page.tsx` — passwordless
  sign-in + resend.
- `apps/web/src/app/auth/login/page.tsx` — friendly expired-link UX + magic-link entry point.
- `apps/web/beta-invite.mjs` — admin invite + self-test harness.
- Supabase Auth config (Mgmt API) — redirect allow-list + magic_link/invite/confirmation templates
  rewritten to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…&next=/onboarding`.

## Follow-ups

- **P1 — SMTP:** add Resend so users can self-serve magic links by email (and so password-reset emails
  work). Until then, magic links to arbitrary emails are rate-limited; manual invite covers the 20-user beta.
- **P2 — middleware:** unauthenticated hits on protected routes currently 302 to `/auth/login`; consider
  `/auth/magic` for the beta cohort.
