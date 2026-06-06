# Auth + Domain E2E Report — lifenavigator.tech

**Date:** 2026-06-05
**Supabase:** `lifenavigator-production` (`diwkyyahglnqmyledsey`)
**App:** `https://app.lifenavigator.tech` (Vercel `life-nav-mvp-web` `prj_Ecx1NQfhwva1Y2DxYzD4GXhCIrLu`, prod branch `main`)

## Executive result

The full auth + domain cutover is **applied and verified live**: Supabase URL config, branded templates, **Resend SMTP delivery**, the link→session→redirect flow, the Vercel Production env, and a fresh production redeploy. The Resend domain blocker from the prior pass is **cleared** — `lifenavigator.tech` is now verified, direct and Supabase-routed sends both succeed.

## What was applied

### Supabase (Management API, GET-confirmed)

| Item                    | State                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Site URL**            | `https://app.lifenavigator.tech` ✅                                                                              |
| **Redirect allow-list** | `app.…/** , lifenavigator.tech/** , www…/** , life-nav-mvp-web.vercel.app/** , …git-main-…vercel.app/**` ✅      |
| **Branded templates**   | confirmation, magic_link, recovery, invite — applied & branded (`LifeNavigator` + `/auth/confirm` links) ✅      |
| **SMTP**                | **ENABLED** — `smtp.resend.com:587`, user `resend`, sender `welcome@lifenavigator.tech`, name `LifeNavigator` ✅ |
| **Email rate limit**    | `100`/hr ✅                                                                                                      |

### Vercel Production env (`life-nav-mvp-web`) — then redeployed

| Var                    | Value                            | Action                      |
| ---------------------- | -------------------------------- | --------------------------- |
| `NEXT_PUBLIC_APP_URL`  | `https://app.lifenavigator.tech` | updated (was `…vercel.app`) |
| `NEXTAUTH_URL`         | `https://app.lifenavigator.tech` | updated (was `…vercel.app`) |
| `NEXT_PUBLIC_SITE_URL` | `https://lifenavigator.tech`     | created                     |
| `APP_HOST`             | `app.lifenavigator.tech`         | created                     |
| `EMAIL_FROM`           | `welcome@lifenavigator.tech`     | created                     |
| `RESEND_API_KEY`       | `re_…` (encrypted)               | created                     |

Production redeploy `dpl_55TcZwc2nZJUuhbgq8D6rx3foYbi` (`main`@`ed4d2b1`) built **READY** in ~70s with the new env baked in.

## Verifications run (live)

- **Resend domain / sender path:** ✅ `POST /emails` from `welcome@lifenavigator.tech` → `200` with message id `fa300740-…` (prior pass returned `domain not verified`; now cleared).
- **Supabase → Resend SMTP path:** ✅ `POST /auth/v1/otp` (magic link) for a real address → **HTTP 200** with no SMTP error — proves Supabase dispatches through Resend end-to-end (wrong creds would 500 `Error sending magic link email`).
- **Auth URL config:** ✅ GET confirms `site_url` + `uri_allow_list` + SMTP + rate-limit persisted.
- **Signup link → session (live E2E):** ✅ admin `generate_link type=signup` → `/auth/confirm?token_hash=…&type=signup` on `app.lifenavigator.tech` → **307 → /onboarding/financial-profile** with a valid `sb-…-auth-token` session cookie (`email_confirmed_at` set, role `authenticated`). Test user deleted.
- **Live routing (post-deploy):** ✅ `app.lifenavigator.tech/` → 307 → `/auth/login`; `/auth/confirm` reachable (307); apex `lifenavigator.tech/` → 200; `www` → 200; CSP present on `/auth/login` and allows Supabase auth.
- **Magic link / recovery templates:** ✅ applied with `type=magiclink`→`/dashboard` and `type=recovery`→`/auth/password-reset`; same `/auth/confirm` mechanism proven by the signup E2E and the live OTP send.

## Remaining items

- **P0 — rotate chat-exposed secrets:** the Supabase `sbp_` token, the Resend `re_` key, **and the Vercel `vcp_` token** were all pasted in chat. Rotate all three now that the cutover is done. (The Resend key is also stored encrypted in Vercel as `RESEND_API_KEY` — rotate there too.)
- **Inbox confirmation (manual, by you):** two real emails were dispatched to `techavenger83@gmail.com` this pass — a direct Resend probe and the Supabase magic link. Confirm both landed (and render branded) to close delivery 100%. Server accepted both; only inbox arrival can't be asserted from here.
- **`welcome.html`** is committed for the app-level mailer; not a Supabase auth template.
- **`www` redirect:** serves `200` directly rather than `308 → apex`. Functional; tighten to a redirect later if canonical-host SEO matters.

## Final verdict

### `AUTH_READY_FOR_20_USER_BETA` ✅

URL config, branded templates, Resend SMTP (verified end-to-end via direct send + Supabase OTP), the signup link→session→redirect flow, Vercel Production env, and a fresh production deploy are all applied and verified live. Self-serve signup / magic-link / recovery emails now send from `welcome@lifenavigator.tech` at 100/hr. The only open action is operational: confirm inbox arrival and rotate the three chat-exposed tokens.
