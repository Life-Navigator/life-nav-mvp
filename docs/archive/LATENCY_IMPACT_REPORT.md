# Latency Impact Report — Advisor P0 Upgrade

**Date:** 2026-06-15 · **Version:** `advisor-hybrid-2.3.0`
**Source:** `apps/web/advisor-excellence-eval.mjs`, 16 live multi-turn scenarios (32 turns), measured on the
follow-up turn (full pipeline incl. history fetch + LLM + validate + compose + persist).

## Result

| Metric                      | Value                     |
| --------------------------- | ------------------------- |
| p50 latency                 | **8,364 ms**              |
| p95 latency                 | **11,432 ms**             |
| Baseline (pre-P0, observed) | ~9,000 ms                 |
| Net change                  | **≈ flat** (within noise) |

## Why P0 did not add meaningful latency

The dominant cost is the single Gemini `generate` call (~8s p50), unchanged by P0. The P0 additions are cheap:

- **History fetch (P0.1):** one indexed `analytics.advisor_turns` read (`user_id`+`conversation_id`,
  `limit 6`). Sub-50ms; logged as the `history_fetch` lap. Returns `[]` on any error — never blocks.
- **Context build / prompt size (P0.1):** `conversation_so_far` adds ≤6 short turn pairs to the prompt;
  marginal token cost, no extra round-trip.
- **Prompt rewrite (P0.2–P0.5):** longer system prompt, same single call. Negligible.

## The retry adds latency only on the failure path

The new single retry fires **only when the first `generate()` returns `None`** (~19% under burst, expected far
lower in normal traffic). On that path, the user previously got the deterministic opener; now they wait for one
more LLM attempt (~+8s worst case) to get a real advisor reply instead. Trade: a slower-but-correct answer on
the rare failure, vs. a fast-but-generic deflection. The happy path (≈81%+) is unchanged.

## Recommendation

Latency is acceptable for beta but ~8s p50 is the top remaining UX cost. It is **model/infra-bound**, not P0-bound.
Streaming (`converse_stream`, ack→final SSE) already masks it in the web UI by showing the deterministic ack in
~1s while the validated reply lands. No latency-driven changes required for this sprint.
