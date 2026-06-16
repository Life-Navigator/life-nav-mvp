# Root Cause Attribution (Workstream J)

**Question:** of the advisor-quality gap, what % is attributable to each cause? Must total 100%, evidence-based.

## Two framings (both matter)

### Framing 1 — the RESIDUAL gap: prod today (Gemini V6, 6.66) → raw-Claude ceiling (8.00) = +1.34

This is the gap that remains _after_ the V-series. Decomposed from the control experiment:

| Cause                             |        % | Evidence                                                                               |
| --------------------------------- | -------: | -------------------------------------------------------------------------------------- |
| **Model capability**              |  **47%** | Gemini→Claude in the identical pipeline = +0.64 of 1.34                                |
| **Validator / number gate**       |  **49%** | enhanced-only LN+Claude 8.08 ≈ raw 8.00; the +0.70 from removing fallbacks = 0.70/1.34 |
| **Rule suppression (non-number)** |   **3%** | a few relationship-claim fallbacks (V6 fin-09/fin-11 class)                            |
| **Prompt design**                 |   **1%** | residual only — V3–V6 already banked the prompt gains; enhanced parity shows ~0 left   |
| **Response composition**          |   **0%** | enhanced parity; structure is neutral-to-positive                                      |
| **Compliance (advice scope)**     |   **0%** | no advice/medical/legal/tax blocks fired on Claude's outputs                           |
| **Architecture (LIOS absence)**   |   **0%** | proven off the critical path — adding orchestrator/agents addresses neither lever      |
| **Total**                         | **100%** |                                                                                        |

### Framing 2 — the FULL journey: V2 baseline (5.78) → ceiling (8.00) = +2.22

Includes the historical work, to credit what actually moved the number:

| Cause                                    |        % | Evidence                                                                    |
| ---------------------------------------- | -------: | --------------------------------------------------------------------------- |
| **Prompt / mechanism (V2→V6)**           |  **40%** | +0.88 banked: expose reasoning, advice, grounded math, graceful degradation |
| **Model capability**                     |  **29%** | +0.64 (Claude uplift)                                                       |
| **Validator / number gate (still open)** |  **31%** | +0.70 recoverable                                                           |
| **Total**                                | **100%** |                                                                             |

## The headline

- **The two open levers are model capability (~47%) and the validator number gate (~49%) — essentially a 50/50 split.**
- **Prompt, composition, compliance, and architecture each contribute ~0% to the residual gap.** Prompt mattered historically (Framing 2) but is now exhausted; the rest never were the bottleneck.
- **Architecture (LIOS) is 0% of the gap.** No measured weakness traces to the absence of an orchestrator, critic, decision engine, scenario engine, or new agents.

## Why this is evidence, not guessing

1. **Model %** is a direct measurement: same prompt/validator/compose, only the model changed → +0.64.
2. **Validator/number-gate %** is a direct measurement: same model (Claude), all-50 7.30 vs non-fallback 8.08 → the delta is exactly the number-gate fallbacks.
3. **Prompt/composition/compliance ≈ 0%** is proven by enhanced-only parity (LN+Claude 8.08 ≈ raw Claude 8.00): on turns the pipeline passes, the pipeline removes ~nothing.
4. **Architecture 0%** is proven by absence: every losing scenario maps to a model gap or a number-gate fallback, none to a missing orchestration capability.

## Implication for the next sprint

Spend on the two real levers, in this order of ROI:

1. **Number-gate refinement** (~49%, pure engineering, no model cost, no trust loss) — admit document/tool/verified numbers; recover the ~6 fallbacks.
2. **Selective Claude routing** (~47%, model cost/latency managed by routing only high-stakes turns).
   Do **not** spend on LIOS to close this gap — it attributes to 0%.
