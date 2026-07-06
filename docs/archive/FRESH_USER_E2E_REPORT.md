# Fresh-User E2E Report (P0.6)

## LIVE RUN (v89, 2026-06-14) — `apps/web/fresh-user-e2e.mjs`

One brand-new user, **no seeded data / no fixtures / no admin role / no pre-created goals**. Walked the
full surface area (the exact endpoints the web UI calls). **All measured live.**

| Result                | Value                                                             |
| --------------------- | ----------------------------------------------------------------- |
| Advisor discovery     | 2/2 turns `enhanced` (0 fallback)                                 |
| Surface reads         | **17/17 → HTTP 200**                                              |
| 5xx errors            | **0**                                                             |
| 401/403 auth failures | **0**                                                             |
| 404 (missing routes)  | **0**                                                             |
| Mock/fabricated data  | **none** — every domain returned an honest empty/structured state |

Per-surface (status · latency · shape):

| Surface                                                           | Status |        ms | State                                                                                                 |
| ----------------------------------------------------------------- | ------ | --------: | ----------------------------------------------------------------------------------------------------- |
| Onboarding guide                                                  | 200    |       143 | data                                                                                                  |
| Platform dashboard                                                | 200    |      2334 | status/focus_decision/next_best_action/top_gaps                                                       |
| Life snapshot                                                     | 200    |       338 | vision/objectives/top_risks/top_opportunities (honest empty for risks/opps)                           |
| My Life (Life Model)                                              | 200    |      2665 | what_matters_most/life_readiness/next_best_action                                                     |
| Life attention (next best action)                                 | 200    | 3068–3434 | next_best_action/alerts                                                                               |
| Discovery coverage                                                | 200    |       555 | overall_coverage_pct/domains                                                                          |
| Family office                                                     | 200    |       802 | estate/trust/beneficiary readiness                                                                    |
| Family / Career / Education / Finance summaries + recommendations | 200    |   152–748 | standard domain envelope (`data`/`recommendations`/`missing`/`confidence`/`freshness`) — honest empty |
| Finance canonical summary                                         | 200    |       240 | net-worth components (all zero for fresh user — correct)                                              |
| Recommendations                                                   | 200    |       136 | `{recommendations: []}` — honest empty, no fabricated cards                                           |
| Report preview (full)                                             | 200    |      4767 | renders                                                                                               |

**Verdict (Phase 5): PASS.** Every user journey surface works end-to-end for a real new user, returns
honest data or honest empty states (never fabricated), with zero errors and zero broken routes. The only
caveat is **latency on the heavier reads** (dashboard 2.3s, my-life 2.7s, attention 3.4s, report 4.8s) —
acceptable for non-chat reads but consistent with the advisor-latency theme.

---

## (Pre-live context — harness design & prior fresh-user trust results)

**Mandate:** create a brand-new user with **no seeded data / no fixtures**, run onboarding → advisor →
goals → dashboard → recommendations, and capture every turn, retrieval, validator event, fallback, and
latency.

## Harness

`apps/web/advisor-eval.mjs` (committed `e0ebce4`) does exactly this against the **live**
`/v1/life/discovery/chat`: it mints brand-new users via the admin API, completes the onboarding gate
(`profiles.setup_completed` + `onboarding_completed`), drives multi-turn discovery, runs deterministic
trust checks, and cleans the users up afterward. **No mock data** — every turn is a real backend call.

Per turn it captures: `llm_status`, `latency`, `candidate_goals`, `relationships_referenced`, plus the
deterministic trust assertions (no invented goals/risks/opps/$; rejected-goal suppression; provenance
honesty; no archetype leakage).

## Results — fresh users, no seeded data (real, 12 personas / 24 turns + adversarial)

| Stage                   | Outcome                                                                                                                                                                | Evidence                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Onboarding**          | ✅ Gate passes; advisor _is_ the onboarding (chat-native).                                                                                                             | Users reach discovery; first grounded question asked. |
| **Advisor turns**       | ✅ Zero fabrication; ⚠️ 17% fallback (all `more than one question` — now repaired).                                                                                    | `ADVISOR_EVALUATION_RESULTS.md`, `VALIDATOR_AUDIT.md` |
| **Goals**               | ✅ Only user-stated goals; rejected goals never resurrected; objective provenance = `user_stated` (the user's own words, not `advisor_inferred`).                      | trust checks PASS                                     |
| **Dashboard / my-life** | ✅ Honest empty/`insufficient` states for no-data users; risks/opps grounded in the rec engine only.                                                                   | `RECOMMENDATION_QUALITY_AUDIT.md`                     |
| **Recommendations**     | ✅ Zero recs for empty users = correct honest empty state (no fabricated cards). Coverage/quality not exercised by fresh users (by design — needs data-rich personas). | "no recommendation without evidence" guard            |
| **Errors**              | ✅ 0 errors across the run.                                                                                                                                            | —                                                     |

**Verdict from the fresh-user run:** the **trust spine is sound** for a brand-new user — the system shuts
up gracefully when it doesn't know enough and never fabricates. The only fresh-user defect was the 17%
fallback on high-value questions, which is the P0.3 fix.

## What the new instrumentation adds to this report (post-deploy)

Before this sprint the harness could only see signals **returned in the response**. With P0.1/P0.4/P0.5
shipped, the same fresh-user run will additionally yield, per turn, _durably_:

- `analytics.advisor_turns` rows: full message/response/raw + validator outcome + repairs + fallback
  reason + token cost + `graph_edges_available` + `relationships_referenced`.
- `stages_ms` latency breakdown (deterministic_turn / context_build / plan / llm_generate / validate /
  compose) — answering "where is the latency" per turn.
- `GET /v1/admin/advisor-metrics`: total turns, **fallback rate**, avg + **p95 latency**, validation
  failure rate, avg confidence/edges/tokens — the single-glance beta health number.
- With `ADVISOR_TRACE_ENABLED=1`, the harness can request `trace:true` and capture the full per-turn
  `_trace` (intent → context → validator outcome → fallback reason → final response).

## Gated step (the post-fix confirmation run)

Re-run after the migration apply + Fly deploy:

```
node apps/web/advisor-eval.mjs        # drives the live, fixed backend
curl -H "Authorization: Bearer <admin-jwt>" $CORE/v1/admin/advisor-metrics
```

**Pass criteria:** fallback rate < 5%; `more than one question` no longer appears; zero trust regressions
(same deterministic checks still green); `advisor_turns` rows present for every turn; `stages_ms` populated.

This run requires the deployed-with-fix backend (Supabase auth + Fly deploy), which is the only thing
between here and a fully evidenced P0.6. Until then, the **fresh-user trust results above are real and
current**; only the post-fix fallback-rate delta and the durable-telemetry capture are pending.
