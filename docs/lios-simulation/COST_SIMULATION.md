# LIOS Cost Simulation

> **Phase 5 — simulation/evaluation only. No code, no orchestration, no deploy, no Vertex, no Claude, no
> beta change. Do not modify other files.** This models tokens, $/query, and daily-budget impact across
> query tiers, user scales, and architecture variants — to find the **economic infeasibility frontier** vs
> the **$4/day Gemini cap** and a realistic monthly budget.
>
> **Honesty up front:** every per-tier number is a **projection from ONE measured advisor turn**
> (`LIOS_SIMULATION_FRAMEWORK.md` §1). The only hard datum is the live single call. Everything else is
> LLM-call arithmetic on top of that datum. Figures are **ranges, not precise quotes.** Builds on
> `docs/lios-runtime-blueprint/COST_MODEL.md` (per-tier $) and `AGENT_SELECTION_ENGINE.md` (agent counts).

---

## 1. Grounding facts (verbatim — used everywhere below)

| Fact                                             | Value                                                         | Assumption stated                                                |
| ------------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| One LLM call                                     | **≈ 3,110 tokens** (max ~3,800)                               | the simulation unit                                              |
| Input/output split                               | **~85% input / ~15% output**                                  | ≈ 2,650 in + 460 out; **load-bearing** — re-measure before spend |
| Per-call $                                       | **~$0.002–0.003**                                             | AI Studio `gemini-2.5-flash`, **NOT Vertex**                     |
| AI Studio pricing (assumed, published, mid-2026) | **~$0.30 / 1M input · ~$2.50 / 1M output**                    | from `COST_MODEL.md` §1 — re-confirm at run time, not a quote    |
| Flash-Lite (classification lever)                | **~$0.10 / 1M in · ~$0.40 / 1M out**                          | ~3–6× cheaper; used for intent only                              |
| Heavy-reasoning context multiplier               | **×1.3** on Decision Scientist / Scenario / Tradeoff / Critic | larger context per `COST_MODEL.md` §3                            |
| Budget cap                                       | **~$4/day** Gemini + prepay-credit posture                    | AI Studio cap, ops                                               |

**Unit derivation (live):** input 2,650 × $0.30/1M = $0.00080; output 460 × $2.50/1M = $0.00115; total
**≈ $0.0019–0.0020/call**. If the split is 70/30 instead of 85/15 the call rises to ~$0.0029. **Planning
band: $0.002–0.003 per LLM call.**

---

## 2. LLM-calls per tier, per variant (the cost driver)

Cost ≈ (LLM-call count) × ~$0.002–0.003, with ×1.3 on heavy reasoning calls. Deterministic agents (Tool
Execution, GraphRAG retrieval, Compliance gate, Audit, per-domain summary services under H3) are **~free**.

| Tier                              | **Current advisor**           | **LIOS-minimal** (H1–H5 applied)                                  | **LIOS-full** (as-designed) |
| --------------------------------- | ----------------------------- | ----------------------------------------------------------------- | --------------------------- |
| SIMPLE ("net worth?")             | 1 call                        | 1 call (+ sampled Flash-Lite intent ≈ free)                       | 1–2 calls                   |
| MODERATE ("afford this house?")   | 1 call                        | 2 calls (domains det → 1 reasoning + Decision Engine collapsed)   | 3–5 calls                   |
| COMPLEX ("move + new job + buy?") | 1 call (single governed turn) | 2–3 calls (domains det; decision tail 4→1; Critic if high-stakes) | 6–10+ calls                 |

> **Why LIOS-minimal collapses:** H2 folds the 4-call decision tail (Scientist→Scenario→Tradeoff→
> Explanation) into **1** LLM call + deterministic tool calls; H3 keeps domains deterministic (the live
> summary services) feeding **one** reasoning call instead of +1 LLM call per domain; H4 gates the Critic to
> high-stakes only; H1 merges discovery agents; H5 defers compliance-LLM. Net: complex ≈ 2–3 calls.

### 2.1 $/query per tier (mid-band and band-top)

| Tier     | Variant      | LLM calls             | Mid $/query | Band-top $/query |
| -------- | ------------ | --------------------- | ----------- | ---------------- |
| SIMPLE   | Current      | 1                     | $0.0020     | $0.003           |
| SIMPLE   | LIOS-minimal | 1 (+~free intent)     | $0.0021     | $0.0035          |
| SIMPLE   | LIOS-full    | 1–2                   | $0.004      | $0.006           |
| MODERATE | Current      | 1                     | $0.0020     | $0.003           |
| MODERATE | LIOS-minimal | 2 (1 heavy ×1.3)      | $0.0046     | $0.0075          |
| MODERATE | LIOS-full    | 3–5                   | $0.013      | $0.020           |
| COMPLEX  | Current      | 1                     | $0.0020     | $0.003           |
| COMPLEX  | LIOS-minimal | 2–3 (1–2 heavy ×1.3)  | $0.0075     | $0.013           |
| COMPLEX  | LIOS-full    | 6–10+ (≥3 heavy ×1.3) | $0.040      | $0.060+          |

