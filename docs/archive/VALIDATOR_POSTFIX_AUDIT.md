# Validator Post-Fix Audit (Phase 3)

**Goal:** determine whether the multi-question REPAIR removed the primary failure source.

**Method:** live run on v89 — 24 persona turns + adversarial + 16 hard-decision turns = **40 live advisor
turns**, with server-side `advisor_turn` telemetry parsed from `flyctl logs` (validator_result + repairs
per turn).

## Answer: YES. The primary (only) failure source is gone.

|                               | Round 1 (before)             | Round 2 (after, live)                                         |
| ----------------------------- | ---------------------------- | ------------------------------------------------------------- |
| Fallback rate                 | **17%**                      | **0%** (0/40)                                                 |
| Rejections                    | all `more than one question` | **0**                                                         |
| Repairs                       | 0                            | **3** `multi_question_trimmed`                                |
| Validator result distribution | reject on multi-Q            | 23 accepted + 3 repaired (of 26 logged) + 14 accepted (probe) |

## Per-rejection capture (the sprint's required table)

**There were zero rejections to capture.** That is the finding. The single rejection class that produced
100% of Round-1 fallbacks (`next_q.count("?") > 1`) now produces **repairs, not rejections**.

What the repair did, captured from telemetry (`validator_result=repaired`, `repairs=["multi_question_trimmed"]`):

| Field               | Value                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| count               | **3** turns repaired across the persona run                                                                                                                              |
| user prompt         | high-value discovery turns (the LLM volunteered a second question)                                                                                                       |
| raw LLM output      | two-question `next_question` (full raw is captured in `analytics.advisor_turns.llm_response_raw` once the migration is applied; the log line is metadata-only by design) |
| validator reason    | none — **accepted after repair** (not rejected)                                                                                                                          |
| fallback used       | **no**                                                                                                                                                                   |
| repaired?           | **yes** — trimmed to the first question                                                                                                                                  |
| should have passed? | **yes** — and now it does, served as `enhanced`                                                                                                                          |

Every one of the 3 repaired turns was served to the user as an `enhanced` LLM response. In Round 1 those
same turns would have been discarded for the generic rule-based fallback. **This is the 17%→0% mechanism,
observed live.**

## Did any OTHER failure source appear?

No. Across 40 live turns:

- `llm_status`: **40/40 enhanced**, 0 fallback (0 `unavailable`, 0 `error`, 0 `empty`).
- Safety gates never had to reject (0 invented numbers, 0 advice language, 0 ungrounded relationships).
- The repair added **0.1 ms** to the validate stage — no latency cost.

## Safety not weakened (regression check)

The unit suite (`tests/test_advisor_hybrid.py`, 30 tests) still proves the safety gates reject: invented
financial numbers, advice/medical/legal/tax language, non-user-sourced facts, rejected-goal resurrection,
and force `should_persist=False`. Live, the adversarial suite confirmed a rejected goal ("advance my
career") never resurfaced. The repair only _removes_ trailing question text; all safety checks run over the
full text before it.

## Verdict

The multi-question repair **removed the primary and only observed failure source.** Fallback is 0% live,
with the repair visibly active. No new failure source emerged. Validator quality objective: **met.**
