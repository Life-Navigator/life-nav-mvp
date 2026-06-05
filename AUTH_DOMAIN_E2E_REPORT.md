# Auth + Domain E2E Report — lifenavigator.tech

**Date:** 2026-06-05
**Supabase:** `lifenavigator-production` (`diwkyyahglnqmyledsey`)
**App:** `https://app.lifenavigator.tech` (Vercel `life-nav-mvp-web`, prod branch `main`)

## Executive result

Auth **routing, URL config, branded templates, and the link→session→redirect flow are configured and verified live**. The one thing not working is **branded email delivery via Resend**, because the Resend account that owns the provided API key reports **`lifenavigator.tech` is NOT verified**. SMTP was therefore left **disabled** (built-in mailer restored) to avoid a broken-email state.

## What was applied (Supabase Management API, verified by GET)

| Item                    | State                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Site URL**            | `https://app.lifenavigator.tech` ✅                                                                                                   |
| **Redirect allow-list** | `app./lifenavigator.tech/** , lifenavigator.tech/** , www…/** , life-nav-mvp-web.vercel.app/** , …git-main-…vercel.app/**` ✅         |
| **Branded templates**   | confirmation, magic_link, recovery, invite — applied & confirmed branded (`contains LifeNavigator + /auth/confirm`) ✅                |
| **SMTP**                | configured (`smtp.resend.com:587`, user `resend`, sender `welcome@lifenavigator.tech`) then **REVERTED to disabled** ⚠️ (see blocker) |
| **Email rate limit**    | set to 100/hr, then reset to default when SMTP disabled (will set 100 when SMTP re-enabled)                                           |

## Verifications run

- **SMTP / sender path:** ❌ Resend `POST /emails` from `welcome@lifenavigator.tech` → `validation_error: "The lifenavigator.tech domain is not verified."` (tested twice).
- **Auth URL config:** ✅ GET confirms `site_url` + `uri_allow_list` persisted.
- **Redirects (live):** ✅ `app.lifenavigator.tech/` → 307 → `/auth/login`; `/auth/confirm?...` → 307 → `/onboarding/financial-profile`.
- **Signup link → session (live E2E):** ✅ admin `generate_link type=signup` → followed `/auth/confirm?token_hash=…&type=signup` on `app.lifenavigator.tech` → **307 → /onboarding/financial-profile** with a valid `sb-…-auth-token` session cookie (decoded: `email_confirmed_at` set, role `authenticated`). Test user deleted afterward.
- **Magic link / recovery:** templates applied with correct `type=magiclink`→`/dashboard` and `type=recovery`→`/auth/password-reset` links; same `/auth/confirm` mechanism proven by the signup E2E. Not separately delivered (email blocked).
- **Email delivery (signup/magic/recovery to a real inbox):** ❌ blocked by the Resend domain blocker.

## P0 blocker — Resend domain verification

`lifenavigator.tech` is **not verified** in the Resend account tied to the provided key. Until it is, Resend rejects all sends, so SMTP cannot be enabled. Likely causes (check in this order):

1. **DNS not complete:** Resend → Domains → `lifenavigator.tech` shows _pending_ — add its SPF/DKIM (`send.` + `resend._domainkey`) records in Hostinger (do **not** touch the Google MX; keep a single root SPF), then click **Verify**.
2. **Wrong account:** the domain is verified in a _different_ Resend account/team than the API key. Create the key in the **same** account that owns the verified domain.
3. **Wrong domain:** verify `lifenavigator.tech` (not `.com` or a subdomain).

When the Resend test send returns `200`, re-enable SMTP (one PATCH — see `supabase/email-templates/README.md` / the consolidated command) with `rate_limit_email_sent: 100`, then re-run the signup/magic/recovery email tests to a real inbox.

## Other remaining items

- **Secrets to rotate (P0 security):** the Supabase `sbp_` token and the Resend `re_` key were both pasted in chat → rotate both after this cutover.
- **Phase 4 (Vercel env audit + redeploy):** not done — no Vercel token provided. Code is already domain-clean (no `.com`/old-vercel/`mvp` refs). Set in Vercel Production then redeploy: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL`, `APP_HOST`, `EMAIL_FROM=welcome@lifenavigator.tech`, `RESEND_API_KEY` (new key).
- **`welcome.html`** is committed for the app-level mailer; not a Supabase auth template.

## Final verdict

### `NOT_READY` (single blocker: Resend domain verification)

Everything except branded email delivery is configured and verified live. Because the stated goal is **branded email signup/magic links**, and email delivery currently fails, this cannot be `AUTH_READY_FOR_20_USER_BETA`.

**Note:** an **invite-link beta works today** (admin `generate_link` → `/auth/confirm` → session, proven above) — that path needs no email. To flip to `AUTH_READY_FOR_20_USER_BETA`: verify the Resend domain → re-enable SMTP → confirm a live signup + magic-link + recovery email each arrive from `welcome@lifenavigator.tech`.
