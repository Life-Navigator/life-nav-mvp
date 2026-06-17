# Source of Truth Declaration

**Date:** 2026-06-16 · Effective immediately after the production cutover.

## Declaration

- **`main` is the production source of truth** (`41cf78b`). Both the web (Vercel `life-nav-mvp-web`) and the core-api (Fly `lifenavigator-core-api`, v116) now deploy from `main`.
- **`advisor/p0-upgrade-2.3.0` is a LEGACY branch.** It was the prior production source; it is retained only as a rollback reference and must not receive new work.

## Deployment sources (post-cutover)

| Component | Deploys from | Current                          | Mechanism                                   |
| --------- | ------------ | -------------------------------- | ------------------------------------------- |
| Web       | `main`       | Vercel prod (build of `41cf78b`) | GitHub→Vercel integration on push to `main` |
| core-api  | `main`       | Fly v116                         | manual `flyctl deploy` from `main` checkout |

## Rollback process

- **Web:** Vercel dashboard → `life-nav-mvp-web` → promote the previous production deployment (instant). Or `git revert 41cf78b` on `main` + push (Vercel rebuilds). A failed build never auto-promotes.
- **core-api:** `flyctl releases rollback` to v115, or `flyctl deploy` from `advisor/p0-upgrade-2.3.0` (identical code). Behavior-neutral either way.
- **Full:** revert the merge commit `41cf78b` on `main`, push (web), and redeploy core-api from the reverted `main`.

## Ownership

- Deploys: Timothy (techavenger83@gmail.com) — manual Fly deploys; Vercel via git push to `main`.

## Future branching strategy (recommended)

- `main` = always-deployable source of truth.
- Feature work on short-lived `feat/*` or `fix/*` branches **off current `main`** (avoid the stale-base trap that produced the 66-commit divergence).
- Deploy core-api from `main` only (Step toward CI-on-merge; see `POST_CUTOVER_CLEANUP_PLAN.md`).
- Delete feature branches after merge.
