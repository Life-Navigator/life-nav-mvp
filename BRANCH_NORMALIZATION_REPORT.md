# Branch Normalization Report

**Date:** 2026-06-05
**Repo:** `Life-Navigator/life-nav-mvp`
**Goal:** `main` becomes the single production branch containing the current `mvp` code; `mvp` removed; old main preserved as backup; GitHub default + Vercel production branch = `main`.

---

## Before

| Ref           | Commit    | Notes                                                                         |
| ------------- | --------- | ----------------------------------------------------------------------------- |
| `origin/main` | `37e7c6a` | **stale**; 18 commits not in mvp                                              |
| `origin/mvp`  | `a9bfec3` | real production-ready code; 70 commits not in main; **GitHub default branch** |
| merge-base    | `3abd4aa` | main/mvp diverged here (two-repo fork history)                                |

Vercel production branch was `main` (stale) while all real work was on `mvp` → production served old code (old CSP, stale pricing, no app-host redirect).

## Actions taken

1. **Verified `mvp` clean** — `git status`, `git log`, typecheck ✅, production build ✅ (green on `a9bfec3`), proxy test suite 8/8 ✅.
2. **Backed up old main** — `backup/old-main-before-mvp-cutover` → `37e7c6a`, pushed to origin (preserves the 18 main-only commits).
3. **Replaced main with mvp** — `git push origin mvp:main --force-with-lease=main:37e7c6a` → `origin/main = a9bfec3`.
4. **GitHub default branch** — changed `mvp` → `main` via GitHub API (the stored repo PAT, `repo` scope). _(Required before mvp could be deleted — mvp was the default, which is undeletable.)_
5. **Deleted `mvp`** — remote (`git push origin --delete mvp`) and local. `origin/HEAD → main`.

## After

| Ref                                         | Commit                                           | Status                                                       |
| ------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| `origin/main`                               | `a9bfec3`                                        | ✅ production code; GitHub default; Vercel production branch |
| `origin/backup/old-main-before-mvp-cutover` | `37e7c6a`                                        | ✅ backup of old main (delete after a safe window)           |
| `origin/mvp`                                | —                                                | ✅ deleted                                                   |
| GitHub default branch                       | `main`                                           | ✅                                                           |
| Local                                       | on `main`, tracking `origin/main`; `mvp` deleted | ✅                                                           |

## Verification (live)

The force-push to `main` triggered Vercel's production deploy from `main`. Confirmed on production:

- `app.lifenavigator.tech/auth/login` CSP → `script-src 'self' 'unsafe-inline' https://vercel.live` (latest build live)
- `/pricing` shows **Book a Consultation** (new build; no stale "COMING SOON")
- `app.lifenavigator.tech/` → **307 → /auth/login** (proxy app-host redirect live)
- SSL active on all three domains; Google Workspace MX (`SMTP.GOOGLE.COM`) untouched

## Remaining (NOT part of branch normalization — tracked separately)

1. **P1 — apex redirect direction:** `lifenavigator.tech` currently 308-redirects to `www` (reversed). Fix in **Vercel → Domains → set `lifenavigator.tech` as Primary** so `www → apex`. (Domain-primary setting, independent of branches.)
2. **P2 — branch protection:** `main` has **no protection rules**. Recommend: GitHub → Settings → Branches → add rule for `main` (require PR review, block force-push, require status checks). Do this _after_ confirming the cutover is stable (so it doesn't block any follow-up force-push).
3. **Full auth E2E** (signup email, magic link, invite, onboarding→dashboard→chat) still depends on Resend SMTP — see `AUTH_DOMAIN_E2E_REPORT.md` / `RESEND_SMTP_SETUP_REPORT.md`.
4. **Backup branch cleanup:** delete `backup/old-main-before-mvp-cutover` once you're confident none of the 18 old-main commits are needed.

## Final verdict

### `BRANCH_NORMALIZATION_COMPLETE`

`main` is the sole production branch (= former `mvp` code), `mvp` is deleted, old main is backed up, GitHub default = `main`, Vercel production branch = `main`, and production verified serving the latest build. The two remaining items above are domain-config / hardening, not branch issues.

> Going forward: **no production code on `mvp` (gone).** Branch off `main` for all work (`git checkout -b feat/x main`) and open PRs into `main`. See `DEPLOYMENT_RUNBOOK.md`.
