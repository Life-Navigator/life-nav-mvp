# Model Role Qualification — Production Advisor

**Date:** 2026-06-15
**Purpose:** Decide which models are qualified to serve in the LifeNavigator production advisor role, on evidence — not vibes.
**Scope:** Gemini Flash-Lite, Gemini Flash (2.5), Gemini Pro, Claude Sonnet, Claude Opus (4.1).

---

## The evidence base (read this first)

Only **two** of the five models below have been run through the _actual_ LifeNavigator advisor harness — identical 50-scenario benchmark, identical 5-judge rubric, identical trust spine (`ADVISOR_SYSTEM` prompt + validator + repair + composer):

| Model                | Status                                                                     | Source                                                                                       |
| -------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Gemini-2.5-flash** | **BENCHMARK-EVIDENCED** — the production incumbent                         | `ADVISOR_V6_RESULTS.md` (overall **6.66**, trust 8.5, p50 12.7s, 5 fallbacks)                |
| **Claude Opus 4.1**  | **BENCHMARK-EVIDENCED** — control experiment (Vertex, `USE_VERTEX_CLAUDE`) | `CLAUDE_CONTROL_EXPERIMENT.md` (LN+Claude **7.30**, raw Claude 8.00, trust 8.2, p50 **61s**) |
| Gemini Flash-Lite    | **NOT benchmarked** — inference only                                       | public capability/pricing tier reasoning                                                     |
| Gemini Pro           | **NOT benchmarked** — inference only                                       | public capability/pricing tier reasoning                                                     |
| Claude Sonnet        | **NOT benchmarked, NOT yet enabled on Vertex** — inference only            | public capability/pricing tier reasoning                                                     |

> **Hard rule for this qualification:** _No model earns a PASS without benchmark evidence on the real harness._ Capability priors and pricing pages do not substitute for a measured score on our 50 scenarios. Consequently the **only quality-backed PASS available today is Claude Opus 4.1** (and even that is conditioned on cost/latency — see below). Every "inferred" rating is flagged explicitly as **(INFERRED — not benchmark-evidenced)**.

---

## Dimension ratings

Ratings are 1–5 (★). **[B]** = benchmark-evidenced on the LN harness. **[I]** = inferred from public capability/pricing, _not_ measured here.

### Gemini Flash-Lite — **(all [I] — INFERRED, never benchmarked)**

| Dimension               |  Rating   | Notes                                                                                            |
| ----------------------- | :-------: | ------------------------------------------------------------------------------------------------ |
| Reasoning               | ★★☆☆☆ [I] | Smallest tier; expect below the 6.66 Flash plateau on insight/tradeoffs. Untested.               |
| Actionability           | ★★☆☆☆ [I] | Flash already floors at 4.7 actionability; Lite likely no better. Untested.                      |
| Trust                   | ★★★☆☆ [I] | Trust is mostly carried by the LN validator, not the model — so plausibly holds, but unmeasured. |
| Latency                 | ★★★★★ [I] | Fastest/cheapest tier; sub-Flash latency expected.                                               |
| Cost                    | ★★★★★ [I] | Lowest cost of any candidate.                                                                    |
| Reliability             | ★★★☆☆ [I] | Same Gemini API surface as Flash; fallback behavior unknown at this tier.                        |
| Context                 | ★★★☆☆ [I] | Long context window available; quality of _use_ untested (Flash context-usage = 7.3).            |
| Framing                 | ★★☆☆☆ [I] | Decision framing is capability-bound; expect ≤ Flash's 6.7. Untested.                            |
| Report-writing          | ★★☆☆☆ [I] | Composer structure helps, but prose quality likely below Flash. Untested.                        |
| Executive communication | ★★☆☆☆ [I] | Flash exec-presence = 6.5; Lite expected lower. Untested.                                        |

### Gemini Flash (2.5) — **the BENCHMARKED incumbent — (all [B])**

| Dimension               |  Rating   | Notes                                                                                                |
| ----------------------- | :-------: | ---------------------------------------------------------------------------------------------------- |
| Reasoning               | ★★★☆☆ [B] | Insight 6.1, tradeoff discovery 6.5 — competent but plateaued; the residual gap is model capability. |
| Actionability           | ★★☆☆☆ [B] | **4.7** — the weakest measured axis. Four sprints of prompt/mechanism work could not lift it.        |
| Trust                   | ★★★★★ [B] | **8.5**, _above_ target and above LN+Claude (8.2). 0 fabrications, ties frontier on trust.           |
| Latency                 | ★★★★★ [B] | **p50 12.7s** — ~5× faster than Opus; viable for interactive UX.                                     |
| Cost                    | ★★★★★ [B] | Lowest cost among benchmarked models by a wide margin.                                               |
| Reliability             | ★★★★☆ [B] | 5 fallbacks / 50 (10%); stable in production as `advisor-hybrid-6.0.0`.                              |
| Context                 | ★★★★☆ [B] | Context usage 7.3 — solid; understanding 7.6.                                                        |
| Framing                 | ★★★☆☆ [B] | Decision framing 6.7 (target 8.0, missed).                                                           |
| Report-writing          | ★★★☆☆ [B] | Adequate inside the 5-section composer; not distinctive.                                             |
| Executive communication | ★★★☆☆ [B] | Executive presence 6.5.                                                                              |

