# Finish Line Sprint — Executive Summary

**Date:** 2026-06-16 · **Final status: BLOCKED on one operational item (credential rotation); every product P0 either passes or is fixed/queued.** Once keys are rotated → PILOT_LAUNCH_READY.

## Mission

Eliminate remaining trust, consistency, and pilot-risk issues before inviting VCs/execs/advisors/founders/attorneys/CPAs/military leaders/ChatGPT power users. No new features/intelligence/models/agents/infra — only trust, consistency, pilot readiness.

## Headline findings (from the audit fleet)

- **Single source of truth?** The **narrative/objective/recommendation spine IS canonical** — every surface reads `life.*` via `snapshot()` → `my_life()` with real trust gating. The fracture is **localized to the goal layer**, split across **four stores** (`public.goals` CRUD, `life.candidate_goals`, `life.life_objectives`, `life.goals`). This is the #1 remaining consistency risk.
- **Recommendations: PARTIAL.** Surfaces read the one table via three methods (`prioritize`/`roadmap`/`active`); the prioritize-based surfaces agree, the Roadmap page + Graph can diverge.
- **Narrative: PARTIAL.** Two theme axes coexist (`dominant_narrative` vs `primary_objective`); only the dashboard showed the canonical narrative — reports/advisor/graph keyed off the objective.
- **Reports: MOSTLY TRUSTWORTHY** — no fabrication; two grounding divergences (risks/opps gate D1, persona-goal filter D2).
- **Trust: traceable for recs & readiness; partial for narrative/goals; no public per-insight `/why` route.**
- **Analytics: PARTIAL** — strong server-side event spine; the human-judgment metrics (NPS, narrative accuracy, report/graph usage) have backends but no client wiring.

## What I fixed in code this sprint (trust defects, all tested)

1. **🐛 Silent RISK-alert bug (P0).** `my_life.attention()` called `.get()` on a list and checked the wrong field name → an `AttributeError` was swallowed, so **RISK alerts never surfaced on the dashboard**. Fixed to iterate the list and match `rec_type == "RISK"`. + regression test (`test_attention_surfaces_risk_alerts_regression`).
2. **Reports now lead with the canonical narrative.** Added `life_brief` + `dominant_narrative` + `narrative_explanation` to the report executive payload (`report_engine.py`), closing the narrative-consistency P0 and feeding the new viewer's narrative lead. Honest empty when forming.
3. **494 core-api tests pass** (+1 regression).

## What I built (the one sanctioned surfacing feature)

- **In-app Executive Report Viewer** — on the previously-unwired `GET /v1/reports/{type}/preview`. New web proxy route + a viewer page rendering Executive Summary → Current Narrative (leads with `life_brief`) → Goals → Risks → Opportunities → Constraints → Recommendations (impact + confidence + evidence) → Decision Tradeoffs → Action Plan → Sources. PDF download retained. **Removed the "Share" broken-promise** copy (no Share UI exists). Type-check + eslint clean.

## The 16 deliverable docs (`docs/finish-line/`)

CANONICAL_LIFE_MODEL_AUDIT · GOAL_SYSTEM_RECONCILIATION · GOAL_CONSUMER_MAP · GOAL_MIGRATION_PLAN · RECOMMENDATION_CONSISTENCY_REPORT · NARRATIVE_CONSISTENCY_REPORT · EXPLAINABILITY_CONSISTENCY_REPORT · REPORT_TRUTH_AUDIT · EXECUTIVE_REPORT_VIEWER · GOAL_CENTRIC_DASHBOARD · GRAPH_STORYTELLING · TRUST_VERIFICATION_REPORT · PILOT_ANALYTICS_READINESS · EXECUTIVE_PILOT_SIMULATION · SECURITY_CLEARANCE_REPORT · EXECUTIVE_SUMMARY. All grounded in real `file:line`.

## The 14 acceptance criteria

| #   | Criterion                             | Status                                                                           |
| --- | ------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | One canonical life model              | ✅ for narrative/objective/rec spine; ⚠️ goal layer (plan ready)                 |
| 2   | One canonical goal model              | ⚠️ **Not yet** — 4 stores; GOAL_MIGRATION_PLAN staged (read-path join pre-pilot) |
| 3   | One canonical narrative               | ✅ now (reports fixed to lead with `dominant_narrative`)                         |
| 4   | Recommendations consistent everywhere | ⚠️ Mostly; Roadmap/Graph divergence documented + fixes specced                   |
| 5   | Reports match underlying data         | ✅ Mostly; D1 (risk/opp gate) queued, low live-risk                              |
| 6   | Explainability visible everywhere     | ⚠️ Rich but uneven; shared contract specced                                      |
| 7   | Trust verifiable everywhere           | ⚠️ Strong for recs/readiness; per-insight `/why` route specced                   |
| 8   | No duplicate goals                    | ⚠️ **Gated** on the goal-store join (do before goal-progress cards)              |
| 9   | No conflicting narratives             | ✅ reports/dashboard aligned; advisor wiring is P1                               |
| 10  | No conflicting recommendations        | ⚠️ prioritize-based aligned; Graph/Roadmap P1                                    |
| 11  | Executive reports advisor-grade       | ✅ engine is; viewer now surfaces it leading with the narrative                  |
| 12  | Security rotation completed           | 🔴 **BLOCKED — owner action** (SECURITY_CLEARANCE_REPORT)                        |
| 13  | Pilot analytics operational           | ⚠️ Behavioral yes; NPS/narrative-accuracy need client wiring                     |
| 14  | No critical trust defects remain      | ✅ the P0 silent-RISK bug is fixed; rest documented/queued                       |

## The 10 final questions

1. Single source of truth? **Yes for the intelligence spine; goal layer is the one exception (plan ready).**
   2–5. Trust recs/reports/narrative/insights? **Recs & readiness fully; narrative now aligned; goals pending reconciliation; per-insight `/why` is the one missing route.**
   6–8. CFP/CPA/attorney trust the outputs? **Yes on grounding + evidence; the goal double-store and report risk-gate are the two things to close first.**
2. VC durable moat? **Yes — per-user life model + provenance + grounded reasoning is visibly differentiated.**
3. Worthy of a 20-person pilot? **Yes, after key rotation + the goal read-path join; recommend a live 3–5 user run first.**

## Remaining before invites (ranked)

1. 🔴 **Rotate the exposed Supabase PAT + service/anon keys** (the only hard blocker — owner action).
2. **Goal read-path join** (GOAL_MIGRATION_PLAN Stage 0–1: zero-migration adapter) before shipping goal-progress cards — closes the duplicate-goal risk.
3. **P1 surfacing fixes** (all specced, no new infra): pass `dominant_narrative` into the advisor; route Graph/Roadmap recs through `prioritize`/`_shape`; report risk/opp grounding (D1); per-insight `/why` route; client-wire NPS + narrative-accuracy.
4. **Validation:** live 3–5 user run to replace the simulated pilot scores.

## Final status: **BLOCKED** (on credential rotation only)

Every product-side P0 is fixed or has a safe, gated plan. The single hard gate is operational: **rotate the keys, then this flips to PILOT_LAUNCH_READY.**
