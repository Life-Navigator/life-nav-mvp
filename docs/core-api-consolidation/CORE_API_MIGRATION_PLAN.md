# Core-API Migration / Consolidation Plan (Phase 7)

**Date:** 2026-06-16 · Planning-only (no changes performed; Phase-8 safety honored).

**Nature of the work:** this is a **branch consolidation within one monorepo**, not a cross-service port. The deployed branch `origin/advisor/p0-upgrade-2.3.0` (`9d25180`) is a **strict superset** of `origin/main` for core-api (66 commits ahead, 0 behind; reverse check = 0). So the safe direction is unambiguous: **bring `main` up to the deployed branch**, then fix the one defect (discovery runs in advisor mode), then make `main` the deploy source.

## Priorities

### P0 — required before pilot

| #    | Work                                                                                                                                                                                        | Source → Target                                                                                                                                                                                                                            | Dependencies                                                                              | Tests                                                                                                                    | Deploy order                                            | Risk                                                        | Rollback                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| P0-1 | **Consolidate deployed branch → `main`** (the whole core-api delta: advisor stack, model registry/router, pilot_service, life_graph_workspace, pdf_renderer, DI wiring, main.py router reg) | merge `origin/advisor/p0-upgrade-2.3.0` → `main`                                                                                                                                                                                           | resolve `relationship_manager.py` + `main.py` conflicts (PORT items)                      | run the 7 advisor/pilot test files + full `pytest`; web `tsc`+`jest`                                                     | merge → CI green → **then** deploy core-api from `main` | **High** (66 commits; large apps/web delta too — 112 files) | revert the merge commit; redeploy prior core-api commit on Fly   |
| P0-2 | **Apply deployed-only migrations** (`160_advisor_turns.sql`, `20260616120000_pilot_routing.sql` + 4 more) to the DB the service uses                                                        | migrations on deployed branch → Supabase                                                                                                                                                                                                   | must land **before/with** P0-1 code or the advisor stack errors (missing `advisor_turns`) | verify tables exist; advisor turn persists                                                                               | **before** first `main` deploy                          | Med (schema)                                                | migrations are additive; down-scripts / restore from backup      |
| P0-3 | **Fix the onboarding defect: give `/discovery/chat[/stream]` a discovery/onboarding mode**                                                                                                  | `routers/life.py` (`:84-112`), `dependencies.py` (`get_advisor_orchestrator :268-327`), `advisor_orchestrator.py` (`converse`/`_enhance :291`, `_compose :87-142`), `advisor_llm.py` (`:46-69,148-174`), `advisor_context.py` (`:322-323`) | depends on P0-1 (code must be on `main` first)                                            | a discovery-mode test: opening turn asks ONE question, no 6-section block, no disclaimer, objective not asserted as fact | with/after P0-1                                         | Med (advisor behavior)                                      | feature-flag the discovery-mode branch; revert to current wiring |
| P0-4 | **Reconcile the tangled feature branches** so `main` is the single source of truth                                                                                                          | `platform/elite-hardening-streaming` (= advisor stack + streaming), `platform/pilot-p0-blockers` (= web P0 fixes on the _behind_ base)                                                                                                     | P0-1                                                                                      | re-run each PR's tests against consolidated `main`                                                                       | after P0-1                                              | Med (rebase conflicts)                                      | keep branches until merged; no force-push to shared              |

> **Note on P0-3 (the actual onboarding fix):** root cause is that the orchestrator is **mode-blind** (no "discovery"/"onboarding" flag exists in `advisor_orchestrator.py`/`advisor_llm.py` — confirmed ABSENT), so it applies the consultant 6-section prompt + disclaimer to onboarding, and `_enhance` overwrites `RelationshipManager`'s conversational reply (`advisor_orchestrator.py:291`). Two viable approaches (decision deferred to remediation, per "no fixes" rule): (a) route `/discovery/chat` back to `RelationshipManager` for onboarding; or (b) add a discovery mode to the orchestrator that skips `_enhance`/6-section/disclaimer and asks one question. Both are small, localized changes — evidence in `ONBOARDING_REMOTE_ROOT_CAUSE.md`.

### P1 — required before public beta

| #    | Work                                                                                                                                                     | Notes                                                        |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| P1-1 | Set CI/deploy so core-api deploys from `main` only                                                                                                       | eliminates future divergence (the root organizational cause) |
| P1-2 | Wire the frontend to `/discovery/chat/stream` (exists on deployed branch, **no proxy today**) or confirm blocking `/discovery/chat` is the intended path | route-map shows the stream endpoint is deployed-but-unused   |
| P1-3 | Land the advisor/pilot DB-backed usage ledger read path                                                                                                  | per `PREMIUM_MODEL_POSTURE.md` (premium stays gated)         |

### P2 — post-beta cleanup

| #    | Work                                                                       | Notes              |
| ---- | -------------------------------------------------------------------------- | ------------------ |
| P2-1 | Remove dead/duplicate branches after consolidation                         | hygiene            |
| P2-2 | De-duplicate any web-side duplicates surfaced by the elite-hardening audit | tracked separately |

## Deployment order (safe sequence)

1. Apply P0-2 migrations to the target DB.
2. Merge P0-1 (deployed branch → `main`), resolving PORT conflicts; CI green.
3. Implement P0-3 discovery-mode fix on `main` (flagged).
4. `flyctl deploy` core-api **from `main`**; smoke discovery (one-question opening), advisor, finance canonical-summary, reports, graph.
5. Reconcile feature branches (P0-4); set deploy-from-`main` (P1-1).

## Rollback (whole consolidation)

- Keep the current prod commit SHA recorded before redeploy; `flyctl deploy` that image to roll back.
- The `main` merge is a single revertable merge commit.
- Migrations are additive; do not drop on rollback.

## UNKNOWN (not determinable from repo)

- The **exact commit currently live on Fly** and the **runtime feature-flag values** on the machine (need `flyctl status`/`flyctl ssh`). Confirm before step 4 so the redeploy is behavior-equivalent.
