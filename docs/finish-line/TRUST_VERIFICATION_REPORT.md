# Trust Verification Report

**Date:** 2026-06-16 · Question: for every insight shown to a user, can we trace Source / Calculation / Reasoning / Confidence / Dependencies?

## Verdict: PARTIAL — strong for recommendations & readiness, partial for narrative & goals, and no public per-insight explain route

## Trust spine inventory

- **Provenance taxonomy:** `user_confirmed > user_stated > advisor_inferred > assumption` implemented for the primary objective (`my_life.py:116-141`) with per-item `provenance{provenance_type, source, confidence, updated_at}`.
- **Source labels:** every `my_life` section carries a `"source"` (Recommendation OS / Advisor Discovery / Life Readiness Engine / Discovery health / Documents) — `my_life.py:134,155,164,177,191-197`.
- **Evidence/citations:** recs persist `evidence[{statement, source_table}]` + `assumptions` (`recommendations_os.py:85-98`); the graph workspace exposes full rec→evidence→source lineage with confidence + xai reasoning (`life_graph_workspace.py:96-140`).
- **Confidence:** on objectives (`snapshot()`), recs (`formula` Impact×Confidence×Urgency×Evidence÷Effort, `recommendations_os.py:74-84`), readiness domains (`readiness.py:135`), narrative (`narrative_explanation`, `life_discovery.py`).
- **why_chain:** persisted on objectives (`life_discovery.py:819`) and surfaced in `snapshot().objectives` (`:919`).
- **Deterministic routes:** `/v1/recommendations/audit` (`recommendations.py:46`); `why_ranking` inside `prioritize()`/`roadmap()` (`recommendations_os.py:504-522`). Advisor `trace` is env-gated OFF in prod (`life.py:98-116`).

## Per-insight traceability

| Insight                        | Source                                                | Calculation                                                  | Reasoning                    | Confidence         | Dependencies                     | End-to-end?                                       |
| ------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------ | ---------------------------- | ------------------ | -------------------------------- | ------------------------------------------------- |
| **Recommendation**             | ✅ source_module + evidence.source_table              | ✅ visible formula                                           | ✅ description/narrative.why | ✅                 | ✅ impacted_domains + blocked_by | ✅ **Full**                                       |
| **Readiness score**            | ✅ Life Readiness Engine                              | ✅ weighted blend (`readiness.py:81,113`)                    | ✅ headline/gap              | ✅ per-domain      | ✅ missing/recs                  | ✅ **Full (recomputed, not stored)**              |
| **Risk**                       | ⚠️ OS on dashboard / snapshot in report (D1)          | partial                                                      | ✅ when OS-sourced           | ✅ when OS-sourced | ✅                               | ⚠️ **Breaks at report (D1)**                      |
| **Goal**                       | ⚠️ `public.goals`, no confirmed/origin in report (D2) | n/a                                                          | partial                      | sometimes          | objective link                   | ⚠️ **Breaks at report (D2)**                      |
| **Narrative (dominant story)** | ✅ derived from goal set + signals                    | ✅ deterministic keyword/theme (`life_discovery.py:285-339`) | ✅ `narrative_explanation`   | ✅                 | goal portfolio                   | ✅ Traceable; reasoning is heuristic (documented) |

## Where trust breaks

1. **Report vs dashboard divergence** (D1/D2) — same insight, two grounding paths.
2. **No stable per-insight `/why` endpoint** — lineage exists in `life_graph_workspace.recommendation_evidence` (`:96-140`) and rec `formula`, but isn't exposed as a deterministic "explain this insight" route. The only explain surfaces are the ranking-comparison string and the env-gated advisor trace.
3. **Readiness is recomputed, never snapshotted** — traceable but not point-in-time reproducible across data changes.

## Fixes (reuse existing assets, no new infra)

- **F1:** route report risks/opps + goals through the same OS/snapshot-gated paths the dashboard uses (closes D1+D2 and the divergence). _(Goal filter shipped this sprint; risk/opp routing queued.)_
- **F2:** add a thin `/v1/insights/{id}/why` (or extend `/recommendations`) returning the already-built `life_graph_workspace` lineage + `formula` — single source, zero new computation.
- **F3 (optional):** persist the readiness index alongside reports for point-in-time reproducibility (the engine output is already deterministic).

## Bottom line

The trust spine is real and strongest where it matters most (recommendations). Closing the report/dashboard divergence (F1) and adding one explain route (F2) makes trust verifiable end-to-end for every insight type shown to a user. Per-insight explainability ranked by pilot risk is also covered in EXPLAINABILITY_CONSISTENCY_REPORT.md.
