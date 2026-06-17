# Advisor Upgrade Roadmap

> Analysis only — this is a **prioritized proposal**, not an implementation. No code, no prompt changes were
> made. Ranks the upgrades that would move the advisor from "trustworthy intake" to "elite advisor,"
> grounded in `ADVISOR_EXCELLENCE_GAP_REPORT.md` and the analyses. Expected impact / complexity / risk for each.

> Throughline: **~20 of 25 gaps are prompt + context-layer work.** The path to "elite" is mostly cheap,
> low-risk, and achievable in the **existing single advisor** — it does NOT require LIOS multi-agent, Vertex,
> or Claude. This is the same conclusion the LIOS simulation reached from the other direction.

---

## P0 — before beta (highest impact, mostly prompt/context, low risk)

| #    | Upgrade                                                                                                                                                                                                                         | Targets gaps | Expected impact                                    | Complexity                     | Risk                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------- | ------------------------------ | ------------------------------ |
| P0-1 | **Decision framing** — when a decision is detected, structure it: name the real tradeoff ("this comes down to liquidity vs. long-term growth"), name the 2–3 inputs that decide it, THEN ask the one question. Still no advice. | 1,6,7,8,18   | **Highest** — moves multi-domain turns from B→A    | Med (prompt)                   | Low (still discovery; gated)   |
| P0-2 | **Cross-turn context threading** — carry the session's stated specifics (numbers, facts, the named decision) into each turn's bounded context so it stops "starting over."                                                      | 2,13,22,23   | **Highest** — kills the #1 "intake" tell           | Med (context layer)            | Low (more grounding, not less) |
| P0-3 | **Question upgrade** — kill generic-vision deflection; default to a sharp, specific, often hypothetical-framed question that does the thinking; vary openings.                                                                  | 3,5,9,24     | **High** — raises HIGH-tier questions from ~10–15% | Med (prompt)                   | Low                            |
| P0-4 | **Voice + artifacts** — concise, declarative reflections; reduce hedging; fix malformed-quote + repetition.                                                                                                                     | 10,16,19,20  | **High** — executive presence 4→7                  | Low (prompt + compose cleanup) | Low                            |

> P0 is four prompt/context changes on the existing advisor. None touches safety; all are evaluable with the
> live harnesses (trust must stay 0; fallback stay 0). This is the "smallest set to feel elite."

## P1 — early beta (real value, moderate cost/complexity)

| #    | Upgrade                                                                                                                                                        | Targets  | Impact   | Complexity | Risk                                  |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | ---------- | ------------------------------------- |
| P1-1 | **Weave the deterministic tools/recs into the dialogue** — surface the user's real projection/numbers as advisor insight (the CFP-grade infra it already has). | 8,25     | High     | Med        | Low–Med (must stay no-advice)         |
| P1-2 | **Show "what I know vs. what decides this"** — a crisp calibration frame in the reply.                                                                         | 18,12    | Med–High | Low        | Low                                   |
| P1-3 | **A point of view / personality within guardrails** — lead with a framing, not just a question; consistent, distinctive advisor voice.                         | 11,12,21 | Med–High | Med        | Med (personality vs. caution balance) |
| P1-4 | **Emotional-context handling** — detect high-stakes/emotional moments; reflect them with appropriate weight before the question.                               | 14       | Med      | Med        | Low                                   |

## P2 — later (the genuinely harder [A] gaps; where LIOS could help)

| #    | Upgrade                                                                                                           | Targets | Impact  | Complexity | Risk                                        |
| ---- | ----------------------------------------------------------------------------------------------------------------- | ------- | ------- | ---------- | ------------------------------------------- |
| P2-1 | **Proactive tradeoff discovery** — needs richer graph/edges or a reasoning step (citation contract bound).        | 4,15    | Med     | High       | Med (the LIOS Decision-Engine territory)    |
| P2-2 | **Cross-domain connection** — link finance↔family etc., requires cited edges / seeded graph.                      | 15      | Med     | High       | Med                                         |
| P2-3 | **Two-part framing on complex asks** — relax the one-question rigidity where a frame+question beats one question. | 17      | Low–Med | Med        | Med (interacts with the validator's repair) |

These P2 items are exactly the ones the LIOS simulation flagged as the _unproven, expensive_ multi-agent
work — so they are correctly LAST, and gated on the coverage measurement.

---

## The eight final questions, answered

1. **Why does it feel weaker than ChatGPT?** ChatGPT is _unconstrained_ — it frames the whole decision,
   surfaces tradeoffs, and sounds expert in one rich turn (even ungrounded). LifeNavigator is _constrained_ —
   one question, no advice, deflect-to-discovery — so a single turn feels like intake. The gap is richness
   _within_ constraint, not the constraint itself.
2. **Why does it feel weaker than Claude?** Claude has **richness within calibration** — the exact thing
   LifeNavigator is trying to be. LifeNavigator has the calibration (honesty about the unknown) but not the
   richness (framing, insight, varied sharp questions). Claude is the closest target; the gap is the most
   instructive.
3. **Largest quality improvement?** **Decision framing (P0-1)** — structure the decision into its real
   tradeoff and the inputs that decide it. It's the difference between discovering and advising-without-advice.
4. **Largest (authority-)trust improvement?** **Executive presence + insight (P0-3/P0-4, P1-3)** — sound
   experienced and surface the non-obvious; users already trust it won't lie, not yet that it knows best.
5. **Largest engagement improvement?** **Cross-turn context (P0-2)** — continuity turns "starting over" into
   "continuing a relationship," the single biggest driver of "I want to keep talking to this."
6. **Largest decision-quality improvement?** **Framing + the deciding tradeoff + weaving in the deterministic
   tools (P0-1 + P1-1)** — the conversation finally uses the CFP-grade infrastructure it already has.
7. **Smallest set of changes that would make it feel elite?** **The four P0 items: frame decisions, retain
   cross-turn context, upgrade questions, fix voice/artifacts.** All prompt/context, low-risk, on the
   existing advisor. That set alone moves the dominant felt-experience from B to A.
8. **If we could only improve three things before beta?**
   1. **Cross-turn context retention** (stop starting over) — P0-2.
   2. **Decision framing** (structure the tradeoff + name the deciding inputs) — P0-1.
   3. **Question + voice upgrade** (sharp specific questions, no vision-deflection, varied openings, fix
      artifacts) — P0-3 + P0-4.
      These three are cheap, low-risk, safety-neutral, and hit 15+ of the top-25 gaps.

---

## The strategic punchline

The advisor's path to elite is **not** more agents, Vertex, or Claude. It is **better prompting and better
context-carrying on the advisor we already have** — exactly the "cheap layer" the LIOS simulation identified
as where the real value lives. The most important investment before beta is the four P0 prompt/context
upgrades, validated with the existing eval harnesses (trust and fallback must stay at 0). Everything else —
multi-agent, the Decision Engine, cross-domain tradeoffs — is correctly downstream and gated on proving it
beats this upgraded single advisor.

_(Reminder: this sprint is analysis only. Nothing here has been implemented; these are prioritized,
evidence-backed recommendations for a future, separately-approved build.)_
