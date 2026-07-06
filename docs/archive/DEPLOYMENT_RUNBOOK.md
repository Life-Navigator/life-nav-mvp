# Deployment Runbook — LifeNavigator (`life-nav-mvp`)

_Last updated: 2026-06-05 (after branch normalization)_

## Topology

| Piece                 | Value                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Repo                  | `Life-Navigator/life-nav-mvp`                                                                                                        |
| **Production branch** | **`main`** (GitHub default + Vercel production branch)                                                                               |
| Vercel project        | `life-nav-mvp-web` (`prj_Ecx1NQfhwva1Y2DxYzD4GXhCIrLu`), team `riffe007s-projects`, root `apps/web`, Node 20.x, pnpm 9 / lockfile v9 |
| Backend               | Fly: `lifenavigator-api-gateway`, `lifenavigator-ingestion-worker` (iad)                                                             |
| Auth/DB               | Supabase `lifenavigator-production` (ref `diwkyyahglnqmyledsey`)                                                                     |
| Email                 | Resend SMTP via Supabase (sender `welcome@lifenavigator.tech`)                                                                       |
| Domains               | `lifenavigator.tech` (apex, marketing), `www` (→ apex), `app.lifenavigator.tech` (the app; `/` → `/auth/login`)                      |

## Branching model (post-normalization)

- **`main` = production.** Pushing to `main` auto-deploys to production on Vercel.
- **No more `mvp`** — it was deleted. Do not recreate it for production.
- All work: branch off `main`, PR back into `main`.
  ```bash
  git checkout main && git pull
  git checkout -b feat/<thing>
  # …work…; push; open PR into main
  ```
- Backup of the old pre-cutover main: `backup/old-main-before-mvp-cutover` (delete when no longer needed).

## Standard deploy

1. Merge PR into `main` (or push to `main`).
2. Vercel auto-builds `main` → production. Watch in Vercel → Deployments.
3. Verify (below).

> Pre-push gate (local): `pnpm --filter @life-navigator/web type-check && pnpm --filter @life-navigator/web build`. Husky/lint-staged runs eslint+prettier on commit.

## Production verification (copy/paste)

```bash
# Build/code live? (CSP must include 'unsafe-inline' = post-CSP-fix build)
curl -sS -I https://app.lifenavigator.tech/auth/login | grep -i content-security-policy | grep -o "script-src[^;]*"
# Routing
curl -sS -I https://lifenavigator.tech        | grep -iE 'HTTP/|location'   # want 200 (apex primary)
curl -sS -I https://www.lifenavigator.tech     | grep -iE 'HTTP/|location'   # want 308 → apex
curl -sS -I https://app.lifenavigator.tech     | grep -iE 'HTTP/|location'   # 307 → /auth/login
# Content sanity
curl -sSL https://lifenavigator.tech | grep -o '<title>[^<]*</title>'
curl -sSL https://app.lifenavigator.tech/pricing | grep -c 'Book a Consultation'   # ≥1
```

## Rollback

- **Fast:** Vercel → Deployments → pick last-good → **Promote to Production** (instant, no git change).
- **Git:** `git revert <bad>` on `main` and push, or reset `main` to a known-good commit and `git push --force-with-lease` (then redeploy).
- **Cutover undo:** the pre-normalization main is at `backup/old-main-before-mvp-cutover` (`37e7c6a`).

## Production env vars (Vercel `life-nav-mvp-web` → Settings → Environment Variables → Production)

```
NEXT_PUBLIC_SITE_URL = https://lifenavigator.tech
NEXT_PUBLIC_APP_URL  = https://app.lifenavigator.tech
NEXTAUTH_URL         = https://app.lifenavigator.tech
APP_HOST             = app.lifenavigator.tech
EMAIL_FROM           = welcome@lifenavigator.tech
RESEND_API_KEY       = re_…  (send-only; rotate any key shared in chat)
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
```

Changing env vars requires a **redeploy** to take effect.

## DNS (Hostinger; do NOT touch Google MX)

| Type  | Name  | Value                                              |
| ----- | ----- | -------------------------------------------------- |
| A     | `@`   | `216.150.1.1` (Vercel)                             |
| CNAME | `www` | `cname.vercel-dns.com`                             |
| CNAME | `app` | `cname.vercel-dns.com`                             |
| MX    | `@`   | `SMTP.GOOGLE.COM` (Google Workspace — **leave**)   |
| TXT   | `@`   | one SPF only (merge Resend into existing if added) |

## Known follow-ups

- Set apex as **Primary** domain in Vercel so `www → apex` (currently reversed).
- Add branch-protection rules to `main` once cutover is stable.
- Complete Resend domain verification + Supabase SMTP for full email delivery (see `RESEND_SMTP_SETUP_REPORT.md`, `AUTH_DOMAIN_E2E_REPORT.md`).
