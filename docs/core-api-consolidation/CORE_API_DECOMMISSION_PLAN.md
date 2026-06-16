# Core-API Decommission Plan (Phase 6)

**Date:** 2026-06-16 · Evidence-only / planning-only (no changes performed).

## The premise has changed — read first

The sprint was framed around a **standalone, separately-deployed `lifenavigator-core-api` service/repo** that might be retired. **The evidence overturns that premise:**

- `apps/lifenavigator-core-api/` is **part of this monorepo** (not a submodule, no separate remote — only `origin = Life-Navigator/life-nav-mvp`).
- Its `fly.toml` deploys to the Fly app `lifenavigator-core-api`, **from this monorepo**.
- The "deployed service" is simply this monorepo's core-api **built from branch `origin/advisor/p0-upgrade-2.3.0`** (tip `9d25180`), while `origin/main` is **66 commits behind**.

**Therefore there is no standalone service to decommission.** The core-api is a **permanent, required** backend (it serves 43 frontend `/v1` proxies — see `CORE_API_ROUTE_MAP.md`). What must be "retired" is the **branch divergence / off-main deployment practice**, not the service.

## Re-scoped answers to the Phase-6 questions

| Phase-6 item                        | Status for THIS situation                                                                                                                                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. What must be migrated first?     | The deployed branch's core-api delta into `main` (see `CORE_API_MIGRATION_PLAN.md` P0). Not a cross-service migration — a branch merge.                                                                         |
| 2. What routes must be repointed?   | **None.** The frontend already calls `lifenavigator-core-api.fly.dev`; that stays. No URL/proxy changes.                                                                                                        |
| 3. What env vars must change?       | **None to decommission.** (The advisor/model flags remain default-off-safe; see `PREMIUM_MODEL_POSTURE.md`.) The only env need is ensuring the deployed-only migrations are applied to the DB the service uses. |
| 4. What Fly app must be disabled?   | **None.** `lifenavigator-core-api` stays running — it is the backend. Disabling it would take the whole product down.                                                                                           |
| 5. What DNS/config must be updated? | **None.**                                                                                                                                                                                                       |
| 6. What monitoring must be removed? | **None.** Keep all core-api monitoring.                                                                                                                                                                         |
| 7. Rollback plan                    | N/A for "decommission" (nothing is being torn down). Rollback for the _consolidation_ is in the migration plan (revert the merge / redeploy the prior commit).                                                  |

## What actually needs to be "retired"

**The practice of deploying core-api from a non-`main` branch.** Today prod runs `advisor/p0-upgrade-2.3.0`; `main` does not contain the advisor stack. That divergence is the real liability (a deploy from `main` would silently regress onboarding to rule-based _and_ reference a non-existent `advisor_turns` table — `CORE_API_DIVERGENCE_REPORT.md` §7).

### Retirement criteria for the divergent-branch deployment

The off-main deployment can be considered "retired" once **all** are true:

1. The deployed branch's core-api delta is merged into `main` (migration plan P0) and the deployed-only migrations are applied.
2. A fresh `flyctl deploy` **from `main`** produces a service byte-equivalent in behavior to the current prod (smoke: discovery, advisor, finance canonical-summary, reports).
3. CI/deploy config is set so future core-api deploys come from `main` only.
4. The divergent branches (`advisor/p0-upgrade-2.3.0`, and the tangled `platform/elite-hardening-streaming`) are merged or closed so `main` is the single source of truth.

## Explicit safety (Phase 8 honored)

Nothing deleted, nothing decommissioned, no routes repointed, no deploy config changed in this sprint. This document is planning only.
