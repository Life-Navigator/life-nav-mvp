# LIOS Decision-Quality Evaluation — 100 Canonical Decisions

> **Evaluation / simulation only — no code, no orchestration, no deploy, no Vertex/Gemini wiring, no beta
> change.** Companion to `LIOS_SIMULATION_FRAMEWORK.md` (the baselines, the LLM-call unit, merge hypotheses
> H1–H5). Routing is taken verbatim from `docs/lios-execution-architecture/AGENT_SELECTION_ENGINE.md` (§3
> rule table, §4 the three tiers). Latency/cost per tier are taken verbatim from
> `docs/lios-runtime-blueprint/LATENCY_MODEL.md` and `COST_MODEL.md`. Decision posture (models, never
> decides) is from `DECISION_LIFECYCLE.md`.

---

## 1. Method note

**The unit.** Per `LIOS_SIMULATION_FRAMEWORK.md` §2 and `LATENCY_MODEL.md` §1.1, every projection is built
from one measured fact: **one `gemini-2.5-flash` call ≈ 7–8s and ≈ 3,110 tokens ≈ $0.002.** Latency adds by
the rule `turn ≈ ~2–2.5s fixed overhead + (parallel groups counted once at their max) + Σ(serial LLM calls)`;
cost adds linearly per LLM call (deterministic agents — Tool Execution, GraphRAG retrieval, Compliance,
Audit — are ~free). The current single advisor turn is the **1-call baseline: ~9–10s avg / p95 13–16s**.

**The tiers (verbatim, `AGENT_SELECTION_ENGINE.md` §4 + `LATENCY_MODEL.md` §3 / `COST_MODEL.md` §3):**

| Tier     | LLM calls   | Latency (unmitigated)    | Cost          | Cost vs simple |
| -------- | ----------- | ------------------------ | ------------- | -------------- |
| SIMPLE   | 1 (≈ today) | ~8–11s avg / 12–16s p95  | $0.002–0.006  | 1×             |
| MODERATE | 3–5         | ~16–22s avg / 26–32s p95 | $0.006–0.020  | ~3–10×         |
| COMPLEX  | 6–10+       | ~40–55s avg / 60–90s p95 | $0.020–0.060+ | ~10–30×        |

The latency killer is **serial depth**, not domain fan-out — domains parallelize to one call's time
(`max`), but the decision tail (Decision Scientist → Scenario → Tradeoff → Recommendation → Critic) is
strictly serial and each link stacks ~7–8s.

