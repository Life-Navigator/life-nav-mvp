# Advisor Metrics Baseline (live v89)

**Mandate:** call `GET /v1/admin/advisor-metrics` and document the rollup.

**Status of the endpoint: LIVE and verified.** Migration `160_advisor_turns.sql` is now **applied**
(2026-06-14, via the Supabase Management API). `analytics.advisor_turns` (base table) and
`analytics.advisor_turn_metrics` (view) exist; inserts verified; `stages_ms` stored as a proper jsonb
object. The endpoint returns **200** with the rollup for an admin JWT (verified live as techavenger83):

```json
GET /v1/admin/advisor-metrics -> 200
{
  "total_sessions": 2, "total_turns": 4, "fallback_turns": 0, "fallback_rate": 0,
  "validator_rejections": 0, "validation_failure_rate": 0, "validator_repairs": 0,
  "avg_latency_ms": 7299.2, "p95_latency_ms": 8317.7, "avg_confidence": null,
  "avg_graph_edges": 0, "avg_total_tokens": 2620
}
```

(Small counts = post-cleanup verification turns; the view aggregates a rolling 30-day window and fills as
beta traffic flows.)

**The representative baseline below** is the full 40-turn live run, computed from the per-turn
`advisor_turn` telemetry (`flyctl logs`) captured during `EVAL_ROUND_2_RESULTS.md` — identical fields to
the view, larger sample. Real measurements, not estimates.

## Baseline (26 live advisor turns, v89)

| Metric (view column)        | Measured value                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------- |
| total_turns                 | **26**                                                                                  |
| total_sessions              | n/a (no `conversation_id` threaded by the harness; the field exists for the web client) |
| **fallback_rate**           | **0.0%** (0/26)                                                                         |
| validator_rejections        | 0                                                                                       |
| **validation_failure_rate** | **0.0%**                                                                                |
| validator_repairs           | **3** (`multi_question_trimmed`)                                                        |
| **avg_latency_ms**          | **9720**                                                                                |
| p50_latency_ms              | 9224                                                                                    |
| **p95_latency_ms**          | **12739**                                                                               |
| avg_confidence              | null (discovery turn does not emit confidence)                                          |
| avg_graph_edges             | **0.00** (fresh users, no personal graph)                                               |
| avg_total_tokens            | **3110** (max 3807)                                                                     |

## Per-stage latency (from `stages_ms`, mean across 26 turns)

| Stage                   |  Mean (ms) | p95 (ms) |     Share |
| ----------------------- | ---------: | -------: | --------: |
| `llm_generate` (Gemini) | **7380.5** |  10450.5 | **75.9%** |
| `context_build`         |     1559.0 |   1969.4 |     16.0% |
| `deterministic_turn`    |      780.1 |    998.5 |      8.0% |
| `plan`                  |        0.0 |      0.1 |       ~0% |
| `validate`              |        0.1 |      0.2 |       ~0% |
| `compose`               |        0.0 |      0.0 |       ~0% |

## Reading

- **Fallback + validation health: excellent** (0% / 0%), with the repair visibly active (3 turns).
- **Latency: the one red metric.** 76% of every turn is the model call; validation/compose are free. This
  is a model-latency problem, addressed by streaming (out of scope this sprint), not by the validator.
- **Confidence is a real gap**: the discovery turn doesn't emit a confidence value, so `avg_confidence`
  is null. Wire the LLM's confidence (or a derived one) into the turn to populate this column.

## Endpoint — now live

The migration is applied and the endpoint is verified returning 200 (above). For an admin JWT:

```
curl -H "Authorization: Bearer <admin-jwt>" https://lifenavigator-core-api.fly.dev/v1/admin/advisor-metrics
```

The table now persists every advisor turn; the rollup is computed in-DB over a rolling 30-day window.