**Headline ratios:** a LIOS-full COMPLEX query is **~20–30× a simple query** and **~3–5× a LIOS-minimal
complex query**. The merge hypotheses cut complex cost ~3–4× — the framework's H1–H3 claim, made concrete.

---

## 3. Query-mix and traffic assumptions (stated)

- **Turns/user/day: 5** (the COST_MODEL beta assumption). A heavier **10/user/day** is shown as sensitivity.
- **Base mix (discovery-skewed, realistic for this product): 70% simple / 25% moderate / 5% complex.**
- **Complex-heavy stress mix: 40% simple / 30% moderate / 30% complex** (worst realistic mix).
- All $ carry the §1 pricing assumption. Mid-band $/query from §2.1.

### 3.1 Blended $/turn by variant and mix (mid-band)

Blended $/turn = Σ (share × tier $/query).

| Variant         | Base mix (70/25/5)                                    | Stress mix (40/30/30)                                 |
| --------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| Current advisor | 0.70·0.002 + 0.25·0.002 + 0.05·0.002 = **$0.0020**    | **$0.0020** (single call regardless of tier)          |
| LIOS-minimal    | 0.70·0.0021 + 0.25·0.0046 + 0.05·0.0075 = **$0.0030** | 0.40·0.0021 + 0.30·0.0046 + 0.30·0.0075 = **$0.0045** |
| LIOS-full       | 0.70·0.004 + 0.25·0.013 + 0.05·0.040 = **$0.0080**    | 0.40·0.004 + 0.30·0.013 + 0.30·0.040 = **$0.0175**    |

> Current advisor is mix-insensitive because every turn is one call today (it does not run a decision tail).
> LIOS-full is the only variant whose blended cost swings hard with the complex share — confirming
> COST_MODEL §5: **the budget is governed by the complex share, not by volume.**

---

## 4. Daily $ by user scale × variant (the core table)

Turns/day = users × 5. Daily $ = turns/day × blended $/turn (§3.1). **Base mix.**

|  Users | Turns/day | **Current** ($0.0020/turn) | **LIOS-minimal** ($0.0030/turn) | **LIOS-full** ($0.0080/turn) |
| -----: | --------: | -------------------------: | ------------------------------: | ---------------------------: |
|     20 |       100 |                      $0.20 |                           $0.30 |                        $0.80 |
|    100 |       500 |                      $1.00 |                           $1.50 |               $4.00 ⚠ at cap |
|  1,000 |     5,000 |                     $10.00 |                          $15.00 |                       $40.00 |
| 10,000 |    50,000 |                    $100.00 |                         $150.00 |                      $400.00 |

### 4.1 Same table, **stress mix (40/30/30)**

|  Users | Turns/day | **Current** ($0.0020) | **LIOS-minimal** ($0.0045) | **LIOS-full** ($0.0175) |
| -----: | --------: | --------------------: | -------------------------: | ----------------------: |
|     20 |       100 |                 $0.20 |                      $0.45 |                   $1.75 |
|    100 |       500 |                 $1.00 |                      $2.25 |        $8.75 ✗ over cap |
|  1,000 |     5,000 |                $10.00 |                     $22.50 |                  $87.50 |
| 10,000 |    50,000 |               $100.00 |                    $225.00 |                 $875.00 |

### 4.2 Sensitivity: 10 turns/user/day (double traffic) — base mix

| Users | Turns/day | Current | LIOS-minimal |        LIOS-full |
| ----: | --------: | ------: | -----------: | ---------------: |
|    20 |       200 |   $0.40 |        $0.60 |            $1.60 |
|   100 |     1,000 |   $2.00 |        $3.00 | $8.00 ✗ over cap |
| 1,000 |    10,000 |  $20.00 |       $30.00 |           $80.00 |

---

## 5. The infeasibility frontier (vs the $4/day cap)

The **$4/day cap** is the hard wall. "Feasible" = blended daily $ ≤ $4. Solving turns/day = $4 / blended$/turn:

| Variant         | Mix             | Max turns/day under $4 | Max users (@5 turns/day) | Max users (@10 turns/day) |
| --------------- | --------------- | ---------------------: | -----------------------: | ------------------------: |
| Current advisor | any             |                 ~2,000 |                 **~400** |                      ~200 |
| LIOS-minimal    | base 70/25/5    |                 ~1,333 |                 **~267** |                      ~133 |
| LIOS-minimal    | stress 40/30/30 |                   ~889 |                 **~178** |                       ~89 |
| LIOS-full       | base 70/25/5    |                   ~500 |                 **~100** |                       ~50 |
| LIOS-full       | stress 40/30/30 |                   ~229 |                  **~46** |                       ~23 |

