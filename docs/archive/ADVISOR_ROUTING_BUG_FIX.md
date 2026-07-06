# ADVISOR_ROUTING_BUG_FIX.md

## The bug

`route_domains()` (the RM's domain picker for fact grounding) used **substring keyword matching** with sparse keywords and a **finance-biased fallback**. Result: health/family questions got the wrong grounding → Arcana answered fitness questions with credit-card/down-payment advice.

Proven with the live router:
| Message | Before | Why |
|---|---|---|
| "Build me a workout plan" | `['career']` | `"work"` matched inside `"work`out" (substring) |
| "Let's talk about TRT" | `['career','education','finance']` | no keyword → finance-biased fallback |
| "estate planning" | `['career','education','finance']` | no keyword → fallback |
| "my testosterone levels" | `['career','education','finance']` | no keyword → fallback |

## The fix (surgical — one function, no new architecture/model/router)

In `app/services/advisor_agents.py`:

1. **Whole-word matching** — compiled `\b(?:kw1|kw2|…)\b` per domain instead of `kw in text`. `"work"` can no longer fire on `"workout"`.
2. **Complete health/fitness keywords** — added workout, gym, training, lift, weights, HIIT, martial arts, swimming, cardio, diet, nutrition, sleep, muscle, body fat, knee, shoulder, arthritis, injury, joint, rehab, mobility, strength, TRT, testosterone, hormone, supplement, labs, bloodwork, mental health, therapy (plus fuller finance/career/education/family sets; `will` added to family).
3. **No finance fallback** — when nothing matches (a broad/ambiguous question), ground in **all five life domains** and let the RM synthesize (general-advisor behavior). Never defaults to finance.

## What did NOT change

Discovery (untouched), Advisor OS (untouched), no new model, no new router, no new dependency. `domains_for()` and the agent roster are unchanged — only the keyword table + matching logic.

## Result

10/10 validation intents route correctly; the exact failed conversation routes to `['health']` only (FAILED_CONVERSATION_REPLAY.md); verified live against Arcana — health answer, medical caveat, zero finance leak. 603 backend tests pass.

## Note on response _style_

The routing is fixed. The reply still reads report-ish ("The decision is… / The tradeoffs:") — that's a **separate P0** (Structured Response Rendering), not domain routing. Out of scope for this surgical fix.
</content>
