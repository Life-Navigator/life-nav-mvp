# Main Consolidation Plan (Step 8)

**Date:** 2026-06-16 · Planning-only. How to bring `origin/main` up to the deployed advisor stack safely, with the discovery-mode fix included. **No merge performed in this sprint.**

## Facts (from git)

- `origin/advisor/p0-upgrade-2.3.0` (deployed lineage) is **66 commits ahead** of `origin/main`, **0 behind** (strict superset).
- Core-api delta: **37 files, +4721/−96.** Reverse (main ahead of deployed): **0**.
- **6 deployed-only migrations** (absent on main):
  - `160_advisor_turns.sql` (advisor telemetry — the advisor stack errors without it)
  - `20260611020000_life_candidate_goals.sql`
  - `20260611030000_fix_course_sync_topic.sql`
  - `20260613000000_family_members_pets_guardianship.sql`
  - `20260613010000_cleanup_archetype_risks.sql`
  - `20260616120000_pilot_routing.sql` (pilot feedback + model usage)
- This branch `platform/discovery-mode-fix` = deployed lineage **+ the discovery-mode fix** (core-api orchestrator/router + tests + docs).

## 1. Exact commits in deployed branch not in main

66 commits (`git rev-list origin/main..origin/advisor/p0-upgrade-2.3.0`) — the advisor V2→V6 line, model orchestration, pilot readiness, Opus finance/health test, LIOS docs, family/graph/dashboard trust work, plus the apps/web changes that accompany them.

## 2. Migrations required before main can deploy safely

The 6 listed above — **apply first**, in filename order. `160_advisor_turns.sql` and `20260616120000_pilot_routing.sql` are hard prerequisites for the advisor/pilot code.

## 3. Code required to bring main up to deployed functionality

The entire core-api delta (advisor stack: `advisor_orchestrator/llm/context/math/validator`, `model_registry`, `model_router`, `pilot_service`, `life_graph_workspace`, `pdf_renderer`, DI wiring, `main.py` router registration) + the discovery-mode fix in this branch. Plus the accompanying apps/web delta (see §4).

## 4. Code to modify / gate before merge

- **Premium model posture:** keep `MODEL_ROUTER_ENABLED`, `GEMINI_PRO_ADVISOR_ENABLED`, `CLAUDE_OPUS_4_8_ENABLED`, `PREMIUM_ROUTING_ENABLED` **default-off** (they already are; confirmed unset in prod — `DISCOVERY_DEPLOYMENT_STATE.md`). `HEALTH_SAFETY_FALLBACK_ENABLED` stays on.
- **Discovery routes** must carry `mode="discovery"` (this branch) — do not lose it in the merge.
- **apps/web overlap:** the web delta overlaps with two other branches — `platform/elite-hardening-streaming` (advisor stack + Arcana streaming) and `platform/pilot-p0-blockers` (web P0 blocker fixes, branched off the _behind_ main). Reconcile so each web change lands once (no double-apply, no regressions).

## 5. Code to exclude / revert

- Nothing in core-api classifies delete/revert (divergence = all "B / migrate").
- Do **not** enable the premium/Vertex flags as part of consolidation (separate gated decision).
- The `RelationshipManager`/`main.py` files changed on both lineages → **reconcile (PORT)**, don't blindly take one side.

## 6. PR sequencing

| PR                                                      | Scope                                                                                    | Target                                                        | Why this order                                                                                                                                                            |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PR 1 — discovery mode fix**                           | this branch's core-api change (orchestrator `mode`, route wiring, contract guard, tests) | **→ `origin/advisor/p0-upgrade-2.3.0`** (the deployed branch) | **Fastest path to fix onboarding in prod:** merge here and `fly deploy` from the advisor branch immediately. Decouples the user-facing fix from the larger consolidation. |
| **PR 2 — migrations**                                   | the 6 deployed-only migrations                                                           | → `main`                                                      | schema must exist before the advisor/pilot code runs on `main`                                                                                                            |
| **PR 3 — core-api deployed stack**                      | the full core-api delta (incl. PR 1)                                                     | → `main`                                                      | brings `main` up to deployed; resolve `relationship_manager.py`/`main.py` (PORT)                                                                                          |
| **PR 4 — frontend hardening / streaming / P0 blockers** | reconciled apps/web delta (elite-hardening-streaming + pilot-p0-blockers)                | → `main`                                                      | lands the web changes once, on top of consolidated core-api                                                                                                               |
| **PR 5 — final deploy from main**                       | flip core-api deploy source to `main`; `fly deploy` from `main`; smoke                   | ops                                                           | retires the off-`main` deploy practice                                                                                                                                    |

> **Recommended immediate action (if approved):** PR 1 → advisor branch → redeploy. That ships the onboarding fix to pilot users now, while PRs 2–5 consolidate at a safe pace.

## 7. Risks & rollback

- **Risk:** large merge (66 commits, big web delta). **Mitigation:** PR 3/4 split; CI green gate; PORT conflicts reviewed.
- **Rollback (consolidation):** revert the merge commit; redeploy the prior core-api image (record the live SHA via `flyctl releases` first — currently v114).
- **Rollback (discovery fix alone):** it's additive (`mode` defaults to advisor); revert the two route lines to drop back to advisor mode.

## 8. UNKNOWN

- Exact live Fly commit SHA (image not git-labeled) — confirm with `flyctl` before PR 5.