**The frontier, stated plainly:**

- **Current advisor:** safe to **~400 users** at 5 turns/day before the $4/day cap bites. Mix-immune.
- **LIOS-minimal:** safe to **~267 users** (base) / **~178** (stress). The merge hypotheses keep it within
  ~1.5× of the current advisor's ceiling — affordable.
- **LIOS-full:** breaches $4/day at just **~100 users** (base) and **~46 users** (stress). **At the 20-user
  beta it is fine ($0.80–1.75/day); the moment the product scales past ~100 users with any real complex
  share, LIOS-full is economically infeasible under the current cap.**

> The cap is not a volume problem — it is a **complex-share × LLM-call-count** problem. LIOS-full's 6–10
> serial calls per complex query are what move the wall from ~400 users to ~46–100.

---

## 6. Realistic monthly budget view (the cap is a posture, not a law)

The $4/day cap is an ops guardrail, not a billing ceiling — at scale the real question is monthly spend.
Monthly $ = daily $ × 30. **Base mix, 5 turns/user/day.**

|  Users | Current /mo | LIOS-minimal /mo | LIOS-full /mo |
| -----: | ----------: | ---------------: | ------------: |
|    100 |         $30 |              $45 |          $120 |
|  1,000 |        $300 |             $450 |        $1,200 |
| 10,000 |      $3,000 |           $4,500 |       $12,000 |

**Reading it:**

- At **1,000 users**, LIOS-full is **$1,200/mo** vs LIOS-minimal **$450/mo** — the fan-out costs ~$750/mo
  extra for the **unproven** part of the design (per-domain LLM agents + the 4-call tail).
- At **10,000 users**, LIOS-full reaches **$12,000/mo ($144k/yr)** — material; LIOS-minimal is **$4,500/mo**.
- If a realistic LLM budget is, say, ~$1,000/mo, LIOS-full crosses it near **~850 users** (base) and
  **~400 users** (stress); LIOS-minimal not until **~2,200 users** (base); current advisor **~3,300 users**.

---

## 7. Per-query cost-control levers (which move the frontier most)

In priority order (from `COST_MODEL.md` §6, re-ranked by frontier impact):

1. **Apply H2 (collapse the 4-call decision tail → 1).** Single largest cost cut for complex — turns
   LIOS-full into LIOS-minimal economics. Moves the complex $/query from ~$0.040 to ~$0.0075.
2. **Apply H3 (domains deterministic).** Removes +1 LLM call per domain; a 3-domain complex query drops
   ~3 calls. This is what keeps LIOS-minimal complex at 2–3 calls.
3. **Critic high-stakes-only (H4).** Drops ~1 heavy ×1.3 call off every non-high-stakes complex/moderate.
4. **Flash-Lite + sampled intent classification.** ~free routing; do not classify every turn.
5. **Prompt trimming** (input is ~85% of tokens) — cuts every call linearly.
6. **Context caching** across a conversation's turns — discount repeated grounding input (verify cache price).
7. **Hard per-turn + per-day ceiling** (`cost_meter.py`) so one runaway complex turn cannot blow the cap.

---

## 8. Findings

- **At beta scale (20 users) every variant is affordable** — even LIOS-full is $0.80–1.75/day, well under $4.
  The cost question is **not** a beta blocker; it is a **scale** decision.
- **The infeasibility frontier is the headline:** Current ~400 users · LIOS-minimal ~178–267 users ·
  **LIOS-full ~46–100 users** before $4/day breaks. LIOS-full is ~4–8× less scalable than the alternatives.
- **The merge hypotheses pay for themselves in dollars:** H1–H3 cut complex $/query ~3–5× and push the
  LIOS feasibility ceiling from ~46–100 users back up toward ~178–267 — within ~1.5× of today's advisor.
- **The cost lives exactly where the value is unproven** (per-domain LLM fan-out + the 4-call tail), matching
  the framework's central tension (§3 of `LIOS_SIMULATION_FRAMEWORK.md`).

## 9. Honesty note

Every per-tier figure is a **projection from one measured turn** at an **assumed 85/15 split** and **assumed
AI Studio pricing** (not a quote). The two assumptions that move the answer most are the **input/output
split** (§1) and the **complex share** (§3). Before any phase that adds LLM calls ships, re-derive from real
`analytics.advisor_turns.prompt_tokens/completion_tokens` by tier and re-confirm AI Studio pricing. Ranges,
not false precision.
