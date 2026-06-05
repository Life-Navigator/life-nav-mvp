# Auth + Domain E2E Report — lifenavigator.tech

**Date:** 2026-06-05
**Supabase project:** `lifenavigator-production` (ref `diwkyyahglnqmyledsey`)
**App project:** Vercel `life-nav-mvp-web`

This report covers Supabase Auth URL changes, app env, and the end-to-end test plan. It depends on `DOMAIN_CUTOVER_REPORT.md` (DNS/domains) and `RESEND_SMTP_SETUP_REPORT.md` (email) being completed first.

---

## 1 — Supabase Auth URL configuration

**Dashboard:** Supabase → Authentication → **URL Configuration**:

- **Site URL:** `https://app.lifenavigator.tech` _(was `https://life-nav-mvp-web.vercel.app`)_
- **Redirect URLs (allow-list):**
  ```
  https://app.lifenavigator.tech/**
  https://lifenavigator.tech/**
  https://www.lifenavigator.tech/**
  https://life-nav-mvp-web.vercel.app/**   # keep during cutover; remove once domains verified
  ```

**Management API alternative** (needs a `SUPABASE_ACCESS_TOKEN` with project access; per topology notes, **use curl — the Python UA is Cloudflare-blocked**):

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/diwkyyahglnqmyledsey/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "site_url": "https://app.lifenavigator.tech",
    "uri_allow_list": "https://app.lifenavigator.tech/**,https://lifenavigator.tech/**,https://www.lifenavigator.tech/**,https://life-nav-mvp-web.vercel.app/**"
  }'
```

**Why this matters / how the code uses it**

- Email templates use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…` (already deployed). With Site URL now = `app.lifenavigator.tech`, confirm/magic/invite links resolve to the **app** subdomain, which hosts `/auth/confirm` — correct.
- Client auth redirects use `window.location.origin` (LoginForm OAuth `/auth/callback`, MagicLinkPanel `/auth/confirm`, ForgotPassword `/auth/password-reset`), so they automatically use whatever domain the user is on — covered by the `/**` allow-list entries above.
- Google OAuth: the Supabase provider callback is `https://diwkyyahglnqmyledsey.supabase.co/auth/v1/callback` (unchanged). Ensure the app's post-login `redirectTo` origins (`app.lifenavigator.tech`) are allow-listed (they are, via `/**`).

---

## 2 — App env (Vercel `life-nav-mvp-web` → Production) — then redeploy `mvp`

```
NEXT_PUBLIC_APP_URL   = https://app.lifenavigator.tech
NEXT_PUBLIC_SITE_URL  = https://lifenavigator.tech
NEXTAUTH_URL          = https://app.lifenavigator.tech
APP_HOST              = app.lifenavigator.tech
EMAIL_FROM            = welcome@lifenavigator.tech
RESEND_API_KEY        = re_…   (rotated)
```

- `NEXT_PUBLIC_APP_URL` feeds server-side OAuth/wearable callbacks (LinkedIn/Microsoft/Google/Fitbit) — must be the app domain.
- `APP_HOST` drives the `proxy.ts` root redirect on the app subdomain.
- Redeploy production after setting (Vercel prod branch is `main`; serve `mvp`).

---

## 3 — Code changes shipped (this commit)

- `proxy.ts`: `app.lifenavigator.tech/` → `/auth/login` (or `/dashboard` if authed). **8/8 proxy tests pass**, incl. 3 new host-redirect cases.
- `beta-invite.mjs`: invite links default to `https://app.lifenavigator.tech`.
- Email `.com` → `.tech`: sender default `welcome@lifenavigator.tech`, template footer links, error-page support address.
- `.env.example` (root + web): documents all the above.
- typecheck ✅ · build ✅.

---

## 4 — End-to-end live test plan (run after steps 1–2 + DNS + Resend)

> I can't execute these now — they need the live domains, Supabase config, and a verified Resend domain, none of which exist yet. Run this checklist once the runbooks are done.

| #   | Test             | How                                                                                       | Expected                                                                                  |
| --- | ---------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | Marketing domain | visit `https://lifenavigator.tech`                                                        | premium homepage, valid SSL                                                               |
| 2   | www redirect     | `curl -sI https://www.lifenavigator.tech`                                                 | 308 → apex                                                                                |
| 3   | App domain root  | visit `https://app.lifenavigator.tech`                                                    | 307 → `/auth/login`                                                                       |
| 4   | Signup email     | register at `app.lifenavigator.tech/auth/register`                                        | confirm email from `welcome@lifenavigator.tech` arrives; link → `/auth/confirm` → session |
| 5   | Magic link       | `app.lifenavigator.tech/auth/magic`                                                       | magic-link email arrives; link signs in                                                   |
| 6   | Invite link      | `APP_URL=https://app.lifenavigator.tech node apps/web/beta-invite.mjs generate you@x.com` | link → `/auth/confirm` → `/onboarding/financial-profile`                                  |
| 7   | Onboarding       | new user after invite                                                                     | lands on `/onboarding/financial-profile`, activates                                       |
| 8   | Dashboard        | after activation                                                                          | `/dashboard` renders, no CSP errors in console                                            |
| 9   | Chat             | open advisor on dashboard                                                                 | grounded reply, no fallback / 429                                                         |

CSP sanity on the new domain:

```bash
curl -sI https://app.lifenavigator.tech/auth/login | grep -i content-security-policy
# script-src 'self' 'unsafe-inline' https://vercel.live
# connect-src … https://*.supabase.co wss://*.supabase.co …   (auth fetch allowed)
```

---

## 5 — Final verdict

### `NOT_READY` → flips to `DOMAIN_AND_AUTH_READY_FOR_BETA` after the runbook below

There are **no P0 code defects** — typecheck, build, and the proxy suite are green, and the app code is domain-aware. The blockers are **configuration/DNS actions that require your dashboard access** (I have no Vercel/Supabase tokens and cannot touch Hostinger or Resend domains from here), so nothing is live or verifiable yet.

**Blocking checklist (all external, ~20 min work + DNS propagation):**

1. [ ] Add the 3 domains in Vercel `life-nav-mvp-web` (apex primary, www→apex, app no-redirect). `DOMAIN_CUTOVER_REPORT.md §1`
2. [ ] Add Hostinger DNS: A `@`→76.76.21.21, CNAME `www`/`app`→cname.vercel-dns.com (remove conflicts). `§2`
3. [ ] Add Resend domain `lifenavigator.tech` + its MX/SPF/DKIM DNS; verify. `RESEND_SMTP_SETUP_REPORT.md §1`
4. [ ] Supabase: Site URL + redirect allow-list (§1 above); enable Resend SMTP; raise email rate limit.
5. [ ] Vercel env (§2 above) + redeploy `mvp` to production.
6. [ ] Rotate the Resend API key.
7. [ ] Run §4 verification (DNS/SSL/redirects + the 9 E2E checks).

When 1–7 pass, the verdict is **`DOMAIN_AND_AUTH_READY_FOR_BETA`**. Tell me once DNS is live and I can run the resolution/SSL/redirect/CSP verification commands against the real domains and confirm.
