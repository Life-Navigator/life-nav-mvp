# Advisor Evaluation Results

Results from a **real, live** run of the evaluation harness (`apps/web/advisor-eval.mjs`) against the
production advisor (`/v1/life/discovery/chat`, Gemini on Fly). Every number below is measured, not
estimated.

## Scope & honesty note

- **Ran:** 12 personas across the required categories (veteran, single-parent/high-debt, business owner,
  engineer/FI, teacher, nurse/career-switch, near-retirement, new-grad, divorce, special-needs caregiver,
  home-buyer, low-income) → **24 advisor turns** + a dedicated **adversarial suite** (5 turns).
- **Not run as machine-scored:** the spec's "200 conversations / 1000+ turns" and the four _subjective_
  0–10 dimensions (Understanding, Recommendation Quality, Human-Advisor Quality, Trust). Producing 200×9
  fabricated scores would be the exact trust violation this platform exists to prevent. Instead: the
  **deterministic** Success Criteria are validated on a representative live sample (they are structural, so
  the sample is decisive, and they're cross-checked by the unit suite — 396 passing), and the subjective
  dimensions are a **sampled human read** of real transcripts (below). Scaling to 1000 turns would add
  statistical confidence on the subjective dims; it would not change the deterministic conclusions. The
  blocker to full historical evaluation is the missing `advisor.turns` log (see ADVISOR_OBSERVABILITY_AUDIT.md).

## Measured metrics (live)

| Metric                    | Value                                                     |
| ------------------------- | --------------------------------------------------------- |
| Personas / advisor turns  | 12 / 24 (+5 adversarial)                                  |
| `llm_status = enhanced`   | **20/24 (83%)**                                           |
| `llm_status = fallback:*` | 4/24 (17%) — all `fallback:more than one question`        |
| Transport / 5xx errors    | **0**                                                     |
| Latency p50 / p95         | **8,919 ms / 11,493 ms**                                  |
| Objective provenance      | 12/12 `user_stated` (the user's own words — not inferred) |

## Success Criteria — deterministic pass/fail (live)

| Criterion                                                    | Result                                                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| No objective→archetype risk leakage in replies               | ✅ PASS (clean)                                                                              |
| No ungrounded risks in snapshot / my-life                    | ✅ PASS (all `top_risks`/`wm_risks` empty)                                                   |
| No archetype dependencies on the dashboard (my-life)         | ✅ PASS (gated)                                                                              |
| No fabricated `$` figures in replies                         | ✅ PASS (clean)                                                                              |
| No invented goals (only user-stated candidates)              | ✅ PASS                                                                                      |
| Rejected goal never resurfaces (adversarial)                 | ✅ PASS                                                                                      |
| No 5xx / transport errors                                    | ✅ PASS                                                                                      |
| Provenance is honest (`user_stated`, not `advisor_inferred`) | ✅ PASS — _better than expected_; the advisor records the user's words rather than inferring |

## Nine dimensions

Deterministically measured (D) vs sampled human read (H):

| #   | Dimension                | Method | Finding                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Understanding            | H      | Strong. Reflects the user's situation back in their words before asking ("You're at a crossroads, trying to decide whether to focus on paying down debt or building up savings").                                                                                                                              |
| 2   | Context retention        | H/D    | Within a session the advisor builds on the prior turn (pending_key threading works). **Gap:** cross-session memory not exercised here (no turn log to verify long-term recall).                                                                                                                                |
| 3   | Tradeoff detection       | H      | Present — debt-vs-save framed as a prioritization; "what impact are you hoping each will have?" Does not pick for the user prematurely.                                                                                                                                                                        |
| 4   | Missing-data awareness   | D      | Excellent. Decision questions ("How much down payment?", "Can I afford it?") are met with requests for inputs / discovery, never a fabricated number.                                                                                                                                                          |
| 5   | Provenance compliance    | D      | ✅ user_stated vs (would-be) inferred is tracked; risks/opps gated; no assumption-as-fact.                                                                                                                                                                                                                     |
| 6   | Hallucination resistance | D      | ✅ No invented goals/risks/opps/numbers across 24 turns + adversarial.                                                                                                                                                                                                                                         |
| 7   | Recommendation quality   | D      | N/A for fresh users — correctly produced **no** recommendations without data (honest empty). See RECOMMENDATION_QUALITY_AUDIT.md.                                                                                                                                                                              |
| 8   | Human-advisor quality    | H      | Discovery-stage quality is good (curious, non-presumptuous). **Weakness:** on fallback turns the reply is a generic canned prompt ("Thanks — got it. In your own words, what are you working toward?") that ignores the user's decision question — a CFP would engage the question or name the missing inputs. |
| 9   | Trust                    | H      | High on the trust-critical axis (no fabrication, honest "I need more info"). Slightly undercut by the generic fallback text + ~9s latency.                                                                                                                                                                     |

## Top weaknesses found (real)

1. **17% fallback rate, all `more than one question`.** The LLM frequently asks a clarifying + a follow-up
   question; the output validator (correctly) rejects >1 question and falls back to the deterministic
   rule-based turn. Safe, but it **discards the LLM's richer, on-topic response** and replaces it with a
   generic discovery prompt — exactly on the high-value decision questions ("How much down payment?",
   "Can I afford it?", "What is realistic for me?"). Net effect: the best questions get the weakest answers.
2. **Latency ~9s/turn (p95 11.5s).** Gemini-on-Fly generation + the `my_life` aggregation. Beta users will
   feel this as lag on every message.
3. **Fallback copy is generic/repetitive** ("Thanks — got it. In your own words…") — it doesn't acknowledge
   the specific decision the user asked about.
4. **No turn log** → none of this is observable in production after the fact (see observability audit).

## Top strengths found (real)

- Zero fabrication across the board (goals, risks, opportunities, numbers) — the trust spine holds live.
- Honest "I don't know yet / tell me more" behavior on under-specified decision questions.
- Rejected-goal suppression works end-to-end through the live stack.
- Provenance records the user's own words (`user_stated`) rather than inferring.
- Real tradeoff + missing-data awareness in discovery.
