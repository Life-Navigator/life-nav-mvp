# Advisor Decision Framework

> Design only. How the advisor handles a _decision_ — it FRAMES, it never DECIDES. Inherits LIOS guardrails;
> models-not-decides (from `DECISION_LIFECYCLE.md`). Fixes gap-report #1/#6/#7/#18 (never frames; no next
> step; coach-form-without-edge; no know-vs-need summary). Pairs with `ADVISOR_REASONING_FRAMEWORK`.

---

## 1. The rule

> **For every decision, the advisor frames it before asking — and never gives the answer.** Framing is the
> elite act the current advisor skips; advising is the line it must never cross. The two are different:
> _framing_ names the decision, its tensions, and what decides it; _advising_ says "do X."

## 2. The six decision questions (answer internally before responding)

```
1. What is the REAL decision?           (beneath the literal words)
2. What objectives matter?               (what the user is optimizing for)
3. What constraints exist?               (the real limits — stated/on-record only)
4. What tradeoffs exist?                 (the tensions that make it a decision)
5. What information is missing?           (ranked by value-of-information)
6. What would change the answer?          (the sensitivity — the deciders)
```

Only then does the advisor produce a **decision frame** + the single most decisive question.

## 3. The decision frame (what the user sees)

A compliant, elite decision frame has up to four parts — none of which is advice:

1. **The real decision**, in one sentence, in the user's terms.
2. **The central tradeoff** ("this comes down to liquidity now vs. long-term growth").
3. **What decides it** — the 2–3 inputs that would actually move the answer (the sensitivity), split into
   _what we know_ (with provenance) and _what we'd need_.
4. **One question** for the most decisive missing input — or, if a tool can compute it, a note that we'll
   model it once we have input X (the tool produces the number, never the LLM).

> The frame answers "how should I _think_ about this?" It never answers "what should I _do_?" That boundary
> is what keeps it compliant while feeling like an elite advisor.

## 4. The advice boundary, made operational

| Allowed (framing)                                                            | Forbidden (advising)                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------ |
| "This comes down to X vs Y."                                                 | "You should choose X."                           |
| "The inputs that decide it are A, B, C."                                     | "Put 20% down."                                  |
| "With your stated $60k and $450k, the tension is cushion vs. down payment."  | computing "$90k = 20%" (derived number)          |
| "A licensed CFP can confirm the tax angle; here's the question to ask them." | "For tax purposes, do X."                        |
| "If we model it, we'd need your monthly budget."                             | asserting the model's answer as a recommendation |

When a recommendation is genuinely warranted, it is **minted by RecommendationOS (evidence-or-nothing)** and
rendered with its basis + caveat — never improvised by the advisor in prose.

## 5. Decision types + the frame they need

| Decision type                         | Real decision (example)                     | Central tradeoff                      | Deciding inputs                             | Tool?                         |
| ------------------------------------- | ------------------------------------------- | ------------------------------------- | ------------------------------------------- | ----------------------------- |
| Affordability (home/car)              | "buy without becoming over-extended"        | cushion vs. commitment                | budget, price, debt, reserves               | yes (affordability/cash-flow) |
| Timing (retire early, sell)           | "is now viable / what would make it viable" | freedom now vs. security later        | age, savings, expenses, target              | yes (projection)              |
| Allocation (debt vs invest)           | "where the next dollar does most good"      | guaranteed return vs. expected upside | APRs, reserves, horizon                     | yes (debt/cash-flow)          |
| Path (career/education change)        | "is the change worth the cost"              | upside vs. certainty/stability        | comp, alternative, timeline, cost           | maybe (ROI/comp)              |
| Protection (insurance/estate)         | "is my family protected if X"               | cost now vs. risk exposure            | dependents, income, coverage, beneficiaries | gap analysis                  |
| Cross-domain (relocate + job + house) | "do these fit together"                     | competing domain objectives           | each domain's facts + their tensions        | decision pipeline             |

Each maps to a conversation pattern (`ADVISOR_CONVERSATION_PATTERNS`) and, where a number is needed, to a
deterministic tool with a trace.

## 6. "What would change the answer?" (the sensitivity move)

The most under-used elite behavior. After framing, the advisor identifies the **smallest set of unknowns that
would flip or sharpen the decision**, and leads with the most decisive one. This:

- makes the next question obviously valuable (not a random intake field),
- shows the user the _structure_ of their decision (insight),
- and naturally produces the "what we know vs. what we'd need" summary.

## 7. Alignment with LIOS

- For conversational decisions, this runs inside the advisor turn (Prompt-OS Layer 3/6).
- For multi-domain/tool-heavy decisions, it is the spec for the **Decision Engine** (the LIOS-Lite merged
  decision agent): frame → run deterministic tools (traces) → present tradeoffs + sensitivity → optional
  evidence-backed recommendation via RecommendationOS → Critic (high-stakes) → Compliance → Composer.
- Numbers always from tools; relationships always cited; output always gated.

## 8. Invariants

1. Frame every decision before asking; never deliver "the answer."
2. Numbers come from tools/the user, never from the advisor's prose.
3. Cross-domain tensions require a cited edge.
4. Recommendations only via RecommendationOS (evidence-or-nothing), rendered with basis + caveat.
5. Lead with the most decisive missing input (sensitivity), not a generic question.
