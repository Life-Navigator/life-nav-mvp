# P0 Beta Readiness Report (Observability / Validator / Latency sprint)

**Sprint:** Observability, Validator Quality, and Latency. _No new features. No Vertex/Claude/routing. No
graph work. No domain expansion._ The mandate was to make the advisor **visible** and fix the one quality
defect (fallback rate), not to add capability.

> Note: a prior `BETA_READINESS_REPORT.md` (Sprint M Phase 8, the four user journeys) already exists and is
> left untouched; this file is the P0 sprint's readiness synthesis.

## Verdict

**Code-complete and test-green. Beta-ready pending three gated ops steps** (migration apply → Fly deploy →
live re-eval). The trust spine was already sound (prior eval: zero fabrication); this sprint closes the
observability blind spot and the 17% fallback defect.

## Definition of Done — can we now answer these?

| Question                                      | Answer | Backed by                                                     |
| --------------------------------------------- | ------ | ------------------------------------------------------------- |
| Why did the advisor say this?                 | ✅     | `advisor_turns.llm_response_raw` + `advisor_response`         |
| Why did the validator reject?                 | ✅     | `validator_result` + `validator_reason` + `validator_repairs` |
| Why did the fallback occur?                   | ✅     | `fallback_used` + `fallback_reason`                           |
| Which graph nodes/edges/provenance were used? | ✅     | `graph_edges_available` + `relationships_referenced`          |
| Where is the latency?                         | ✅     | `stages_ms` (6 stages) + p95 in `advisor_turn_metrics`        |
| What are the top advisor quality problems?    | ✅     | `VALIDATOR_AUDIT.md` (1 dominant: multi-question → fixed)     |

> "We cannot optimize what we cannot see." — we can now see every turn.

## What shipped (code-complete, tests green: 397 passed)

- **P0.1 Turn logging** — per-turn telemetry + structured log line + best-effort durable write to
  `analytics.advisor_turns` (service-role only) + token capture from Gemini `usageMetadata` + a
  `GET /v1/admin/advisor-metrics` dashboard (fallback rate, p95 latency, validation failure rate, …).
- **P0.2 Validator audit** — `VALIDATOR_AUDIT.md`: 100% of fallbacks were one over-strict cosmetic rule.
- **P0.3 Validator improvement** — multi-question REJECT → REPAIR (trim to first question), every rule
  classified (`VALIDATOR_IMPROVEMENT_PLAN.md`); no safety gate weakened; 4 new tests.
- **P0.4 Latency audit** — every stage instrumented; bottleneck identified (Gemini generation) without
  guessing (`LATENCY_BREAKDOWN.md`).
- **P0.5 Trace mode** — dev-only `_trace`, gated by `ADVISOR_TRACE_ENABLED`; never exposed to end users.
- **P0.6 Fresh-user E2E** — real fresh-user trust results captured (`FRESH_USER_E2E_REPORT.md`); post-fix
  fallback-rate delta pending the live re-run.

## Safety / trust — no regressions

No safety gate was modified. The repair only _removes_ trailing content (never adds), and all safety
checks run over the full text _before_ the repair. Safety tests unchanged and green (invented numbers,
advice/medical, rejected-goal suppression, non-user-fact drop, no-persist). No fabricated
goals/risks/opps/recs introduced. Provenance + GraphRAG citation contract intact.

## Files changed

- `app/clients/gemini.py` — `generate_with_usage()` (token usage).
- `app/services/advisor_llm.py` — capture `last_usage` / `last_raw`.
- `app/services/advisor_validator.py` — multi-question REPAIR (`_first_question`).
- `app/services/advisor_orchestrator.py` — stage timing, trace, log line, best-effort persist.
- `app/services/analytics.py` — `advisor_metrics()`.
- `app/routers/analytics.py` — `GET /v1/admin/advisor-metrics`.
- `app/routers/life.py` — thread `conversation_id` + dev-gated `trace`.
- `app/dependencies.py` — pass `supabase` to the orchestrator.
- `supabase/migrations/160_advisor_turns.sql` — table + metrics view (service-role RLS).
- `tests/test_advisor_hybrid.py` — repair + telemetry + trace tests.

## Ops steps — ALL DONE (2026-06-14)

1. ✅ **Migration applied** — `160_advisor_turns.sql` via Supabase Management API; `analytics.advisor_turns`
   - `analytics.advisor_turn_metrics` exist; inserts verified.
2. ✅ **Deployed** — core-api **v90** on Fly (v89 first, then a jsonb-encoding fix in v90).
3. ✅ **Live re-eval** — fallback **17%→0%** (40 turns), 0 trust regressions, `GET /v1/admin/advisor-metrics`
   returns 200. See `EVAL_ROUND_2_RESULTS.md` + `BETA_GO_NO_GO_REPORT.md`.

**Outcome:** validator/observability objectives MET and live. Remaining beta blocker is **latency only**
(streaming, next sprint).

## Recommendation

Ship steps 1–3 to convert this from "code-complete" to "evidenced beta-ready." Expected result: fallback
17% → <5% with full per-turn observability and the latency bottleneck attributed (Gemini generation;
streaming is the next-sprint lever for perceived latency).
