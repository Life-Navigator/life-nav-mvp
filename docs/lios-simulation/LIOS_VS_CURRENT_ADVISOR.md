# LIOS vs. the Current Advisor — Head to Head

> An honest comparison of today's single-agent advisor against LIOS-full (as designed) and LIOS-minimal
> (merge hypotheses applied). Evidence only — no code. Grounded in the simulations + the measured baseline.

---

## 1. The contenders

- **Current advisor** — LIVE single-agent path (`AdvisorOrchestrator`): deterministic turn → context →
  one LLM call → validate → compose → audit. 0% fallback, 0 trust violations, ~9–10s, ~3,110 tokens.
- **LIOS-full** — as designed: intent → selection → parallel domain LLM agents → 4-call decision pipeline →
  Recommendation agent → Critic → Compliance-assist → assembly. Complex ≈ 6–10 LLM calls.
- **LIOS-minimal** — merge hypotheses (H1–H5): deterministic domains + one Discovery Analyst + one Decision
  Engine (1 LLM call + N deterministic tools) + high-stakes-only Critic, deterministic Compliance. Complex
  ≈ 2–3 LLM calls.

## 2. Scorecard

| Dimension                            | Current advisor                     | LIOS-full                                            | LIOS-minimal                                                    |
| ------------------------------------ | ----------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| **Trust / safety**                   | 0 violations (proven)               | 0 (same gate) — more surface to slip, more to verify | 0 (same gate), minimal new surface                              |
| **Conversational/discovery quality** | strong (0% fallback)                | same + ranked missing-data + tradeoffs               | same + ranked missing-data + tradeoffs                          |
| **Simple-query quality**             | sufficient (25/100 already handled) | no gain, +cost                                       | no gain, +0 cost (routes to the advisor)                        |
| **Multi-domain decision quality**    | limited (single call)               | **higher (est, unproven)** on 47/100                 | **higher (est, unproven)** on 47/100 — same gain, far less cost |
| **Recommendation quality**           | evidence-or-nothing (high)          | **same** (the guard is the quality)                  | **same**                                                        |
| **Onboarding**                       | strong                              | +2 dimensions (missing-data, tradeoffs)              | +2 dimensions, in one call                                      |
| **Latency (complex p95)**            | ~13–16s                             | **~68s (p99 ~83s)**                                  | **~13–24s**                                                     |
| **Cost (per complex query)**         | 1×                                  | ~10–30×                                              | ~3–6×                                                           |
| **Cost ceiling vs $4/day**           | ~400 users                          | **~46–100 users**                                    | ~178–267 users                                                  |
| **Operability**                      | simple, proven                      | many moving parts, unbuilt, Critic missing           | few new parts, mostly reuse                                     |
| **Build effort**                     | — (exists)                          | large (full multi-agent runtime)                     | moderate (wrap + 2 merged agents + routing)                     |

## 3. Where LIOS genuinely beats today

- **Multi-domain, tool-heavy decisions** (home/retirement/relocation/insurance/business — the 47/100
  high-gain set): a structured decision-reasoning step over the deterministic tools plausibly produces
  better-framed tradeoffs than one advisor call. **But the gain is an estimate — coverage is unmeasured.**
- **Ranked missing-data + cited tradeoffs** in onboarding (cheap, real).
- **Intent routing + prompt-composition consistency** (cheap, real — quality and maintainability).

## 4. Where LIOS does NOT beat today (be honest)

- **Simple/conversational turns (≥25/100):** the current advisor is already sufficient; LIOS adds nothing
  (and full-LIOS adds cost).
- **Recommendation content:** identical — the deterministic evidence guard is the quality; LLM agents change
  narration, not substance.
- **Trust:** the deterministic gate already delivers 0 violations; LIOS-full adds _risk surface_, not safety.

## 5. The decisive contrasts

1. **LIOS-full is ~4–5× worse on latency and cost than LIOS-minimal for the SAME proven gains.** The extra
   LLM calls (per-domain agents + the 4-call decision tail) buy unproven quality at proven cost. This is the
   crux.
2. **LIOS-minimal is close to the current advisor's latency/cost** while adding the genuinely valuable,
   cheap capabilities — and it degrades to the current advisor on simple turns.
3. **Nothing here changes the trust story** — that's already solved deterministically.

## 6. Verdict

Against the current advisor, **LIOS-full is not justified by the evidence**: it costs 10–30× and 40–90s for
quality gains that are unproven and a recommendation/trust story that is already solved. **LIOS-minimal is
the credible upgrade**: it keeps today's strengths, adds the cheap real value (routing, composition, ranked
gaps, one decision-reasoning step), confines the only expensive call (the Decision Engine) to the 47/100
decisions that plausibly need it, and stays within latency/cost reach. The current advisor remains the right
default for everything else. Full reasoning in `LIOS_BUILD_DECISION.md`.
