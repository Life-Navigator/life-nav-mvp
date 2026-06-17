# Pilot Readiness Assessment

**Date:** 2026-06-16 · Audience: 20-person private pilot (VCs / execs / founders / advisors / attorneys / CPAs / power-users). Honest, no inflation.

## Verdict: **EXPERIENCE_EXCELLENCE_READY — with two P0 surfacing tasks and one security blocker**

The intelligence is pilot-grade and now, for the first time, the **experience leads with it**. The remaining gaps are all surfacing/encoding (low-risk, frontend-only) plus one operational security action.

## What is ready (this sprint)

- ✅ **Life Brief** built, tested (489 core-api tests pass), and **live in the dashboard** as the lead surface. Honest empty state; zero fabrication.
- ✅ **Narrative-first discovery** live (core-api v119), 5/5 personas, contextual questions through all post-story steps.
- ✅ **Trust spine:** grounded risks/recs only, provenance taxonomy, honest "still forming" states.
- ✅ **11 design/audit docs** mapping every surface, each grounded in real `file:line` with prioritized P0/P1/P2.

## Blockers before invites go out

| #   | Blocker                                                                                                                        | Severity            | Owner   |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------- | ------- |
| 0   | 🔴 **Rotate the exposed Supabase PAT** `sbp_…` + service-role/anon keys (logged in `docs/cutover/SECURITY_ACTIONS_PENDING.md`) | **CRITICAL**        | Timothy |
| 1   | Stage the end-of-discovery **reveal** (Life Brief full-screen) — the holy-shit moment                                          | P0 (frontend-only)  | eng     |
| 2   | Surface **`why_ranking` + quantified impact** on the dashboard hero / next-best-move; repoint nav to `/life-graph/explainable` | P0 (surfacing-only) | eng     |

## Strongly recommended (P1, not strict blockers)

- In-app **report viewer** on the existing `/v1/reports/{type}/preview` endpoint; lead the report with `life_brief`; promote Reports into nav. Fix the reports-page footer that advertises a Share UI that doesn't exist (broken promise on a trust surface).
- **Graph legibility P0s:** progressive label disclosure, encode node role (Vision/Objective) via shape/halo, anchor camera on the highest-importance node, narrative header from `life_brief`.
- Resolve the **duplicate graph pages** and the **goal-store reconciliation** (`/api/goals` vs `goal_portfolio`).

## Data-integrity checks to run on live data (do not fabricate)

- Confirm `quantified_impact` is populated on live recommendations before surfacing it prominently; if sparse, show the qualitative benefit and log the data gap.
- Confirm the report **share + consent-ledger** endpoints work end-to-end before exposing any Share UI.

## Risk posture

- **Technical risk: low.** Every remaining item reuses shipped endpoints/data; no new infra/model/agent work.
- **Trust risk: low.** No fabrication paths introduced; honest empty states throughout.
- **Operational risk: the security blocker (#0) is non-negotiable** before external users touch the system.

## Recommendation

Ship the two P0 surfacing tasks + rotate the keys, then open the pilot. The P1 items can land during the pilot without gating the first invites.