### Gemini Pro — **(all [I] — INFERRED, never benchmarked)**

| Dimension               |  Rating   | Notes                                                                                            |
| ----------------------- | :-------: | ------------------------------------------------------------------------------------------------ |
| Reasoning               | ★★★★☆ [I] | Larger Gemini tier; expected to sit between Flash (6.66) and Opus (7.30) on reasoning. Untested. |
| Actionability           | ★★★☆☆ [I] | Likely beats Flash's 4.7, unlikely to reach Opus's 6.2 in-pipeline. Untested.                    |
| Trust                   | ★★★★☆ [I] | Validator-carried; plausibly strong, unmeasured.                                                 |
| Latency                 | ★★★☆☆ [I] | Slower/pricier than Flash, faster/cheaper than Opus. Untested.                                   |
| Cost                    | ★★★☆☆ [I] | Mid-tier; materially above Flash.                                                                |
| Reliability             | ★★★★☆ [I] | Same API family as the live Gemini path; fewer fallbacks plausible. Untested.                    |
| Context                 | ★★★★☆ [I] | Strong long-context tier. Untested in harness.                                                   |
| Framing                 | ★★★☆☆ [I] | Expected above Flash. Untested.                                                                  |
| Report-writing          | ★★★☆☆ [I] | Expected above Flash. Untested.                                                                  |
| Executive communication | ★★★☆☆ [I] | Expected above Flash. Untested.                                                                  |

### Claude Sonnet — **(all [I] — INFERRED; NOT yet enabled on Vertex, never benchmarked)**

| Dimension               |  Rating   | Notes                                                                                                                                                 |
| ----------------------- | :-------: | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reasoning               | ★★★★☆ [I] | Claude-family reasoning is the benchmarked strength (Opus +0.64 over Flash); Sonnet expected close to Opus, below it. Untested + not yet provisioned. |
| Actionability           | ★★★★☆ [I] | Claude's standout axis (Opus 6.2 in-pipeline, 8.5 raw); Sonnet plausibly inherits much of it. Untested.                                               |
| Trust                   | ★★★★☆ [I] | Claude caught its own fabrications conceptually; validator still gates. Expected strong, unmeasured.                                                  |
| Latency                 | ★★★★☆ [I] | Expected materially faster than Opus's 61s — the main reason Sonnet is the attractive routing target. Untested.                                       |
| Cost                    | ★★★★☆ [I] | Far cheaper than Opus, above Gemini Flash. The cost/quality sweet spot _if it benchmarks_. Untested.                                                  |
| Reliability             | ★★★☆☆ [I] | **Blocker: not enabled on Vertex (LifeNav project) yet** — cannot run today.                                                                          |
| Context                 | ★★★★☆ [I] | Large context window; usage quality unmeasured.                                                                                                       |
| Framing                 | ★★★★☆ [I] | Claude framing is strong (Opus 7.3 in-pipeline, 8.4 raw); Sonnet expected good. Untested.                                                             |
| Report-writing          | ★★★★☆ [I] | Claude prose is a known strength; expected good. Untested.                                                                                            |
| Executive communication | ★★★★☆ [I] | Claude exec presence strong (Opus 7.3 / raw 8.4); expected good. Untested.                                                                            |

### Claude Opus 4.1 — **the BENCHMARKED frontier (control experiment) — (all [B])**

| Dimension               |  Rating   | Notes                                                                                                                                       |
| ----------------------- | :-------: | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Reasoning               | ★★★★★ [B] | Insight 7.0 (vs Flash 6.1), tradeoff 6.9, understanding 8.0. Raw Claude 7.9–9.0. The reasoning lever.                                       |
| Actionability           | ★★★★☆ [B] | **6.2 in-pipeline (vs Flash 4.7, +1.5)**; raw 8.5. Largest single quality gain from the swap.                                               |
| Trust                   | ★★★★★ [B] | 8.2 in-pipeline, **0 fabrications** (LN validator caught 3 that raw Claude made — platform makes Opus _safer_). Slightly under Flash's 8.5. |
| Latency                 | ★★☆☆☆ [B] | **p50 61s — ~5× slower than Flash.** The decisive productization problem.                                                                   |
| Cost                    | ★★☆☆☆ [B] | Premium per-token pricing; a blanket swap is economically non-viable for interactive UX.                                                    |
| Reliability             | ★★★★☆ [B] | 6 fallbacks / 50 (number gate); on the 44 non-fallback turns it scores 8.08 ≈ raw 8.00.                                                     |
| Context                 | ★★★★★ [B] | Context usage 7.6 (best measured in-pipeline); 91% of raw quality survives the LN pipeline.                                                 |
| Framing                 | ★★★★☆ [B] | Decision framing 7.3 (vs Flash 6.7); raw 8.4.                                                                                               |
| Report-writing          | ★★★★☆ [B] | Composer organizes Claude's reasoning with ~0 quality drag, arguably positive.                                                              |
| Executive communication | ★★★★☆ [B] | Executive presence 7.3 (vs Flash 6.5); raw 8.4.                                                                                             |

