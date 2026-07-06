# CRITICAL_CONVERSATION_REPLAY.md — Phase 5

Live replay on Vertex `gemini-2.5-pro` through the real advisor pipeline after the policy/gate refinements. Result: **6/6 enhanced, answer-first, no fabrication, no unnecessary refusal.**

| #   | Conversation        | Prompt (abridged)                                               | Status                    | Answer-first | Evidence                                                                                                                          |
| --- | ------------------- | --------------------------------------------------------------- | ------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Wedding body recomp | "wedding in 16 weeks, get lean + build muscle, tweaky shoulder" | ✅ enhanced (2,907 chars) | ✅           | Full plan: training split 2×/muscle/week, shoulder-safe modifications, nutrition, progression                                     |
| 2   | Home purchase       | "$140k income, $60k saved — afford a $500k house?"              | ✅ enhanced               | ✅           | "looks like a stretch… $60k falls short of the $100k for a 20% down… 2-5% closing… 3-6 month emergency fund" (benchmarks survive) |
| 3   | Promotion           | "director at $185k but more hours — take it?"                   | ✅ enhanced (1,322)       | ✅           | "lean toward taking it, but only if the time cost…" — clear position + the decisive variable                                      |
| 4   | New child           | "first baby in 5 months — what to do financially/otherwise?"    | ✅ enhanced (2,363)       | ✅           | Prioritized list: life+disability insurance first, will/guardianship, budget — concrete                                           |
| 5   | Estate planning     | "what happens if I die tomorrow? no will"                       | ✅ enhanced (1,444)       | ✅           | "creating a will is one of the most important steps… without one the state's rules decide" + non-obvious insight                  |
| 6   | Education decision  | "UT AI master's now or after we buy a house?"                   | ✅ enhanced (1,393)       | ✅           | "lean toward buying the house first… stability aligns with your vision" — takes a position                                        |

## Checks (all met)

- ✅ Advisor answers immediately (6/6 lead with substance).
- ✅ No unnecessary questions (follow-ups are refine-second, after the answer).
- ✅ No unnecessary refusals (0/6 fell back).
- ✅ No finance derailment (home purchase uses benchmarks/scenarios, stays on topic).
- ✅ No excessive disclaimers (V4 prompt; professional-referral only where legal/tax/medical).
- ✅ Actionable recommendations (plans, prioritized lists, clear positions).

## Method note

Context was built via the test scaffolding (empty fake DB) — so these prove the **model + prompt + gate** behavior, not personalized grounding. With a real onboarded user the answers additionally cite the user's facts. A deployed re-run with seeded users is the final confirmation (no deploy performed this sprint).
