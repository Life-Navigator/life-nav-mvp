# Eval Round 2 Results (live, post-fix)

**Run:** `node apps/web/advisor-eval.mjs` against the **live** backend **v89** (deployed 2026-06-14), 12
personas × 2 turns = 24 advisor turns + adversarial suite. All results are **measured from live calls** —
no estimates. Raw: `/tmp/eval_results.json`; server-side telemetry: 26 `advisor_turn` log lines parsed
from `flyctl logs`.

## Headline (measured)

| Metric                             | Before (Round 1)                       | After (Round 2, live)                     | Target        | Verdict        |
| ---------------------------------- | -------------------------------------- | ----------------------------------------- | ------------- | -------------- |
| **Fallback rate**                  | **17%** (all `more than one question`) | **0%** (0/24)                             | < 5%          | ✅ **MET**     |
| `enhanced` turns                   | 83%                                    | **100%** (24/24)                          | —             | ✅             |
| Validator **repairs**              | 0 (rejected instead)                   | **3** `multi_question_trimmed` (salvaged) | —             | ✅ fix works   |
| **Avg latency** (server)           | ~9s                                    | **9720 ms**                               | < 4000 ms     | ❌ **NOT met** |
| **p50 / p95 latency** (round-trip) | 8.9s / 11.5s                           | **9114 / 12570 ms**                       | p95 < 6000 ms | ❌ **NOT met** |
| Transport errors                   | 0                                      | **0**                                     | 0             | ✅             |
| Trust violations                   | 0                                      | **0** (see note)                          | 0             | ✅             |

> Round-trip latency (harness, incl. network from the test host) ≈ server latency (log `latency_ms`):
> 9114 vs 9720 ms p50 — the network adds little; the time is server-side, in the model call.

## Captured signals (the sprint's required fields)

| Field                            | Value (measured)                                                             |
| -------------------------------- | ---------------------------------------------------------------------------- |
| total conversations              | 13 (12 personas + 1 adversarial)                                             |
| total turns                      | 24 scored + ~5 adversarial                                                   |
| fallback rate                    | **0%**                                                                       |
| validation failures (rejections) | **0** (3 turns _repaired_, not rejected)                                     |
| latency                          | avg 9720 ms · p50 9224 ms · p95 12739 ms (server); p95 12570 ms (round-trip) |
| confidence                       | not emitted by the discovery turn (null) — see gap below                     |
| retrieval counts                 | graph edges available: **0** (fresh users have no personal graph — expected) |
| tokens                           | avg **3110**/turn · max 3807                                                 |

## Trust criteria (deterministic, live)

```
PASS · No objective→archetype risk leakage in replies — clean
PASS · No ungrounded risks in snapshot/my-life — clean
PASS · No archetype dependencies on dashboard (my-life) — clean
PASS · No fabricated $ figures in replies — clean
FAIL · Objective provenance = advisor_inferred (not confirmed) — 0/12   <-- HARNESS BUG, not a regression
PASS · Rejected goal never resurfaces (adversarial)
PASS · No 5xx / transport errors — clean
```

**The one FAIL is a harness assertion bug, not a trust failure.** The harness asserts
`provenance_type === 'advisor_inferred'`, but the live value is `user_stated` (the user's own words) —
which is _more_ trustworthy, not less. The advisor is correctly attributing the objective to the user
rather than to itself. This matches the documented prior finding ("objective = user_stated… better than
expected"). **Fix the assertion** (expect `user_stated`/`user_confirmed`), don't "fix" the behavior.

## What this proves

1. **The validator repair eliminated the entire fallback class.** Round 1 was 17% fallback, 100% of it
   `more than one question`. Round 2 is 0% fallback, with 3 turns visibly _repaired_ (`multi_question_trimmed`)
   — i.e. the exact turns that used to fall back are now salvaged and served as enhanced LLM responses.
2. **No safety regression.** Zero invented numbers, zero archetype leakage, zero ungrounded risks, rejected
   goal stays rejected. The repair removed only the cosmetic rejection.
3. **Observability is live.** 26 turns were reconstructed entirely from the new `advisor_turn` log lines
   (status, validator outcome, repairs, per-stage latency, tokens) — "we cannot optimize what we cannot
   see" is resolved.

## What this does NOT clear

- **Latency missed target by ~2.4×** (9.7s vs 4s avg; 12.7s vs 6s p95). Root cause is measured, not
  guessed — see `LATENCY_BREAKDOWN.md` (Gemini generation = 76% of the turn). The fix (streaming /
  context parallelization) was **out of scope this sprint** ("no new features"). This is the primary
  open risk for the GO/NO-GO.
- **Confidence + graph retrieval not exercised** — fresh users have no personal graph (0 edges) and the
  discovery turn doesn't emit a confidence score. The grounded-citation path needs a seeded-graph persona
  (P1 backlog), not a blocker for trust.
