# GRAPH REPROCESSING — FINAL REPORT

**Date:** 2026-06-07
**Status:** ✅ COMPLETE — all reprocessing thresholds met.
**Verification method:** read-only queries run **inside the Fly api-gateway container** (`flyctl ssh console`) using the existing Fly secrets — no credential retrieval from Qdrant Cloud / Neo4j Aura, no secret values exposed. See `FLY_SECRET_AUDIT.md`.

---

## Pre-state (2026-06-06, before fix)

```
sync_queue:  failed 831 (827 × gemini 401, 4 × gemini 429) · completed 197 · pending 0
Qdrant life_navigator:  402 points
Neo4j:  :Unknown 233 (mislabeled finance.transactions) · :FinancialAccount 134 · :UserProfile 37 · :PersonaProfile 35
Root cause: worker GEMINI_API_KEY (digest 6b4d7e1d…) returned 401 Unauthorized.
```

## Actions taken

| #   | Action                                                                                                                                                     | Result                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | Restaged working `GEMINI_API_KEY` on Fly worker + api-gateway (digest `1533956b…`)                                                                         | embeds return 200                                   |
| 2   | Redeployed worker (new image) — also shipped the `entity_type='transaction'` serde alias fix                                                               | `:TransactionSummary` labeling correct for new jobs |
| 3   | Canary reset (5 jobs) → confirmed `qdrant upsert ok` + `neo4j upsert ok`, 3072-dim collection match                                                        | safe to proceed                                     |
| 4   | Reset remaining 826 failed Gemini jobs → drained                                                                                                           | completed climbed to 1028                           |
| 5   | Investigated 50 transient `60e90d28` Neo4j DNS failures → **rolling-deploy artifact** (stale stopped machine), not a routing bug; re-reset → all succeeded | failed → 0                                          |
| 6   | Relabeled 233 `:Unknown` → `:TransactionSummary` (in-container Cypher)                                                                                     | `:Unknown` → 0                                      |

## Final state (verified live, in-container)

```
sync_queue:   completed 1028 · failed 0 · pending 0
Qdrant life_navigator:   1233 points
Neo4j personal (4f61c985):
  :TransactionSummary  867
  :FinancialAccount    289
  :UserProfile          79
  :PersonaProfile       77
  :Unknown               0
  :Goal                  1  (smoke-test node; created+verified+deleted during Step 5)
```

## Threshold acceptance

| Criterion                   | Target | Actual                        | Status |
| --------------------------- | ------ | ----------------------------- | ------ |
| sync_queue.completed        | ≥ 1000 | 1028                          | ✅     |
| sync_queue.failed           | ≤ 5    | 0                             | ✅     |
| sync_queue.pending          | ~0     | 0                             | ✅     |
| Qdrant `life_navigator`     | ≥ 1000 | 1233                          | ✅     |
| Neo4j `:TransactionSummary` | ≥ 700  | 867                           | ✅     |
| Neo4j `:Unknown`            | 0      | 0                             | ✅     |
| No new Gemini 401           | —      | confirmed (worker logs clean) | ✅     |

**Reprocessing verdict: COMPLETE.**

## Known gap (separate report)

`entity_type='risk_assessment'` has **no variant in the worker `EntityType` enum** (`apps/ingestion-worker/src/entities.rs`). Migration 112 enqueues risk-assessment sync jobs, but the worker would deserialize them to `Unknown` → `:Unknown` nodes, not `:RiskAssessment`. No risk rows exist yet (0 enqueued), so the graph is currently clean. This blocks 12-step Smoke Step 6 — see `BETA_READY_FINAL_VERDICT.md`.
