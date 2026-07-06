# Domain Cutover Report — lifenavigator.tech

**Date:** 2026-06-05
**Target project:** Vercel `life-nav-mvp-web` (`prj_Ecx1NQfhwva1Y2DxYzD4GXhCIrLu`), team `riffe007s-projects` (`team_uflrwiS0oWnbSXttHk2ou0MO`), root `apps/web`.
**Decision (confirmed):** all three domains point at **`life-nav-mvp-web`** (one Next.js app serves marketing + app). `app.lifenavigator.tech/` redirects to sign-in via `proxy.ts`.

| URL                              | Serves                                                           |
| -------------------------------- | ---------------------------------------------------------------- |
| `https://lifenavigator.tech`     | Marketing site (apex, primary)                                   |
| `https://www.lifenavigator.tech` | 308 → apex                                                       |
| `https://app.lifenavigator.tech` | The app (root `/` → `/auth/login`, or `/dashboard` if signed in) |

> ⚠️ What I could do from here vs. what needs you: I made all the **code/env changes** and can give exact steps, but **adding domains in Vercel and DNS records in Hostinger require your dashboard access** (no Vercel token in this environment). Do steps 1–2, then run the step-3 verification.

---

## Step 1 — Add the domains in Vercel

**Dashboard (recommended):** Vercel → `life-nav-mvp-web` → **Settings → Domains → Add** each of:

- `lifenavigator.tech` → set as **Primary**
- `www.lifenavigator.tech` → **Redirect to** `lifenavigator.tech` (308)
- `app.lifenavigator.tech` → **No redirect** (the app; `proxy.ts` handles root → login)

**CLI alternative** (after `vercel login`):

```bash
cd apps/web && vercel link --project life-nav-mvp-web --scope riffe007s-projects
vercel domains add lifenavigator.tech
vercel domains add www.lifenavigator.tech
vercel domains add app.lifenavigator.tech
```

Vercel then shows the exact DNS it expects. It will match step 2. If Vercel shows a **`_vercel` TXT challenge** (only when a domain is already claimed elsewhere), add it exactly as shown.

> Note (from deploy topology): Vercel's **production branch for this project is `main`**, but you serve `mvp`. After DNS is live, redeploy `mvp` to production (or set the production branch to `mvp` in the dashboard) so the domains serve the latest.

---

## Step 2 — DNS records to add in Hostinger

Hostinger **hPanel → Domains → lifenavigator.tech → DNS / Nameservers → DNS Records**.

> First confirm the domain is on **Hostinger nameservers** (e.g. `ns1.dns-parking.com` / `ns2.dns-parking.com`). If its nameservers point elsewhere, add these records there instead.

| Type      | Name / Host | Value (points to)      | TTL  |
| --------- | ----------- | ---------------------- | ---- |
| **A**     | `@`         | `76.76.21.21`          | 3600 |
| **CNAME** | `www`       | `cname.vercel-dns.com` | 3600 |
| **CNAME** | `app`       | `cname.vercel-dns.com` | 3600 |

**Remove/replace conflicts first** (Hostinger ships defaults that will fight these):

- Delete the default parking **A `@`** record (and any **AAAA `@`**).
- Delete the default **CNAME `www`** (often `www → @` or a parking target).
- Delete any existing **`app`** record.

If Vercel displayed a verification TXT, also add:

| Type | Name      | Value                        |
| ---- | --------- | ---------------------------- |
| TXT  | `_vercel` | _(exact string from Vercel)_ |

(Resend email DNS — separate MX/TXT on the `send` and `resend._domainkey` subdomains — is in `RESEND_SMTP_SETUP_REPORT.md`. Those do **not** conflict with the records above.)

---

## Step 3 — Verify (run after DNS propagates, ~5–60 min)

```bash
# Resolution
dig +short lifenavigator.tech A            # → 76.76.21.21
dig +short www.lifenavigator.tech CNAME    # → cname.vercel-dns.com.
dig +short app.lifenavigator.tech CNAME    # → cname.vercel-dns.com.

# SSL + status + redirects
curl -sSI https://lifenavigator.tech        | grep -iE 'HTTP/|location'   # 200
curl -sSI https://www.lifenavigator.tech    | grep -iE 'HTTP/|location'   # 308 → https://lifenavigator.tech/
curl -sSI https://app.lifenavigator.tech    | grep -iE 'HTTP/|location'   # 307 → /auth/login
curl -sS  https://lifenavigator.tech | grep -o '<title>[^<]*</title>'     # LifeNavigator — Decision Intelligence for Life

# SSL issuer (should be Let's Encrypt / Vercel-provisioned; no cert errors)
echo | openssl s_client -servername lifenavigator.tech -connect lifenavigator.tech:443 2>/dev/null | openssl x509 -noout -issuer -dates
```

**Pass criteria**

- [ ] apex resolves to `76.76.21.21`; `www` and `app` resolve to `cname.vercel-dns.com`
- [ ] HTTPS returns valid cert on all three (Vercel auto-provisions once DNS resolves — may take a few minutes after first resolution)
- [ ] `www` 308-redirects to apex
- [ ] `app` root 307-redirects to `/auth/login`
- [ ] apex serves the marketing homepage

---

## Code changes shipped for the cutover

- `proxy.ts` — host-based redirect: `app.lifenavigator.tech/` → `/auth/login` (or `/dashboard` if authed). Host configurable via `APP_HOST` env. Covered by 3 new proxy tests (8/8 pass).
- `next.config.ts` — CSP `connect-src` already allows `*.supabase.co`, `*.fly.dev`, Vercel; domain change needs no CSP edit.
- `.env.example` (root + web) — documented `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL`, `APP_HOST`, Resend vars.
- `beta-invite.mjs` — default invite host → `https://app.lifenavigator.tech`.
- Email `.com` → `.tech` (templates footer, error-page support, sender default).

## Env to set in Vercel (`life-nav-mvp-web` → Settings → Environment Variables → Production), then redeploy

```
NEXT_PUBLIC_APP_URL   = https://app.lifenavigator.tech
NEXT_PUBLIC_SITE_URL  = https://lifenavigator.tech
NEXTAUTH_URL          = https://app.lifenavigator.tech
APP_HOST              = app.lifenavigator.tech
EMAIL_FROM            = welcome@lifenavigator.tech
RESEND_API_KEY        = re_…  (see RESEND report; rotate first)
```

## Status

**Code: READY.** **Live cutover: PENDING** steps 1–2 (your Vercel + Hostinger access) → then step 3 verification. See `AUTH_DOMAIN_E2E_REPORT.md` for the overall verdict.
