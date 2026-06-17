# LIOS Cost Model

> **Implementation planning only — no code, no runtime change, no deploy, no Gemini wiring, no beta change.**
> Estimates token + dollar cost per query tier and the daily budget for a 20-user beta, anchored to the
> **measured live baseline** (`CURRENT_STATE_AUDIT.md` §6) and the per-tier agent counts in
> `AGENT_SELECTION_ENGINE.md` §4. Builds on `ORCHESTRATOR_IMPLEMENTATION_PLAN.md` (phases that gate each new
> LLM call) and `PARALLELIZATION_MODEL.md` (which agents fan out).
>
> **This is an ESTIMATE.** The only hard numbers are the live measured baseline. Everything per-tier is a
> projection from agent counts × the measured per-call token shape, and is bounded as a range.

---

## 1. Pricing assumption (stated explicitly — do not treat as a quote)

- **Platform:** Google **AI Studio** (developer API), **NOT Vertex AI**. Model `gemini-2.5-flash`
  (`config.py:25`), Fly backend only.
- **Assumed published AI Studio pricing for `gemini-2.5-flash` (mid-2026):** **~$0.30 / 1M input tokens**
  and **~$2.50 / 1M output tokens**. Pricing changes; re-confirm at run time. All dollar figures below carry
  this assumption.
- **Cheaper-classification option** referenced as a lever: `gemini-2.5-flash-lite` at **~$0.10 / 1M input,
  ~$0.40 / 1M output**.
- **Sources:** see footer.

### 1.1 Input/output split assumption (the load-bearing one)

The measured turn is **~3,110 tokens total** (max ~3,800). The advisor turn is grounding-heavy (bounded
context: allowed_numbers, real edges, classified facts, scores — `advisor_context.py:prompt_dict`) with a
short governed reply. **Assumption: ~85% input / ~15% output**, i.e. **~2,650 input + ~460 output** per
call. This split dominates the dollar math (output is ~8× the price of input), so it is stated up front and
should be re-measured from `analytics.advisor_turns.prompt_tokens/completion_tokens` before any spend
decision.

---

## 2. The unit cost of one LLM call (LIVE baseline)

One advisor `llm_generate` call, at the assumed split and pricing:

| Component          |     Tokens | Rate (assumed) |                Cost |
| ------------------ | ---------: | -------------- | ------------------: |
| Input              |     ~2,650 | $0.30 / 1M     |           ~$0.00080 |
| Output             |       ~460 | $2.50 / 1M     |           ~$0.00115 |
| **One call total** | **~3,110** | —              | **~$0.0019–0.0020** |

So **one live advisor turn ≈ $0.002** (about a fifth of a US cent). **LIVE** — this is the only tier that
exists today; everything below is **PLANNED**.

> Range hedge: if the split is closer to 70/30 input/output, a single call rises to ~$0.0029. We carry
> **$0.002–0.003 per LLM call** as the planning band.

---

## 3. Per-tier projection (PLANNED — multi-agent)

Tiers and agent sets are from `AGENT_SELECTION_ENGINE.md` §4. **Not every selected agent is an LLM call** —
Tool Execution, GraphRAG retrieval, Compliance (deterministic validator), and Audit are **non-LLM** today.
We count only the agents that issue a Gemini call. Each LLM call is assumed to cost the same ~$0.002–0.003
unit; complex reasoning calls (Decision Scientist, Tradeoff, Critic) likely carry **larger context**, so we
apply a ×1.3 context multiplier to those and say so.

| Tier         | Example                                  | LLM-issuing agents (per `AGENT_SELECTION_ENGINE.md`)                                                                         | LLM calls | Est. tokens | Est. $/query (assumed pricing) |
| ------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------: | ----------: | -----------------------------: |
| **SIMPLE**   | "What is my net worth?"                  | Finance (Tool Exec is deterministic)                                                                                         |   **1–2** |   3.1k–6.5k |               **$0.002–0.006** |
| **MODERATE** | "Can I afford this house?"               | Finance ∥ Family, Decision Scientist                                                                                         |   **3–5** |      9k–18k |               **$0.006–0.020** |
| **COMPLEX**  | "Move to Texas + new job + buy a house?" | Finance ∥ Career ∥ Family, Decision Scientist, Scenario, Tradeoff, Recommendation, **Critic** (+ optional Compliance-assist) | **6–10+** |    20k–40k+ |              **$0.020–0.060+** |

Notes:

- **SIMPLE** ≈ today's single advisor turn, plus a possible intent-classification call (Phase 2). Use
  Flash-Lite for classification (§6) and the second call is ~$0.0005, not $0.002.
- **MODERATE** parallel domains do **not** reduce token cost (parallelism is a latency lever, not a cost
  lever — you still pay for every call); see `LATENCY_MODEL.md`.
- **COMPLEX** is the cost driver: the serial decision tail (Decision Scientist → Scenario → Tradeoff →
  Recommendation → Critic) is 5+ sequential LLM calls **on top of** 3 parallel domain calls. With the ×1.3
  multiplier on the heavy reasoning calls, the top of the band reaches **~$0.06+/query**, and a verbose
  Critic + Compliance-assist can push past it.

---

## 4. Daily-budget math for a 20-user beta

**Traffic assumption (stated):** **5 turns/user/day** → **100 turns/day** across 20 users. We also show a
heavier 10 turns/user/day (200/day) sensitivity row. Tier mix assumption: **60% simple / 30% moderate /
10% complex** (discovery beta skews simple). All dollar figures carry the §1 pricing assumption.

