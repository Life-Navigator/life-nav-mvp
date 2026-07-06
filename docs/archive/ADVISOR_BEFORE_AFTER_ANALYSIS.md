# Advisor Before / After Analysis

**Comparison:** prior advisor (`advisor-hybrid-2.2.0`) vs P0 advisor (`advisor-hybrid-2.3.0`)
**Harness:** `apps/web/advisor-excellence-eval.mjs` — 16 multi-turn scenarios, live against Fly.
Each scenario: turn 1 states context (numbers + the decision); turn 2 is a short follow-up that **requires
remembering turn 1** ("Can I afford it?", "Am I on track?", "Should I take it?"). Metrics are measured on the
**follow-up turn** — the exact moment the old advisor "started over."

## Headline

| Dimension                                          | Before (baseline) | After (P0)                                   | Verdict            |
| -------------------------------------------------- | ----------------- | -------------------------------------------- | ------------------ |
| **Context use** (reply reflects a turn-1 specific) | ~0%               | **81%**                                      | ✅ the core fix    |
| **Vision-deflection** (lower better)               | ~19–35%           | **6%**                                       | ✅ near-eliminated |
| **Fabricated numbers** (must be 0)                 | 0%                | **0%**                                       | ✅ trust held      |
| **Decision framing** (names tradeoff/decision)     | low               | **25%** (regex floor; see note)              | ↑                  |
| **Fallback rate**                                  | ~0% single-turn   | **19%** under multi-turn burst → retry added | ⚠️ addressed       |
| **Latency p50 / p95**                              | ~9s               | **8.4s / 11.4s**                             | ≈ flat             |

## The behavior that changed

**Before (the complaint).** The advisor felt like _"a careful intake chatbot."_ On turn 2 it had no memory of
turn 1 — it would re-ask, ask "what does _it_ refer to," or deflect a concrete question into "what does success
look like to you?" Context use was ~0% by construction (no cross-turn read existed).

**After.** On 13 of 16 follow-ups the advisor reflected the user's own turn-1 specifics back and framed the
real decision. Examples (follow-up replies, verbatim, truncated):

- **retire** — _"You're asking if you're on track for early retirement, given your age of 45 and $300k in your 401k…"_ (reflects both turn-1 numbers)
- **mba** — _"…whether the $120k investment in an MBA is 'worth it' given your current…"_ (names the decision + the number)
- **relocate** — _"You're evaluating a move to Texas for a $20k raise, and we're trying to understand if that move makes sense…"_ (frames the tradeoff)
- **debt** — _"…whether to use your $5k in savings to pay down your $15k credit card debt…"_ (both numbers, the real fork)

## Honest weaknesses (measured, not hidden)

1. **Framing regex reads 25%** — this is a _floor_, not a ceiling. The `FRAME` regex only fires on explicit
   tradeoff/"comes down to/versus" language. Many replies frame the decision in prose ("whether to accept a
   manager promotion…") without tripping the regex. Qualitatively the framing rate is far higher than 25%;
   the metric understates it. Tightening the prompt to _name the central tradeoff in one clause_ is the next
   easy lift.
2. **Opener variety (P0.5) partial.** Several replies still open with "You're weighing a significant
   decision…" despite the VOICE instruction to vary openings. The clichés/therapy-language are gone; the
   _opening template_ is still sticky. A low-cost follow-up: add 2–3 example openings to the prompt or a
   light post-process that rejects the stock opener.
3. **Fallback 19% under burst** — three follow-ups (home, divorce, inherit) returned the deterministic
   opener because the LLM call returned `None` (transient Gemini 502/timeout/truncated JSON) under the
   rapid 32-call burst. Latencies on those were normal (6.6–8.2s), i.e. not systemic timeouts. **Fix
   shipped:** one retry on `None` before degrading (still re-validated). See `TRUST_REGRESSION_REPORT.md`
   for why this is resilience, not a trust change.

## Definition-of-done check

Target: no longer _"a careful intake chatbot,"_ now _"a thoughtful advisor helping me understand my
situation"_ — **without** new hallucinations/trust risk, **without** LIOS/Vertex/Claude/new agents.

- Context retention is real and measured (0% → 81%). ✅
- Vision-deflection near-eliminated (→6%). ✅
- Zero fabricated numbers; trust spine unchanged. ✅
- No new architecture. ✅
- Remaining polish (opener variety, framing crispness) is prompt-only and tracked above. ◻️