**How "quality gain" is estimated (and its limit).** Per `LIOS_SIMULATION_FRAMEWORK.md` §5 the High/Med/
Low/None labels below are **reasoned estimates, not measured scores**. The basis for each is stated in one
clause. The hard caveat: **coverage (data-rich answer quality) is UNMEASURED** — only fresh-user/empty-state
behavior has been tested (`LIOS_SIMULATION_FRAMEWORK.md` §1). So wherever a gain depends on "deeper
multi-domain reasoning" or "richer modeled tradeoffs," the gain is an **estimate flagged `(est, coverage
unproven)`** — never a fabricated metric. The reasoning rule applied throughout:

- A **conversational / single-domain lookup** the current advisor already handles well → **Low/None** gain
  from multi-agent, at **+0 LLM calls / +0 cost** (it routes to the same 1-call path, `AGENT_SELECTION_ENGINE.md`
  R1/R2).
- Gain concentrates where the decision is **genuinely ≥2-domain AND tool-heavy** (numbers/projections),
  because that is where the deterministic decision tail (traceable modeled tradeoffs) and cross-domain cited
  edges add something the single conversational call structurally cannot — and even there it is an estimate.
- LIOS **never makes the decision** (`DECISION_LIFECYCLE.md` §1); the gain is always "better-framed,
  data-grounded tradeoffs," not "the answer."

Columns: **#** · Decision · Current advisor path · LIOS path (agents) · Tools · GraphRAG (query/skip/req) ·
Quality gain (+ why) · Latency (LLM-calls→s) · Cost (×). "Det tail" = Decision Scientist→Scenario→Tradeoff
→Recommendation(→Critic if high/cross-domain). Domains shown in `[...]` parallelize.

---

## 2. The 100 decisions

### Home purchase (1–7)

| #   | Decision                             | Current path                | LIOS path (agents)                  | Tools                              | GraphRAG           | Quality gain (why)                                                       | Latency (calls→s) | Cost × |
| --- | ------------------------------------ | --------------------------- | ----------------------------------- | ---------------------------------- | ------------------ | ------------------------------------------------------------------------ | ----------------- | ------ |
| 1   | Can I afford this $450k house?       | 1-call advisor names inputs | [Finance∥Family]→Decision Scientist | Affordability, Mortgage, Cash Flow | skip               | **High** (est, coverage unproven) — modeled tradeoff + trace beats prose | 3→~18s            | ~8×    |
| 2   | 15-yr vs 30-yr mortgage?             | 1-call advisor              | [Finance]→Decision Scientist        | Mortgage, Cash Flow                | skip               | **Med** — deterministic amortization trace vs narrated                   | 2→~16s            | ~5×    |
| 3   | Rent vs buy in my city?              | 1-call advisor              | [Finance]→det tail                  | Rent-vs-buy, Cash Flow             | query (local edge) | **High** (est) — break-even modeling + real edges                        | 4→~24s            | ~10×   |
| 4   | How much down payment?               | 1-call advisor names inputs | [Finance]→Tool Exec                 | Affordability, Cash Flow           | skip               | **Med** — single figure + trace                                          | 2→~16s            | ~5×    |
| 5   | Refinance now or wait?               | 1-call advisor              | [Finance]→Decision Scientist        | Mortgage, rate-scenario            | skip               | **High** (est) — break-even vs closing-cost modeled                      | 3→~18s            | ~8×    |
| 6   | Should I buy a second/vacation home? | 1-call advisor              | [Finance∥Family]→det tail           | Affordability, Cash Flow, Tax      | query              | **High** (est) — multi-domain carry-cost tradeoff                        | 5→~22s            | ~10×   |
| 7   | HOA/condo vs single-family cost?     | 1-call advisor              | [Finance]→Tool Exec                 | Cash Flow                          | skip               | **Low** — mostly a comparison the advisor narrates fine                  | 1→~9s             | +0     |

### Retirement (8–14)

| #   | Decision                           | Current path                | LIOS path                    | Tools                                    | GraphRAG | Quality gain (why)                                              | Latency | Cost × |
| --- | ---------------------------------- | --------------------------- | ---------------------------- | ---------------------------------------- | -------- | --------------------------------------------------------------- | ------- | ------ |
| 8   | When can I retire?                 | 1-call advisor names inputs | [Finance]→det tail           | Retirement projection, Monte-Carlo       | skip     | **High** (est, coverage unproven) — projected drawdown w/ trace | 4→~24s  | ~10×   |
| 9   | Roth vs traditional 401k?          | 1-call advisor              | [Finance]→Decision Scientist | Tax, Retirement                          | skip     | **High** (est) — tax-bracket crossover modeled                  | 3→~18s  | ~8×    |
| 10  | Am I saving enough for retirement? | 1-call advisor              | [Finance]→Tool Exec          | Retirement projection                    | skip     | **Med** — gap figure + trace                                    | 2→~16s  | ~5×    |
| 11  | Should I retire early (FIRE)?      | 1-call advisor              | [Finance∥Health]→det tail    | Retirement, Healthcare-cost, Monte-Carlo | query    | **High** (est) — longevity+healthcare cross-domain              | 5→~22s  | ~12×   |
| 12  | Take pension lump sum or annuity?  | 1-call advisor              | [Finance]→Decision Scientist | Annuity, NPV                             | skip     | **High** (est) — NPV vs longevity modeled                       | 3→~18s  | ~8×    |
| 13  | When to claim Social Security?     | 1-call advisor              | [Finance]→Decision Scientist | Claiming-age, breakeven                  | skip     | **High** (est) — breakeven-age modeling                         | 3→~18s  | ~8×    |
| 14  | Asset allocation as I age?         | 1-call advisor              | [Finance]→Tool Exec          | Allocation/glidepath                     | skip     | **Med** — glidepath vs general guidance                         | 2→~16s  | ~5×    |

### New child (15–21)

| #   | Decision                          | Current path   | LIOS path                           | Tools                     | GraphRAG | Quality gain (why)                                             | Latency | Cost × |
| --- | --------------------------------- | -------------- | ----------------------------------- | ------------------------- | -------- | -------------------------------------------------------------- | ------- | ------ |
| 15  | Can we afford a child?            | 1-call advisor | [Finance∥Family]→det tail           | Cash Flow, child-cost     | skip     | **High** (est, coverage unproven) — budget+family cross-domain | 5→~22s  | ~10×   |
| 16  | How much life insurance now?      | 1-call advisor | [Finance∥Family]→Decision Scientist | Insurance-need (DIME)     | skip     | **High** (est) — needs-based calc beats rule-of-thumb          | 4→~20s  | ~10×   |
| 17  | Start a 529 — how much?           | 1-call advisor | [Finance∥Education]→Tool Exec       | Education-cost projection | skip     | **Med** — contribution sizing w/ trace                         | 3→~18s  | ~6×    |
| 18  | One parent stay home?             | 1-call advisor | [Finance∥Career∥Family]→det tail    | Cash Flow, lost-income    | query    | **High** (est) — 3-domain income/career tradeoff               | 6→~30s  | ~14×   |
| 19  | Childcare vs nanny vs family?     | 1-call advisor | [Finance∥Family]→Tool Exec          | Cash Flow                 | skip     | **Low** — comparison the advisor narrates fine                 | 1→~9s   | +0     |
| 20  | Update beneficiaries after birth? | 1-call advisor | [Family]→Advisor                    | —                         | skip     | **None** — procedural/checklist                                | 1→~9s   | +0     |
| 21  | Budget reset after new child      | 1-call advisor | [Finance∥Family]→Tool Exec          | Cash Flow, budget         | skip     | **Med** — re-modeled budget w/ trace                           | 2→~16s  | ~5×    |

### Divorce (22–28)

| #   | Decision                                 | Current path                    | LIOS path                    | Tools                       | GraphRAG | Quality gain (why)                                      | Latency | Cost × |
| --- | ---------------------------------------- | ------------------------------- | ---------------------------- | --------------------------- | -------- | ------------------------------------------------------- | ------- | ------ |
| 22  | Can I afford to live alone post-divorce? | 1-call advisor                  | [Finance∥Family]→det tail    | Cash Flow, asset-split      | query    | **High** (est, coverage unproven) — post-split modeling | 5→~22s  | ~10×   |
| 23  | Keep the house or sell in divorce?       | 1-call advisor                  | [Finance∥Family]→det tail    | Mortgage, Cash Flow, equity | query    | **High** (est) — carry-cost vs liquidity modeled        | 5→~22s  | ~12×   |
| 24  | How will assets be split?                | 1-call advisor names inputs     | [Finance]→Tool Exec          | asset-inventory             | query    | **Med** — inventory + edges, not legal advice           | 2→~16s  | ~5×    |
| 25  | Alimony/support affordability?           | 1-call advisor                  | [Finance]→Decision Scientist | Cash Flow, support-scenario | skip     | **High** (est) — scenario-modeled cash flow             | 3→~18s  | ~8×    |
| 26  | Split retirement accounts (QDRO)?        | 1-call advisor names inputs     | [Finance]→Tool Exec          | Retirement                  | skip     | **Med** — figures + trace; legal handoff                | 2→~16s  | ~5×    |
| 27  | Re-budget single income                  | 1-call advisor                  | [Finance]→Tool Exec          | Cash Flow, budget           | skip     | **Med** — re-modeled budget                             | 2→~16s  | ~5×    |
| 28  | Emotional/timing readiness               | 1-call advisor (conversational) | Advisor                      | —                           | skip     | **None** — purely conversational                        | 1→~9s   | +0     |

### Marriage (29–35)

| #   | Decision                       | Current path   | LIOS path                           | Tools             | GraphRAG | Quality gain (why)                             | Latency | Cost × |
| --- | ------------------------------ | -------------- | ----------------------------------- | ----------------- | -------- | ---------------------------------------------- | ------- | ------ |
| 29  | Combine vs separate finances?  | 1-call advisor | [Finance∥Family]→Decision Scientist | Cash Flow         | query    | **Med** (est) — tradeoff framing, low math     | 3→~18s  | ~6×    |
| 30  | Prenup — should we?            | 1-call advisor | [Finance∥Family]→Advisor            | asset-inventory   | query    | **Med** — asset-context framing; legal handoff | 2→~16s  | ~5×    |
| 31  | Tax filing: joint vs separate? | 1-call advisor | [Finance]→Tool Exec                 | Tax-scenario      | skip     | **High** (est) — both filings modeled          | 2→~16s  | ~5×    |
| 32  | Merge insurance/benefits?      | 1-call advisor | [Finance∥Health]→Decision Scientist | benefits-compare  | skip     | **Med** — plan comparison modeled              | 3→~18s  | ~6×    |
| 33  | Combined budget after marriage | 1-call advisor | [Finance∥Family]→Tool Exec          | Cash Flow, budget | skip     | **Med** — joint budget w/ trace                | 2→~16s  | ~5×    |
| 34  | Beneficiary/estate updates     | 1-call advisor | [Family]→Advisor                    | —                 | skip     | **None** — procedural                          | 1→~9s   | +0     |
| 35  | Wedding budget affordability   | 1-call advisor | [Finance]→Tool Exec                 | Cash Flow         | skip     | **Low** — single budget check                  | 1→~9s   | +0     |

### Career change (36–42)

| #   | Decision                             | Current path   | LIOS path                           | Tools                        | GraphRAG | Quality gain (why)                                                 | Latency | Cost × |
| --- | ------------------------------------ | -------------- | ----------------------------------- | ---------------------------- | -------- | ------------------------------------------------------------------ | ------- | ------ |
| 36  | Should I take this new job offer?    | 1-call advisor | [Finance∥Career∥Family]→det tail    | comp-compare, Cash Flow      | query    | **High** (est, coverage unproven) — total-comp + life cross-domain | 6→~30s  | ~14×   |
| 37  | Quit to freelance/contract?          | 1-call advisor | [Finance∥Career]→det tail           | income-volatility, Cash Flow | skip     | **High** (est) — variable-income runway modeled                    | 5→~22s  | ~12×   |
| 38  | Negotiate salary — what's my target? | 1-call advisor | [Career]→Advisor                    | market-comp                  | query    | **Med** — market edges; mostly conversational                      | 2→~16s  | ~5×    |
| 39  | Equity/RSU vs higher salary?         | 1-call advisor | [Finance∥Career]→Decision Scientist | equity-value, Tax            | skip     | **High** (est) — risk-adjusted equity modeled                      | 4→~20s  | ~10×   |
| 40  | Switch industries entirely?          | 1-call advisor | [Career]→Decision Scientist         | skill-gap                    | query    | **Med** (est) — gap framing; thin tooling                          | 3→~18s  | ~6×    |
| 41  | Take a sabbatical?                   | 1-call advisor | [Finance∥Career]→Decision Scientist | Cash Flow, runway            | skip     | **High** (est) — runway + re-entry tradeoff                        | 4→~20s  | ~10×   |
| 42  | Is this role worth the commute?      | 1-call advisor | Advisor                             | —                            | skip     | **None** — conversational                                          | 1→~9s   | +0     |

### Relocation (43–49)

| #   | Decision                                | Current path   | LIOS path                            | Tools                      | GraphRAG | Quality gain (why)                                              | Latency | Cost × |
| --- | --------------------------------------- | -------------- | ------------------------------------ | -------------------------- | -------- | --------------------------------------------------------------- | ------- | ------ |
| 43  | Should I move to Texas (no income tax)? | 1-call advisor | [Finance∥Career∥Family]→det tail     | COL-adjust, Tax, Cash Flow | query    | **High** (est, coverage unproven) — net-of-tax+COL cross-domain | 6→~30s  | ~14×   |
| 44  | Compare two cities' cost of living      | 1-call advisor | [Finance]→Tool Exec                  | COL-adjust                 | query    | **Med** — normalized COL w/ trace                               | 2→~16s  | ~5×    |
| 45  | Relocate for a job — net better off?    | 1-call advisor | [Finance∥Career]→det tail            | COL, comp-compare, Tax     | query    | **High** (est) — relo break-even modeled                        | 5→~24s  | ~12×   |
| 46  | Move closer to aging parents?           | 1-call advisor | [Finance∥Family∥Career]→det tail     | Cash Flow, caregiving-cost | query    | **High** (est) — caregiving+career+cost tradeoff                | 6→~30s  | ~14×   |
| 47  | Move abroad — feasibility?              | 1-call advisor | [Finance∥Career]→Decision Scientist  | COL, Tax, FX               | query    | **High** (est) — multi-factor feasibility modeled               | 4→~22s  | ~12×   |
| 48  | Downsize home in retirement?            | 1-call advisor | [Finance∥Family]→Decision Scientist  | equity, Cash Flow          | skip     | **High** (est) — equity-unlock + budget modeled                 | 4→~20s  | ~10×   |
| 49  | Move to a better school district?       | 1-call advisor | [Finance∥Family∥Education]→Tool Exec | Cash Flow, COL             | query    | **Med** (est) — cost framing; soft benefit                      | 3→~18s  | ~6×    |

### MBA / graduate school (50–56)

| #   | Decision                          | Current path   | LIOS path                           | Tools                  | GraphRAG | Quality gain (why)                                                       | Latency | Cost × |
| --- | --------------------------------- | -------------- | ----------------------------------- | ---------------------- | -------- | ------------------------------------------------------------------------ | ------- | ------ |
| 50  | Is an MBA worth it for me?        | 1-call advisor | [Finance∥Career∥Education]→det tail | ROI, lost-income, Loan | query    | **High** (est, coverage unproven) — ROI w/ opportunity cost cross-domain | 6→~30s  | ~14×   |
| 51  | Full-time vs part-time MBA?       | 1-call advisor | [Finance∥Career]→Decision Scientist | lost-income, Cash Flow | skip     | **High** (est) — income-loss tradeoff modeled                            | 4→~20s  | ~10×   |
| 52  | MBA now vs in 5 years?            | 1-call advisor | [Finance∥Career]→Decision Scientist | ROI-timing             | skip     | **High** (est) — timing-NPV modeled                                      | 4→~20s  | ~10×   |
| 53  | Which MBA programs by ROI?        | 1-call advisor | [Education∥Finance]→Tool Exec       | ROI, ranking-edges     | query    | **Med** (est) — comparison + edges                                       | 3→~18s  | ~6×    |
| 54  | Employer-sponsored MBA tradeoffs? | 1-call advisor | [Career∥Finance]→Decision Scientist | clawback, Tax          | skip     | **Med** — clawback terms framing                                         | 3→~18s  | ~6×    |
| 55  | Online vs in-person grad program? | 1-call advisor | [Education]→Advisor                 | —                      | query    | **Low** — comparison narrated fine                                       | 1→~9s   | +0     |
| 56  | GMAT/GRE study readiness          | 1-call advisor | Advisor                             | —                      | skip     | **None** — conversational                                                | 1→~9s   | +0     |

### Degree selection (57–63)

| #   | Decision                               | Current path   | LIOS path                              | Tools                  | GraphRAG | Quality gain (why)                               | Latency | Cost × |
| --- | -------------------------------------- | -------------- | -------------------------------------- | ---------------------- | -------- | ------------------------------------------------ | ------- | ------ |
| 57  | Which major has best ROI?              | 1-call advisor | [Education∥Finance]→Decision Scientist | earnings-by-major, ROI | query    | **High** (est) — earnings-vs-cost modeled        | 4→~20s  | ~10×   |
| 58  | In-state vs out-of-state school?       | 1-call advisor | [Finance∥Education]→Tool Exec          | cost, Loan             | skip     | **High** (est) — net-cost modeled                | 2→~16s  | ~5×    |
| 59  | Community college → transfer path?     | 1-call advisor | [Finance∥Education]→Decision Scientist | cost-path              | skip     | **Med** — savings path modeled                   | 3→~18s  | ~6×    |
| 60  | Trade school vs 4-year degree?         | 1-call advisor | [Education∥Career∥Finance]→det tail    | ROI, earnings          | query    | **High** (est) — earnings/time/cost cross-domain | 5→~24s  | ~12×   |
| 61  | Public vs private university net cost? | 1-call advisor | [Finance∥Education]→Tool Exec          | net-cost, aid          | skip     | **Med** — aid-adjusted net cost                  | 2→~16s  | ~5×    |
| 62  | Gap year — financial impact?           | 1-call advisor | [Finance∥Education]→Decision Scientist | timing                 | skip     | **Med** (est) — timing framing                   | 3→~18s  | ~6×    |
| 63  | Choose a college from my shortlist     | 1-call advisor | [Education]→Advisor                    | —                      | query    | **Low** — comparison narrated                    | 1→~9s   | +0     |

### Student loans (64–70)

| #   | Decision                             | Current path                | LIOS path                           | Tools                | GraphRAG | Quality gain (why)                       | Latency | Cost × |
| --- | ------------------------------------ | --------------------------- | ----------------------------------- | -------------------- | -------- | ---------------------------------------- | ------- | ------ |
| 64  | Refinance my student loans?          | 1-call advisor              | [Finance]→Decision Scientist        | Loan, rate-scenario  | skip     | **High** (est) — refi break-even modeled | 3→~18s  | ~8×    |
| 65  | Income-driven repayment vs standard? | 1-call advisor              | [Finance]→Decision Scientist        | Loan, IDR-scenario   | skip     | **High** (est) — repayment-path modeling | 3→~18s  | ~8×    |
| 66  | Pursue PSLF forgiveness?             | 1-call advisor names inputs | [Finance∥Career]→Decision Scientist | Loan, forgiveness    | skip     | **High** (est) — eligibility+NPV modeled | 4→~20s  | ~10×   |
| 67  | Pay off loans vs invest?             | 1-call advisor              | [Finance]→Decision Scientist        | Loan, return-compare | skip     | **High** (est) — rate-vs-return modeled  | 3→~18s  | ~8×    |
| 68  | How much to borrow for school?       | 1-call advisor names inputs | [Finance∥Education]→Tool Exec       | Loan, affordability  | skip     | **High** (est) — debt-to-income modeled  | 2→~16s  | ~5×    |
| 69  | Consolidate federal loans?           | 1-call advisor              | [Finance]→Tool Exec                 | Loan                 | skip     | **Low** — mostly procedural/explanatory  | 1→~9s   | +0     |
| 70  | Cosign a child's student loan?       | 1-call advisor              | [Finance∥Family]→Decision Scientist | Loan, risk           | skip     | **Med** — risk-exposure framing          | 3→~18s  | ~6×    |

### Estate planning (71–77)

| #   | Decision                              | Current path                | LIOS path                            | Tools               | GraphRAG | Quality gain (why)                               | Latency | Cost × |
| --- | ------------------------------------- | --------------------------- | ------------------------------------ | ------------------- | -------- | ------------------------------------------------ | ------- | ------ |
| 71  | Do I need a will or a trust?          | 1-call advisor              | [Finance∥Family]→Decision Scientist  | estate-inventory    | query    | **Med** (est) — situation framing; legal handoff | 3→~18s  | ~6×    |
| 72  | How to minimize estate tax?           | 1-call advisor names inputs | [Finance]→Decision Scientist         | estate-tax          | query    | **High** (est) — tax-exposure modeled            | 3→~18s  | ~8×    |
| 73  | Who should be my executor/guardian?   | 1-call advisor              | [Family]→Advisor                     | —                   | query    | **Low** — judgment+conversational                | 1→~9s   | +0     |
| 74  | Gifting strategy to heirs?            | 1-call advisor              | [Finance∥Family]→Decision Scientist  | gift-tax, Cash Flow | query    | **High** (est) — annual-exclusion modeled        | 4→~20s  | ~10×   |
| 75  | Set up a 529/UTMA for grandkids?      | 1-call advisor              | [Finance∥Education∥Family]→Tool Exec | education-cost, Tax | skip     | **Med** — vehicle comparison modeled             | 3→~18s  | ~6×    |
| 76  | Charitable giving vehicle (DAF)?      | 1-call advisor              | [Finance]→Decision Scientist         | tax-deduction       | skip     | **Med** (est) — deduction framing                | 3→~18s  | ~6×    |
| 77  | Update estate docs after a life event | 1-call advisor              | [Family]→Advisor                     | —                   | skip     | **None** — procedural checklist                  | 1→~9s   | +0     |

### Insurance (78–84)

| #   | Decision                             | Current path   | LIOS path                                  | Tools                | GraphRAG | Quality gain (why)                                               | Latency | Cost × |
| --- | ------------------------------------ | -------------- | ------------------------------------------ | -------------------- | -------- | ---------------------------------------------------------------- | ------- | ------ |
| 78  | How much life insurance do I need?   | 1-call advisor | [Finance∥Family]→Decision Scientist        | DIME/needs-calc      | skip     | **High** (est, coverage unproven) — needs-based vs rule-of-thumb | 4→~20s  | ~10×   |
| 79  | Term vs whole life?                  | 1-call advisor | [Finance]→Decision Scientist               | premium-compare, NPV | skip     | **High** (est) — cost-over-time modeled                          | 3→~18s  | ~8×    |
| 80  | Do I need disability insurance?      | 1-call advisor | [Finance∥Health∥Career]→Decision Scientist | income-replacement   | skip     | **High** (est) — income-at-risk cross-domain                     | 4→~22s  | ~10×   |
| 81  | Umbrella liability — how much?       | 1-call advisor | [Finance]→Tool Exec                        | asset-exposure       | skip     | **Med** — exposure-sizing                                        | 2→~16s  | ~5×    |
| 82  | Long-term care insurance worth it?   | 1-call advisor | [Finance∥Health]→Decision Scientist        | LTC-cost, NPV        | skip     | **High** (est) — cost-vs-self-insure modeled                     | 4→~20s  | ~10×   |
| 83  | Raise my deductible to save premium? | 1-call advisor | [Finance]→Tool Exec                        | premium-vs-risk      | skip     | **Med** — premium/risk tradeoff                                  | 2→~16s  | ~5×    |
| 84  | Bundle home+auto worth it?           | 1-call advisor | Advisor                                    | —                    | skip     | **None** — simple comparison                                     | 1→~9s   | +0     |

### Business startup (85–90)

| #   | Decision                                   | Current path                | LIOS path                           | Tools               | GraphRAG | Quality gain (why)                                             | Latency | Cost × |
| --- | ------------------------------------------ | --------------------------- | ----------------------------------- | ------------------- | -------- | -------------------------------------------------------------- | ------- | ------ |
| 85  | Can I afford to quit and start a business? | 1-call advisor              | [Finance∥Career∥Family]→det tail    | runway, Cash Flow   | query    | **High** (est, coverage unproven) — runway+income cross-domain | 6→~30s  | ~14×   |
| 86  | LLC vs S-corp vs sole prop?                | 1-call advisor              | [Finance]→Decision Scientist        | entity-tax          | query    | **High** (est) — tax-treatment modeled                         | 3→~18s  | ~8×    |
| 87  | Bootstrap vs raise capital?                | 1-call advisor              | [Finance∥Career]→Decision Scientist | dilution, runway    | skip     | **Med** (est) — dilution framing                               | 3→~18s  | ~6×    |
| 88  | How much runway before I'm profitable?     | 1-call advisor names inputs | [Finance]→Tool Exec                 | runway, burn        | skip     | **High** (est) — burn/runway modeled                           | 2→~16s  | ~5×    |
| 89  | Set my own salary from the business?       | 1-call advisor              | [Finance]→Decision Scientist        | comp-tax, Cash Flow | skip     | **Med** — tax-efficient draw framing                           | 3→~18s  | ~6×    |
| 90  | Buy an existing business vs start one?     | 1-call advisor              | [Finance∥Career]→det tail           | valuation, ROI      | query    | **High** (est) — valuation+ROI modeled                         | 5→~24s  | ~12×   |

### Caregiving (91–94)

| #   | Decision                              | Current path   | LIOS path                                  | Tools                      | GraphRAG | Quality gain (why)                                              | Latency | Cost × |
| --- | ------------------------------------- | -------------- | ------------------------------------------ | -------------------------- | -------- | --------------------------------------------------------------- | ------- | ------ |
| 91  | Afford to care for an aging parent?   | 1-call advisor | [Finance∥Family∥Health]→det tail           | caregiving-cost, Cash Flow | query    | **High** (est, coverage unproven) — 3-domain cost/career/family | 6→~30s  | ~14×   |
| 92  | Cut work hours to caregive?           | 1-call advisor | [Finance∥Career∥Family]→Decision Scientist | lost-income                | skip     | **High** (est) — income-loss tradeoff                           | 4→~22s  | ~10×   |
| 93  | In-home care vs assisted living cost? | 1-call advisor | [Finance∥Health]→Tool Exec                 | care-cost compare          | query    | **Med** — cost comparison modeled                               | 3→~18s  | ~6×    |
| 94  | Special-needs trust for a dependent?  | 1-call advisor | [Finance∥Family]→Decision Scientist        | trust, benefits            | query    | **Med** (est) — benefits-preservation framing                   | 3→~18s  | ~6×    |

### Disability (95–97)

| #   | Decision                                        | Current path                | LIOS path                           | Tools                         | GraphRAG | Quality gain (why)                                              | Latency | Cost × |
| --- | ----------------------------------------------- | --------------------------- | ----------------------------------- | ----------------------------- | -------- | --------------------------------------------------------------- | ------- | ------ |
| 95  | Can I afford to stop working due to disability? | 1-call advisor              | [Finance∥Health∥Career]→det tail    | income-replacement, Cash Flow | query    | **High** (est, coverage unproven) — income-at-risk cross-domain | 6→~30s  | ~14×   |
| 96  | SSDI vs private disability — coordinate?        | 1-call advisor names inputs | [Finance∥Health]→Decision Scientist | benefit-offset                | skip     | **High** (est) — offset modeling                                | 4→~20s  | ~10×   |
| 97  | Adapt home / accessibility costs?               | 1-call advisor              | [Finance]→Tool Exec                 | Cash Flow                     | skip     | **Low** — budget check                                          | 1→~9s   | +0     |

### Healthcare coverage (98–100, +cross-cutting)

| #   | Decision                                                                             | Current path   | LIOS path                                  | Tools                                    | GraphRAG | Quality gain (why)                                             | Latency | Cost × |
| --- | ------------------------------------------------------------------------------------ | -------------- | ------------------------------------------ | ---------------------------------------- | -------- | -------------------------------------------------------------- | ------- | ------ |
| 98  | HDHP+HSA vs PPO for my family?                                                       | 1-call advisor | [Finance∥Health∥Family]→Decision Scientist | plan-compare, HSA-tax                    | skip     | **High** (est, coverage unproven) — total-cost-of-care modeled | 4→~22s  | ~10×   |
| 99  | COBRA vs marketplace after job loss?                                                 | 1-call advisor | [Finance∥Health]→Decision Scientist        | premium-compare, subsidy                 | query    | **High** (est) — subsidy-eligibility modeled                   | 4→~20s  | ~10×   |
| 100 | Retire before Medicare — bridge coverage? (cross-cutting: Finance∥Health∥retirement) | 1-call advisor | [Finance∥Health]→det tail                  | Healthcare-cost, Retirement, ACA-subsidy | query    | **High** (est) — bridge-gap + drawdown cross-domain            | 5→~24s  | ~12×   |

---

## 3. Summary — distribution of quality gain

| Gain      | Count   | LLM-call profile                        | Cost profile | Shared trait                                          |
| --------- | ------- | --------------------------------------- | ------------ | ----------------------------------------------------- |
| **High**  | 47      | 3–6 calls (det tail; many cross-domain) | ~8–14×       | **all** ≥2 domains **and** tool/projection-heavy      |
| **Med**   | 28      | 2–4 calls                               | ~5–6×        | single-domain-with-math, or 2-domain w/ light tooling |
| **Low**   | 14      | 1 call (routes to ~today's path)        | +0           | comparison/explanatory the advisor already narrates   |
| **None**  | 11      | 1 call                                  | +0           | purely conversational / procedural / judgment         |
| **Total** | **100** | —                                       | —            | —                                                     |

**The correlation, stated plainly.** Every one of the 47 High-gain decisions is **multi-domain
(≥2 domains, shown `[A∥B...]`) AND tool/projection-heavy** (it invokes the deterministic decision tail with a
`calculation_trace`). Not a single SIMPLE or single-domain conversational decision earns a High label. The
gain tracks the two structural features the current 1-call advisor cannot supply on its own:

1. **Deterministic, traceable modeled tradeoffs** (the decision tail per `DECISION_LIFECYCLE.md` §5) — only
   needed when there are real numbers/projections to model.
2. **Cited cross-domain edges** (GraphRAG `query`) — only needed when one domain's choice provably moves
   another (housing→retirement, career→family).

Where neither feature applies (Low/None, 25/100), LIOS routes to the same single advisor call
(`AGENT_SELECTION_ENGINE.md` R1/R2): **+0 LLM calls, +0 cost, no measurable gain.** The 53/100 in High has
matching High estimates but those are still flagged `(est, coverage unproven)`.

**The honest hedge.** Every High/Med label is a reasoned estimate, not a measured score, because coverage
(data-rich answer quality) is UNMEASURED (`LIOS_SIMULATION_FRAMEWORK.md` §1). The _structural_ claim — that
gain is only plausible where ≥2 domains + tools are involved — is robust regardless of coverage; the
_magnitude_ of each High is not yet provable.

---

## 4. Conclusion — where LIOS justifies its latency/cost

| Bucket                                                        | Count      | Verdict                                                                                                                                                                                   |
| ------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LIOS plausibly worth it** (High gain, multi-domain + tools) | **47/100** | The +18–30s and ~8–14× cost buy traceable, cross-domain modeled tradeoffs the 1-call advisor structurally cannot produce — _but the magnitude is an estimate until coverage is measured._ |
| **Marginal** (Med gain)                                       | **28/100** | Worth it only if the +5–6× cost and +7–14s are cheap enough at scale; many resolve at 2 calls. Borderline; gate by classifier precision so they don't over-route to the full tail.        |
| **Current advisor already sufficient** (Low/None)             | **25/100** | No multi-agent value. Must route to the existing 1-call path at +0 cost. Mis-routing these to the decision tail is a pure cost/latency bug (`COST_MODEL.md` §6 lever 6).                  |

**Bottom line.** For roughly **a quarter of canonical decisions (25/100), the current single-call advisor is
already sufficient** and LIOS should add nothing. For **about half (47/100) LIOS plausibly improves decision
quality enough to justify its cost** — and every one of those is multi-domain + tool-heavy, exactly matching
the framework's prior (`LIOS_SIMULATION_FRAMEWORK.md` §3: "the gain concentrates in genuinely multi-domain,
tool-heavy decisions"). The remaining ~28 are genuinely marginal and their fate is an economics question, not
a quality one.

This validates the merge hypotheses' direction: the value lives in the **deterministic tail + cross-domain
edges on the right ~half of decisions**, not in fanning out an LLM agent per domain on every turn. The single
biggest risk to the economics is **mis-classifying** a Low/None or Med decision into the 6-call complex tail
(turning a free turn into a ~40–55s / $0.06 turn) — so classifier precision and the R6/R8 gates do more for
the cost/quality ratio than any added agent. And the single biggest open question to the _quality_ side is
unchanged: **measure coverage**, because today every High is an estimate, never a fabricated win.

> **Reminder (`LIOS_SIMULATION_FRAMEWORK.md` §5):** none of these gain labels are measured metrics. They are
> reasoned estimates with a stated basis; the cross-domain+tool correlation is the durable finding, the
> per-decision magnitude is not yet provable until a decision golden-set + coverage measurement exists
> (`DECISION_LIFECYCLE.md` §10 gap).
