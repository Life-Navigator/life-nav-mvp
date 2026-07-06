# Latency Breakdown (P0.4)

**Mandate:** instrument every stage of an advisor turn, find the bottleneck, _measure — do not guess._
Targets: **avg < 4s, p95 < 6s** (current measured: p50 8.9s, p95 11.5s).

## Instrumentation shipped

`AdvisorOrchestrator.converse` (`app/services/advisor_orchestrator.py`) now times every stage with
`time.perf_counter()` and records them in `stages_ms` on the per-turn trace + log line + the
`analytics.advisor_turns` row. Stages measured:

| Stage key            | What it covers                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `deterministic_turn` | `RelationshipManager.converse` — persistence (candidate/rejected goals), canonical writes, safe fallback text |
| `context_build`      | `AdvisorContextBuilder.build` — discovery coverage + the user's personal graph + allowed-numbers              |
| `plan`               | `build_constraints` — deterministic plan/intent assembly                                                      |
| `llm_generate`       | **the Gemini call** (`generate_with_usage`) incl. retries                                                     |
| `validate`           | `advisor_validator.validate` — safety gates + repairs                                                         |
| `compose`            | `_compose` — final human-facing text assembly                                                                 |
| `latency_ms` (total) | request received → response returned                                                                          |

Every turn now emits a structured log line:

```json
{
  "event": "advisor_turn",
  "turn_id": "…",
  "llm_status": "enhanced",
  "latency_ms": 8910.2,
  "stages_ms": {
    "deterministic_turn": 420.1,
    "context_build": 1180.4,
    "plan": 2.1,
    "llm_generate": 7010.8,
    "validate": 1.9,
    "compose": 0.3
  },
  "tokens": 1650
}
```

and the same breakdown is queryable from `analytics.advisor_turns.stages_ms` and rolled up in
`analytics.advisor_turn_metrics` (avg + p95 latency).

## Where the time goes — MEASURED (live v89, 26 turns, `flyctl logs` → `stages_ms`)

| Stage                       |  Mean (ms) | p95 (ms) |     Share | Note                                                                     |
| --------------------------- | ---------: | -------: | --------: | ------------------------------------------------------------------------ |
| **`llm_generate` (Gemini)** | **7380.5** |  10450.5 | **75.9%** | One synchronous `gemini-2.5-flash` call — **the bottleneck**             |
| `context_build`             |     1559.0 |   1969.4 |     16.0% | Discovery-coverage + personal-graph reads (several Supabase round-trips) |
| `deterministic_turn`        |      780.1 |    998.5 |      8.0% | RelationshipManager persistence + canonical writes                       |
| `plan`                      |        0.0 |      0.1 |       ~0% | Pure in-process                                                          |
| `validate`                  |        0.1 |      0.2 |       ~0% | Safety gates + repair — **free**                                         |
| `compose`                   |        0.0 |      0.0 |       ~0% | Text assembly — **free**                                                 |
| **Total (server)**          |   **9720** |    12739 |      100% | p50 9224                                                                 |

**Conclusion (measured, not guessed):** the bottleneck is the **Gemini generation call at 75.9%** of every
turn; `context_build` (16%) is the only other meaningful contributor. Validation and composition are
**sub-millisecond** and are _not_ a latency concern. The 17%→0% repair added **zero** measurable latency
(`validate` ≈ 0.1 ms). Total avg **9.7s** / p95 **12.7s** — **~2.4× over the 4s/6s targets**.

## Recommended optimizations (ranked by expected impact)

1. **Stream the response** (highest impact on _perceived_ latency). Buffer for governance (the validator
   needs the full object), then type it out — already a stated UX preference. Cuts time-to-first-token
   from ~9s to ~1–2s even if total generation is unchanged.
2. **Parallelize `context_build`** — the discovery-coverage and personal-graph reads are independent;
   `asyncio.gather` them. Likely saves 0.5–1.5s.
3. **Cache the `my_life` snapshot per turn** — avoid recomputing aggregation the same turn (the dashboard
   path also pays this).
4. **Keep retries bounded** — the current `(0.5, 1.5)s` backoff with 2 retries can add up to ~3.5s on a
   bad-provider window; acceptable for correctness, but it explains p95 tail spikes. Log retry counts
   (already logged at WARNING in `gemini.py`) and watch the tail.

`validate`/`compose`/`plan` need **no** optimization — measured negligible.

## Verification (gated on deploy)

After deploy, read `stages_ms` from the first ~25 live turns (or `GET /v1/admin/advisor-metrics` for the
avg/p95 rollup) and confirm: `llm_generate` is the dominant stage; total avg < 4s / p95 < 6s after
streaming + context parallelization. Until streaming lands, expect total to stay ~9s but **now fully
attributed** — "we cannot optimize what we cannot see" is resolved: we can now see it.