---

## Overall qualification verdict

| Model                  | Verdict                                    | Basis                                                                                                                                                                                                                                                                                                             |
| ---------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude Opus 4.1**    | **CONDITIONAL PASS**                       | The **only benchmark-backed quality PASS** (LN 7.30 > Flash 6.66, +0.64; 0 fabrications). **Conditioned strictly on SELECTIVE USE** — the 61s p50 latency and premium cost make a blanket swap non-viable for interactive UX. Qualified for **high-stakes advisory turns only**, with Gemini handling the rest.   |
| **Gemini Flash (2.5)** | **CONDITIONAL PASS**                       | Benchmark-evidenced as fast (12.7s), cheap, and the **most trustworthy** model measured (8.5, 0 fabrications). **But quality is capped at 6.66** — actionability floored at 4.7 after four sprints of work. Qualified as the **default/volume tier**, NOT as the sole advisor for high-stakes turns.              |
| **Claude Sonnet**      | **CONDITIONAL PASS — UNTESTED**            | Strong inferred cost/quality candidate and the natural Opus-economics fix, **but cannot PASS without benchmark evidence, and is NOT yet enabled on Vertex.** Must clear ≥7.5 on the identical harness before any production routing. Provisioning + benchmark are prerequisites.                                  |
| **Gemini Pro**         | **CONDITIONAL PASS — UNTESTED**            | Plausible mid-tier upgrade over Flash on reasoning/framing, but **no harness evidence and a real cost/latency step-up over Flash.** Benchmark required before any role.                                                                                                                                           |
| **Gemini Flash-Lite**  | **FAIL (for the advisor role) — UNTESTED** | Inferred to sit _below_ the already-quality-capped Flash on every reasoning/actionability axis, with no offsetting benefit Flash doesn't already provide. **Not qualified as a primary advisor.** Could be reconsidered only for non-advisory utility calls (classification/routing), and only after a benchmark. |

### Why no second PASS, and why these are CONDITIONAL

- **No model PASSes without benchmark evidence.** Three of five (Flash-Lite, Pro, Sonnet) have never touched the real harness; their ratings are explicitly inferred and therefore cannot clear the bar regardless of how attractive the priors look.
- **Opus is PASS-on-quality but CONDITIONAL-on-economics.** 61s p50 and premium pricing forbid a blanket deployment. The evidence (`CLAUDE_CONTROL_EXPERIMENT.md` §"Cost / latency caveat") explicitly prescribes selective use — Claude for high-stakes turns, Gemini for the rest, or a cheaper Claude tier (Sonnet). Its PASS is therefore conditioned on a routing layer that confines it to the turns that justify the cost.
- **Flash is CONDITIONAL because it is quality-capped at 6.66.** It is genuinely production-grade on trust/latency/cost — but four sprints proved its quality ceiling is a model-capability limit, not a prompt problem. It passes as the default tier, not as the answer for the hardest advisory moments.

---

## Recommended production posture

1. **Default tier: Gemini Flash (2.5)** — fast, cheap, trustworthy; handles the volume of advisory turns at p50 12.7s.
2. **High-stakes tier: Claude Opus 4.1 (selective routing only)** — reserved for the turns where the +0.64 / +1.5-actionability quality lift is worth ~5× latency and premium cost. Behind `USE_VERTEX_CLAUDE`.
3. **Open evaluation: Claude Sonnet** — the most promising path to Opus-class quality at viable economics. **Action: enable on Vertex, then run the identical 50-scenario harness.** If it clears 7.5, it likely displaces Opus as the high-stakes tier and possibly Flash as default.
4. **Keep the LN validator in front of every model** — it is the trust spine that delivered 0 fabrications for both benchmarked models (and caught 3 that raw Claude made). Trust is platform-carried, which is why model swaps don't endanger it.
5. **Do not deploy Flash-Lite or Gemini Pro to the advisor role** without first running the harness; Flash-Lite is not expected to qualify.

---

_This qualification will be revised the moment any UNTESTED model is run through the real harness. Inferred ratings carry no production authority._