### 4.1 Blended cost at 100 turns/day (5/user)

| Tier        | Share | Turns/day | $/turn (mid) |          $/day |
| ----------- | ----: | --------: | -----------: | -------------: |
| Simple      |   60% |        60 |       $0.004 |          $0.24 |
| Moderate    |   30% |        30 |       $0.013 |          $0.39 |
| Complex     |   10% |        10 |       $0.040 |          $0.40 |
| **Blended** |     — |   **100** |            — | **~$1.03/day** |

At the **top of every band** (worst case): simple $0.006, moderate $0.020, complex $0.060 →
60×0.006 + 30×0.020 + 10×0.060 = **~$1.56/day**.

### 4.2 Heavier traffic / heavier mix (sensitivity)

- **200 turns/day (10/user), same mix:** ~**$2.06/day** mid, ~**$3.12/day** worst-case.
- **200 turns/day, complex-heavy mix (40/30/30):** 80×0.004 + 60×0.013 + 60×0.040 = **~$3.50/day** mid,
  and at band-tops ~**$5.5/day** — **over the cap**.

---

## 5. The $4/day cap — where it holds and where it breaks

The real cap is **~$4/day Gemini + a prepay-credit posture** (`CURRENT_STATE_AUDIT.md` §6).

| Scenario                                                  |    Est. $/day | vs $4 cap            |
| --------------------------------------------------------- | ------------: | -------------------- |
| Today (single advisor, 100 turns)                         |        ~$0.20 | safe (5% of cap)     |
| LIOS blended, 100 turns, 60/30/10                         |     ~$1.0–1.6 | safe                 |
| LIOS blended, 200 turns, 60/30/10                         |     ~$2.1–3.1 | tight but under      |
| **200 turns, complex-heavy (40/30/30)**                   | **~$3.5–5.5** | **breaches the cap** |
| **Runaway complex** (every turn complex, 200/day @ $0.06) |  **~$12/day** | **3× over the cap**  |

**Headline finding:** at beta scale the _blended_ cost is comfortably under $4/day — but **complex queries
are ~10–30× the cost of a simple one**, so the budget is governed entirely by the **complex share**. If
complex rises toward 30%+ of traffic at 200 turns/day, the cap breaks. Complex queries are where the budget
blows, not volume per se.

---

## 6. Cost-control levers (in priority order)

1. **Critic high-stakes-only (already the design — `AGENT_SELECTION_ENGINE.md` R8).** Running the Critic on
   every turn instead of only `risk ∈ {high, regulated}`/cross-domain would add ~1 heavy call to _every_
   complex/moderate turn. Keeping it gated is the single biggest saver. **Enforce via `CRITIC_ENABLED` +
   the R8 rule.**
2. **Cheaper model for classification.** Intent classification (Phase 2) and any compliance-assist
   (Phase 9) should use **`gemini-2.5-flash-lite`** (~3–6× cheaper). Routing/classification does not need
   the flagship.
3. **Prompt trimming.** Input is ~85% of tokens. Trimming the grounding context (tighter
   `allowed_numbers`/edge selection in `advisor_context.py`) cuts input cost on **every** call linearly.
4. **Context caching.** The system prompt + stable persona/grounding is reused across a conversation's
   turns; AI Studio context caching can discount repeated input. Verify cache pricing before relying on it.
5. **Sampling, not every turn.** Observe-only phases (intent/route logging) can sample (e.g. 1-in-N turns)
   rather than classify every turn — `ORCHESTRATOR_IMPLEMENTATION_PLAN.md` Phase 2 already notes this.
6. **Skip the decision pipeline when not a decision.** R6 already gates the 5-call serial tail to
   `intent = decision` / ≥2-domain conflict. Mis-classifying simple as decision is a cost bug — measure
   classifier precision.
7. **Hard per-turn + per-day ceiling.** Keep `cost_meter.py` enforcing a turn ceiling and a daily cap so a
   runaway complex turn cannot blow the budget unobserved.

---

## 7. LIVE vs PLANNED

- **LIVE:** the single-call baseline (~3,110 tokens, ~$0.002/turn), token telemetry
  (`prompt_tokens/completion_tokens/total_tokens` in `analytics.advisor_turns`), the ~$4/day cap, and
  `cost_meter.py` enforcement.
- **PLANNED:** every multi-agent tier (simple multi-call, moderate, complex), per-tier cost rollups, the
  Critic call (Critic not built), Flash-Lite classification, and dollar-per-turn logging
  (`OBSERVABILITY_RUNTIME.md` marks `$` as PLANNED; today only tokens are logged).

## 8. Honesty note

Every per-tier number is a **projection**, not a measurement. The only measured quantity is the live single
turn. Before any phase that adds LLM calls ships, re-derive these from real `advisor_turn_metrics`
(tokens by tier) and re-confirm AI Studio pricing — the input/output split (§1.1) and the complex-share
(§5) are the two assumptions that move the answer most.

---

### Sources (pricing — re-confirm before spend)

- Gemini 2.5 Flash API pricing (~$0.30/$2.50 per 1M): https://devtk.ai/en/models/gemini-2-5-flash/ ,
  https://aicostcheck.com/blog/google-gemini-pricing-guide-2026
- Google AI Studio pricing / Flash-Lite tier: https://www.nocode.mba/articles/google-ai-studio-pricing ,
  https://www.opslyft.com/blog/google-gemini-api-pricing-2026
