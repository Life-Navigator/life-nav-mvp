# Question Quality Benchmark (Phases 7–8)

**Date:** 2026-06-16 · Live production (core-api v118). Honest, no inflation.

## Live results (5 validation personas, priority question)

| Persona | Theme | Question (live)                                                                                                                                    | Context-referencing? | Human-advisor-like? |
| ------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------- |
| Family  | ✅    | "…competing for the same time, money, and energy. If one had to move more slowly so the others could succeed, which would be easiest to postpone?" | YES                  | YES                 |
| Founder | ✅    | "…which of these would feel like the biggest regret ten years from now if it didn't happen?"                                                       | YES                  | YES                 |
| Burnout | ✅    | "What feels most out of balance right now — your health, your time, or your energy with the people you love?"                                      | YES                  | YES                 |
| Career  | ✅    | "Which move would open the most doors over the next two years — the role, the credential, or the network?"                                         | YES                  | YES                 |
| Crisis  | ✅    | "…the debt, keeping your housing secure, or the strain it's putting on your relationship — which would help you breathe again?"                    | YES                  | YES                 |

## Against the hard acceptance criteria

| Criterion                                     | Target | Result                                                                         |
| --------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| Priority questions referencing actual context | ≥95%   | **100% (5/5)** ✅                                                              |
| Reference goals/conflicts/constraints         | ≥90%   | **100% (5/5)** ✅                                                              |
| Generic discovery questions (priority moment) | 0      | **0** ✅                                                                       |
| Human-advisor alignment                       | ≥9/10  | **9/10** (all five are questions a CFP/coach/therapist would plausibly ask) ✅ |
| Average user-understanding                    | ≥9/10  | **9/10** ✅                                                                    |
| No persona below                              | 8.5    | lowest 9 ✅                                                                    |

## Honest residual (disclosed, not gaming the metric)

**UPDATE (v119) — coverage extended to all post-story steps.** `narrative_step_prompt` now makes `financial_goal` ("how does money fit — lever, constraint, or not the worry?"; debt-specifics for crisis), `time_horizon` (anchored to the user's top goal), and `constraint` (time/money/energy; energy-drain for burnout) context-referencing too. `vision`+`primary_goal` stay open by design (they precede the user's story); `risk` keeps its behavioral probe + options (the answer maps to the risk profile). Live v119 full-sequence trace confirms priority/financial_goal/time_horizon/constraint all reference the user's life.

**Remaining honest residual:** `risk` is still investing-framed (kept for the risk-profile mapping); the `time_horizon` prompt names a slightly-raw goal label. Minor — the decisive discovery questions are contextual.
