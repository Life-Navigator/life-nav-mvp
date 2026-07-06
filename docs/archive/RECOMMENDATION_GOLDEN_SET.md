# RECOMMENDATION_GOLDEN_SET.md — LifeNavigator

**Date:** 2026-06-04
**Scope:** All 10 sample personas. What the system _actually recommends today_, scored on 5 dimensions; the generic/weak ones flagged; advisor-grade rewrites; a ranked top-25 across all personas; and a CFP/Morgan-Stanley review verdict.

---

## 0. Grounding & an honest caveat about "top 5"

This review is traced against real code, not aspiration:

- **Persona financials:** `apps/web/src/lib/integrations/plaid/plaid-custom-configs.ts`
- **Persona metadata (goals / life stage / risk):** `apps/web/src/lib/integrations/plaid/personas.ts`
- **The recommendation that ships:** `apps/web/src/lib/finance/first-insight.ts` (deterministic rule ladder, rewritten in the Wave-0 sprint)

**Structural truth (from `RECOMMENDATION_QUALITY_REPORT.md`):** the system today emits **exactly one** persona-grounded recommendation per user — the First Insight line. The other two surfaces don't count: the Next-Dollar Optimizer is structurally blind to persona data (returns the _same_ plan for all 10), and the gateway LLM recommendation is dead-on-arrival (422 + discarded). So a literal "current top 5 per persona" does not exist in the product.

To honor the request without inventing a pipeline, each persona below lists **5 recommendations tagged by reality**:

- **[SHIPPED]** — what First Insight actually renders today (traced through the ladder against the real data). Scored on the real thing.
- **[LATENT]** — what a built-but-unreachable surface would produce (the optimizer's identical plan). The user never sees it.
- **[GAP]** — a high-value, data-supported recommendation the persona _needs_ and the system has the data for, but produces nothing for.

Scores are **1–5** on **specificity · actionability · financial impact · trustworthiness · persona awareness**, with a composite (simple mean).

> **⚠ Data-accuracy bug that distorts two personas' SHIPPED output:** Plaid sandbox does **not** honor the override credit APR. `credit_rebuilding` (config 27.99%) and `earned_wage_access` (config 26.99%) both render as **~13% APR** live (verified in the Wave-0 GATE-0 run). Every score below for those two is for _what the user sees_ (13%); the rewrite assumes the real APR. Fixing the APR persistence is a prerequisite for trustworthy debt recommendations.

---

## 1–4. Per-persona: current top 5, scores, generic flags, rewrites

Legend: **S**=specificity, **A**=actionability, **$**=financial impact, **T**=trustworthiness, **P**=persona awareness, **Σ**=composite.

---

### 1. `young_professional` — early career, W-2, goals: emergency fund / start investing / pay down student debt

Data: checking $3.2k, savings $4.8k, card $640 @ ~22% (limit $5k, 13% util), student loan $18.4k. Cash $8k. No retirement acct.

| #   | Tag         | Recommendation (as worded)                                                    | S   | A   | $   | T   | P   | Σ       |
| --- | ----------- | ----------------------------------------------------------------------------- | --- | --- | --- | --- | --- | ------- |
| 1   | **SHIPPED** | "Open a Roth IRA and automate a $83/month contribution this week." (Rule 5)   | 4   | 4   | 3   | 4   | 3   | **3.6** |
| 2   | GAP         | Build the emergency fund to 3 months ($1.5k more) before/while investing      | 3   | 3   | 3   | 5   | 4   | 3.6     |
| 3   | GAP         | Refinance/auto-pay the $18.4k student loan; confirm rate vs. 7% invest hurdle | 3   | 2   | 3   | 4   | 4   | 3.2     |
| 4   | GAP         | Pay the $640 card in full monthly; never carry it at 22%                      | 4   | 4   | 2   | 5   | 3   | 3.6     |
| 5   | LATENT      | "Direct $X to top up your emergency fund." (optimizer, never shown)           | 2   | 2   | 2   | 3   | 2   | 2.2     |

**Generic?** Partially. The Roth line is reused verbatim for `bank_income` (same string). It's sound but ignores the user's _stated_ #1 goal (emergency fund — they're $1.5k short of 3 months) and the student loan.
**Rewrite (golden):** _"You're ~$1.5k from a true 3-month cushion and your card and student loan are under control — so split it: finish the emergency fund first, then start a Roth IRA at $83/mo. At your age, 37 years of compounding turns even $1,000/yr into ~$160,000 by retirement."_ (sequences the three stated goals instead of jumping to investing.)

---

### 2. `small_business_owner` — business_owner, irregular revenue + draws, aggressive

Data: business checking $28.4k, owner checking $5.2k, business card $6.24k @ 18.49% (limit $25k), SBA loan $64k. Cash $33.6k. No retirement acct. Recent $3,000 owner draw; commingled flows.

| #   | Tag         | Recommendation (as worded)                                                                                        | S   | A   | $   | T   | P   | Σ       |
| --- | ----------- | ----------------------------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | ------- |
| 1   | **SHIPPED** | "Open a SEP-IRA before your next quarterly tax payment to deduct this year's contribution." (Rule 5 owner branch) | 4   | 4   | 4   | 4   | 4   | **4.0** |
| 2   | GAP         | Set aside 25–30% of net for quarterly estimated taxes in a separate account                                       | 4   | 4   | 4   | 5   | 5   | 4.4     |
| 3   | GAP         | Stop commingling: formalize a fixed owner-draw / payroll split                                                    | 3   | 3   | 3   | 4   | 5   | 3.6     |
| 4   | GAP         | Pay down the $6.24k @ 18.49% biz card before discretionary spend                                                  | 4   | 4   | 3   | 5   | 4   | 4.0     |
| 5   | LATENT      | Same generic "emergency fund → retirement → taxable" optimizer plan                                               | 2   | 2   | 2   | 3   | 1   | 2.0     |

**Generic?** No — the SHIPPED SEP-IRA line is genuinely persona-fit. But it leads with retirement when the persona's defining risk is **tax set-aside + commingling**.
**Rewrite (golden):** _"Before retirement, protect against a tax surprise: route 25–30% of each client payment into a separate 'taxes' account. Then a SEP-IRA lets you shelter far more than an employee — opening one before your next quarterly payment deducts this year's contribution."_ (orders tax-safety ahead of the SEP, keeps the strong SEP point.)

---

### 3. `married_family` — family, two W-2, moderate, goals: joint finances / save for kids / pay down mortgage

Data: joint checking $9.4k, 529/family savings $22k, card $2.84k @ 20.24% (limit $18k), mortgage $384k, auto $21.5k. Cash $31.4k. No retirement acct.

| #   | Tag         | Recommendation (as worded)                                                                                                   | S   | A   | $   | T   | P   | Σ       |
| --- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | ------- |
| 1   | **SHIPPED** | "Each of you confirm your employer 401(k) match is fully captured — that's free money before anything else." (Rule 5 family) | 3   | 4   | 4   | 5   | 4   | **4.0** |
| 2   | GAP         | Term life + disability for both earners (kids + $384k mortgage)                                                              | 3   | 3   | 4   | 5   | 5   | 4.0     |
| 3   | GAP         | Right-size the $22k "529/family savings" between EF and actual 529                                                           | 3   | 3   | 3   | 4   | 5   | 3.6     |
| 4   | GAP         | Don't prepay a low-rate mortgage ahead of the 401(k) match                                                                   | 3   | 3   | 3   | 4   | 4   | 3.4     |
| 5   | LATENT      | Generic optimizer plan (identical to all personas)                                                                           | 2   | 2   | 2   | 3   | 1   | 2.0     |

**Generic?** No, but it **assumes a match exists** (no data confirms it) and skips the family's biggest exposure: **no life insurance with two kids and a $384k mortgage**.
**Rewrite (golden):** _"With two incomes, two kids and a $384k mortgage, your highest-leverage moves are (1) capture any employer 401(k) match — it's free money — and (2) make sure both earners carry term life + disability so the family is protected if one income stops. Both come before paying extra on a low-rate mortgage."_

---

### 4. `salary_plus_bonus` — mid_career, salary + quarterly bonus, aggressive, goals: allocate bonuses / max tax-advantaged / invest consistently

Data: checking $14.2k (incl. a $12k Q2 bonus event), brokerage $86k, 401(k) $142k, card $1.82k @ ~20%. Cash $14.2k, invested $228k. Has retirement.

| #   | Tag         | Recommendation (as worded)                                                                                     | S   | A   | $     | T   | P     | Σ       |
| --- | ----------- | -------------------------------------------------------------------------------------------------------------- | --- | --- | ----- | --- | ----- | ------- |
| 1   | **SHIPPED** | "Move the spare cash above a buffer into your brokerage… ~$4,200 sitting on the sidelines." (Rule 6, ~$105/yr) | 3   | 3   | **1** | 3   | **2** | **2.4** |
| 2   | GAP         | Allocate the $12k bonus: max 401(k) → backdoor Roth → taxable                                                  | 4   | 4   | 5     | 4   | 5     | 4.4     |
| 3   | GAP         | Confirm 401(k) is on pace to the $23k annual max                                                               | 3   | 3   | 4     | 4   | 4     | 3.6     |
| 4   | GAP         | Pay the $1.82k card in full; it's not a financing tool at 20%                                                  | 4   | 4   | 2     | 5   | 3     | 3.6     |
| 5   | LATENT      | Generic optimizer plan                                                                                         | 2   | 2   | 2     | 3   | 1     | 2.0     |

**Generic? ✗ WEAK — flagged.** The SHIPPED rec fixates on $4,200 of idle cash worth ~$105/yr while a **$12,000 bonus just landed** and the persona's literal #1 goal is "allocate bonuses well." It answers the wrong question.
**Rewrite (golden):** _"A $12,000 bonus just hit your checking — that's the decision that matters this quarter, not the $4k buffer. Send it through the priority ladder: first top off your 401(k) toward the $23k max, then a backdoor Roth, then taxable. That sequence can shelter most of the bonus from tax and keep you on your 'max tax-advantaged' goal."_

---

### 5. `high_income_executive` — peak_earning, high salary + equity, aggressive, goals: optimize taxes / grow investments / build wealth

Data: checking $58.2k, money-market $145k (maps to cash), brokerage $920k, backdoor Roth IRA $410k, card $3.12k @ 18%, jumbo mortgage $1.24M. Cash ~$203k, invested ~$1.33M. Has retirement.

| #   | Tag         | Recommendation (as worded)                                                                                  | S   | A   | $   | T   | P     | Σ       |
| --- | ----------- | ----------------------------------------------------------------------------------------------------------- | --- | --- | --- | --- | ----- | ------- |
| 1   | **SHIPPED** | "Move the spare cash above a buffer into your brokerage… ~$193,200 on the sidelines (~$4,830/yr)." (Rule 6) | 3   | 3   | 3   | 3   | **3** | **3.0** |
| 2   | GAP         | Asset location + tax-loss harvesting across the $920k taxable                                               | 3   | 2   | 5   | 4   | 5     | 3.8     |
| 3   | GAP         | Equity-comp plan: RSU/option vesting, concentration, 10b5-1                                                 | 2   | 2   | 5   | 4   | 5     | 3.6     |
| 4   | GAP         | Deploy the $145k money-market via DCA, not lump-sum, at target allocation                                   | 4   | 3   | 4   | 4   | 4     | 3.8     |
| 5   | GAP         | Estate basics: beneficiaries, will/trust at this net worth                                                  | 2   | 2   | 3   | 5   | 4     | 3.2     |

**Generic? ✗ Partially — flagged.** The SHIPPED string is _identical_ to `salary_plus_bonus` ("Move the spare cash above a buffer…"). For a $1.5M-liquid exec whose stated #1 goal is **tax optimization**, "move cash to a brokerage" is the lowest-altitude possible answer. Real levers (asset location, equity comp, estate) are untouched.
**Rewrite (golden):** *"You're holding ~$193k in cash earning ~0% real — but for you the bigger lever is *where*, not *whether*, to invest. Deploy it on a dollar-cost-average schedule into your target allocation, place tax-inefficient assets inside the IRA, and harvest losses in the $920k taxable account. Given equity comp and a $1.24M mortgage, a one-time tax + estate review is the highest-value hour you'll spend this year."*

---

### 6. `credit_rebuilding` — recovery, hourly W-2 thin margins, conservative, goals: rebuild credit / reduce debt / emergency fund

Data: checking $420, secured card $920 @ **27.99% (shown as 13%)** (limit $1k, 92% util, **overdue**), personal loan $5.2k in collections. Recent **$35 overdraft fee**, **$95 payday-loan payment**.

| #   | Tag         | Recommendation (as worded)                                                                          | S   | A   | $   | T   | P   | Σ       |
| --- | ----------- | --------------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | ------- |
| 1   | **SHIPPED** | "Send any spare cash to this card before adding to savings or investing." (Rule 0, _shows 13% APR_) | 4   | 4   | 4   | 5   | 4   | **4.2** |
| 2   | GAP         | Bring the **overdue** secured card current first — protect the credit rebuild                       | 4   | 3   | 4   | 5   | 5   | 4.2     |
| 3   | GAP         | Break the overdraft/payday cycle ($35 + $95) before extra debt paydown                              | 4   | 3   | 4   | 5   | 5   | 4.2     |
| 4   | GAP         | Contact the collections agency on the $5.2k loan; ask for a plan                                    | 3   | 2   | 3   | 4   | 5   | 3.4     |
| 5   | LATENT      | **DANGER:** optimizer would say "invest in a taxable brokerage"                                     | 3   | 3   | 1   | 1   | 1   | 1.8     |

**Generic?** No — the SHIPPED line is the **single best output in the product** (correct, safe, refuses to suggest investing). Two real problems: (a) the **wrong APR** (13% vs 27.99%) understates urgency, and (b) telling someone with **$420 and active overdrafts** to "send spare cash to the card" misreads that there _is_ no spare cash and the card is **overdue**.
**Rewrite (golden):** _"Two things come before paying anything extra: bring the overdue secured card current so your credit rebuild isn't set back, and stop the overdraft + payday cycle that cost you $130 last month. Once those stop the bleeding, every dollar against that 28% card is a guaranteed 28% return — better than any investment. Don't invest a cent until this is handled."_

---

### 7. `gig_worker` — self_employed, 1099 variable multi-client, moderate, goals: manage variable income / set aside taxes / build retirement

Data: 1099 checking $6.1k (incl. a **$1,200 EST QUARTERLY TAX** payment + $240 home office), SEP-IRA $38k, business card $1.34k @ 22.49%. Cash $6.1k. Has retirement (SEP).

| #   | Tag         | Recommendation (as worded)                                                             | S     | A     | $     | T   | P     | Σ       |
| --- | ----------- | -------------------------------------------------------------------------------------- | ----- | ----- | ----- | --- | ----- | ------- |
| 1   | **SHIPPED** | "Ask your advisor how to manage variable income from here." (Rule 6 positive fallback) | **1** | **1** | **1** | 3   | **2** | **1.6** |
| 2   | GAP         | Keep a tax reserve = 25–30% of each deposit (you already pay quarterlies)              | 4     | 4     | 4     | 5   | 5     | 4.4     |
| 3   | GAP         | Fund the SEP-IRA toward the ~25%-of-net limit before year-end                          | 4     | 3     | 4     | 4   | 5     | 4.0     |
| 4   | GAP         | Smooth variable income: pay yourself a fixed monthly "salary" from a buffer            | 3     | 3     | 3     | 4   | 5     | 3.6     |
| 5   | GAP         | Clear the $1.34k @ 22.49% card; it's the highest guaranteed return available           | 4     | 4     | 2     | 5   | 4     | 3.8     |

**Generic? ✗ WORST OUTPUT — flagged.** "Ask your advisor" is a **deflection, not a recommendation.** The system literally _sees_ the $1,200 quarterly-tax payment and the SEP-IRA and uses neither.
**Rewrite (golden):** _"Your income is lumpy, so the discipline that matters is the tax reserve — you're already paying quarterlies, so route 25–30% of every client deposit into a separate account the day it lands. Then top up your SEP-IRA toward its ~25%-of-net limit before year-end, and pay off the $1,340 business card at 22% before any discretionary spend."_

---

### 8. `earned_wage_access` — hourly_worker, hourly + EWA advances, conservative, goals: stabilize cash flow / avoid fees / start saving

Data: checking $180, starter card $410 @ **26.99% (shown ~13%)** (limit $750, 55% util). Recent: **3 EWA advances ($120/$90/$110)** + **$38 EWA fee** in one cycle. Lives paycheck-to-paycheck.

| #   | Tag         | Recommendation (as worded)                                                                     | S   | A     | $   | T   | P     | Σ       |
| --- | ----------- | ---------------------------------------------------------------------------------------------- | --- | ----- | --- | --- | ----- | ------- |
| 1   | **SHIPPED** | "Send any spare cash to this card before adding to savings or investing." (Rule 0, shows ~13%) | 3   | **2** | 2   | 3   | **2** | **2.4** |
| 2   | GAP         | Break the EWA advance cycle — each $38 fee on a ~$110 advance ≈ payday-loan APR                | 4   | 3     | 4   | 5   | 5     | 4.2     |
| 3   | GAP         | Build a $300 micro-buffer so you can stop advancing wages                                      | 4   | 3     | 4   | 5   | 5     | 4.2     |
| 4   | GAP         | Then pay the $410 card before it compounds at 27%                                              | 4   | 4     | 2   | 5   | 4     | 3.8     |
| 5   | LATENT      | Generic optimizer "emergency fund" line                                                        | 2   | 2     | 2   | 3   | 2     | 2.2     |

**Generic? ✗ MIS-PRIORITIZED — flagged.** Telling someone with **$180** to "send spare cash to the card" is tone-deaf — there is no spare cash, and the **EWA fee cycle** (the persona's entire defining pain) is invisible to the engine. The advance fees are a worse, more urgent leak than the card.
**Rewrite (golden):** _"Those wage advances are the most expensive money you're using — a $38 fee on a ~$110 advance is a triple-digit effective rate. The fastest win isn't the card; it's building a small $300 buffer so you can stop advancing your pay. Start with $20/week, break the cycle, and then turn to the $410 card."_

---

### 9. `bank_income` — general, recurring deposits + side gig, moderate, goals: understand income / budget to deposits / build savings

Data: checking $7.6k, savings $9.1k (recent **$400 AUTO SAVE**), card $1.18k @ 20.99% (limit $9k, 13% util), side-gig deposits. Cash $16.7k. No retirement acct.

| #   | Tag         | Recommendation (as worded)                                                   | S   | A   | $   | T   | P   | Σ       |
| --- | ----------- | ---------------------------------------------------------------------------- | --- | --- | --- | --- | --- | ------- |
| 1   | **SHIPPED** | "Open a Roth IRA and automate a $208/month contribution this week." (Rule 5) | 4   | 4   | 3   | 4   | 3   | **3.6** |
| 2   | GAP         | You already auto-save $400/mo — raise it and split toward a Roth             | 4   | 4   | 3   | 4   | 5   | 4.0     |
| 3   | GAP         | Budget to your _reliable_ direct deposit; treat the side gig as surplus      | 3   | 3   | 3   | 4   | 5   | 3.6     |
| 4   | GAP         | Keep the $1.18k card paid monthly at 21%                                     | 4   | 4   | 2   | 5   | 3   | 3.6     |
| 5   | LATENT      | Generic optimizer plan                                                       | 2   | 2   | 2   | 3   | 1   | 2.0     |

**Generic?** Mildly — the Roth line is the _same string_ used for `young_professional`, and it ignores the **existing $400 auto-save habit** the persona is literally built around.
**Rewrite (golden):** _"You're already auto-saving $400/month — that's the habit most people lack. Point part of it at a Roth IRA (≈$208/mo) so it compounds tax-free, and budget your fixed costs to your reliable direct deposit while treating the side-gig income as surplus that accelerates the goal."_

---

### 10. `dynamic_transactions` — general, regular deposits, moderate, goals: explore spending insights / find recurring costs / optimize a budget

Data: **no custom config** — uses the documented dynamic sandbox user; transactions frequently fail to persist (known gap).

| #   | Tag         | Recommendation (as worded)                                                     | S   | A   | $   | T   | P     | Σ       |
| --- | ----------- | ------------------------------------------------------------------------------ | --- | --- | --- | --- | ----- | ------- |
| 1   | **SHIPPED** | Generic Rule 5 retirement line _or_ positive fallback (varies; often degraded) | 2   | 2   | 2   | 3   | **1** | **2.0** |
| 2   | GAP         | Detect recurring subscriptions/charges and flag duplicates                     | 3   | 3   | 3   | 4   | 5     | 3.6     |
| 3   | GAP         | Categorize spend; surface the top 3 controllable categories                    | 3   | 3   | 3   | 4   | 5     | 3.6     |
| 4   | GAP         | Spot the largest non-essential recurring cost to cancel                        | 4   | 4   | 3   | 4   | 5     | 4.0     |
| 5   | GAP         | Budget vs. actuals against the regular deposit cadence                         | 3   | 3   | 2   | 4   | 5     | 3.4     |

**Generic? ✗ TOTAL MISS — flagged.** The persona's _entire premise_ is spending-insight/recurring-cost detection, and the system produces **zero** spending insight — it falls back to a retirement or net-worth line. There is no spending-analysis recommender at all.
**Rewrite (golden):** _"I found 4 recurring charges totaling $X/month, including one you haven't used in 60 days — cancelling it saves ~$Y/year. Your three biggest controllable categories last month were [dining / subscriptions / rideshare]; trimming dining 15% frees ~$Z toward your savings goal."_ (requires building a recurring-cost detector — currently a GAP.)

---

## 5. Top 25 recommendations across all personas (ranked)

Ranked by composite value to the user = **financial impact × specificity × trustworthiness × persona-fit**, with a penalty for "not actually shipped." **Shipped** = a beta user sees it today; **Gap** = needs to be built; **Bug** = shipped but data-impaired.

| Rank | Persona               | Recommendation                                                                                                                              | Status                     | Why it ranks here                                                           |
| ---- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------- |
| 1    | credit_rebuilding     | Bring the **overdue** secured card current, then stop the overdraft/payday cycle, _then_ attack the 28% balance — invest nothing until done | Shipped+Gap (Bug: 13% APR) | Highest safety + impact; only output that correctly refuses "invest"        |
| 2    | gig_worker            | Reserve 25–30% of every 1099 deposit for taxes the day it lands                                                                             | Gap                        | Prevents the catastrophic failure mode (tax surprise) for the self-employed |
| 3    | small_business_owner  | Separate-account tax set-aside (25–30% of net) before anything else                                                                         | Gap                        | Same catastrophic-risk avoidance; persona's defining exposure               |
| 4    | earned_wage_access    | Break the EWA advance cycle; build a $300 buffer so you stop advancing pay                                                                  | Gap                        | Kills a triple-digit effective-APR leak; the persona's actual pain          |
| 5    | married_family        | Capture any employer 401(k) match — free money — before extra mortgage paydown                                                              | **Shipped**                | Textbook-correct, high ROI, persona-fit                                     |
| 6    | married_family        | Term life + disability for both earners (2 kids, $384k mortgage)                                                                            | Gap                        | Largest unhedged family risk; advisors lead here                            |
| 7    | salary_plus_bonus     | Run the $12k bonus through 401(k)-max → backdoor Roth → taxable                                                                             | Gap                        | Answers the persona's literal #1 goal; large tax impact                     |
| 8    | small_business_owner  | Open a SEP-IRA before the next quarterly payment to deduct this year                                                                        | **Shipped**                | Genuinely persona-fit, tax-deductible, specific                             |
| 9    | high_income_executive | Asset location + tax-loss harvesting across the $920k taxable                                                                               | Gap                        | The exec's stated #1 goal (tax); five-figure annual value                   |
| 10   | gig_worker            | Fund the SEP-IRA toward the ~25%-of-net limit before year-end                                                                               | Gap                        | Large tax-advantaged room the system can see but ignores                    |
| 11   | credit_rebuilding     | Every dollar to the 28% card = guaranteed 28% return; don't invest                                                                          | **Shipped** (Bug: 13%)     | Correct framing; understated by APR bug                                     |
| 12   | high_income_executive | DCA the $145k money-market into target allocation, not lump-sum                                                                             | Gap                        | Real, sizable, risk-aware                                                   |
| 13   | earned_wage_access    | Then pay the $410 card before it compounds at 27%                                                                                           | Gap                        | High guaranteed return once the buffer exists                               |
| 14   | young_professional    | Finish the 3-month emergency fund (~$1.5k more) before scaling investing                                                                    | Gap                        | Matches stated #1 goal; sequencing safety                                   |
| 15   | bank_income           | Raise the existing $400/mo auto-save and route part to a Roth IRA                                                                           | Gap/Shipped                | Builds on a real existing habit; persona-fit                                |
| 16   | young_professional    | Open a Roth IRA, $83/mo — 37 yrs compounding → ~$160k                                                                                       | **Shipped**                | Sound, specific; just not the user's first priority                         |
| 17   | high_income_executive | One-time tax + estate review (equity comp, $1.24M mortgage, beneficiaries)                                                                  | Gap                        | High-value hour at this net worth                                           |
| 18   | bank_income           | Open a Roth IRA, $208/mo                                                                                                                    | **Shipped**                | Decent; reused string, ignores deposit-pattern story                        |
| 19   | small_business_owner  | Pay down the $6.24k @ 18.49% business card                                                                                                  | Gap                        | High guaranteed return; behind tax/commingling                              |
| 20   | salary_plus_bonus     | Confirm 401(k) on pace to the $23k annual max                                                                                               | Gap                        | Persona goal; moderate impact                                               |
| 21   | dynamic_transactions  | Detect recurring/duplicate subscriptions to cancel                                                                                          | Gap                        | The persona's entire premise; currently zero output                         |
| 22   | married_family        | Right-size the $22k "529/family savings" between EF and a real 529                                                                          | Gap                        | Clarifies a commingled bucket                                               |
| 23   | gig_worker            | Smooth income: pay yourself a fixed monthly "salary" from a buffer                                                                          | Gap                        | Behavioral stability for variable income                                    |
| 24   | dynamic_transactions  | Surface top-3 controllable spend categories vs. deposit cadence                                                                             | Gap                        | Directly serves the budgeting goal                                          |
| 25   | high_income_executive | Move ~$193k spare cash off ~0% (the SHIPPED line)                                                                                           | **Shipped**                | Real but lowest-altitude answer for this persona                            |

**What the ranking exposes:** of the top 25, only **6 are actually shipped** (ranks 5, 8, 11, 16, 18, 25), two of them APR-impaired. The highest-value moves — tax set-asides, bonus allocation, insurance, EWA-cycle breaking, spending insights — are **all gaps**. The product's best _idea_ (debt-before-invest) is live; its best _coverage_ is not.

---

## 6. Final verdict — would a CFP / Morgan Stanley advisor / experienced planner approve, challenge, or reject these?

I'm scoring the **shipped** recommendations as a fiduciary reviewer would, plus the latent optimizer behavior.

### ✅ Would APPROVE (defensible as-is)

- **`credit_rebuilding` — debt-before-invest.** Gospel. Every planner agrees: do not invest while carrying ~28% revolving debt. The _logic_ is approved; see the challenge on "guaranteed."
- **`married_family` — capture the 401(k) match first.** Textbook. "Don't leave the match on the table" is the one piece of advice essentially every CFP gives unprompted.
- **`small_business_owner` — SEP-IRA for the tax deduction.** Correct vehicle, correct timing logic (before the quarterly payment). An advisor might add the Solo-401(k) comparison but would approve the direction.

### ⚠ Would CHALLENGE (right instinct, would push back on framing or sequencing)

- **The future-value projections ("worth about $284,621").** A CFP would challenge presenting a single deterministic number at 7% nominal with **no inflation adjustment, no sequence-of-returns risk, no range**. It reads as a promise. They'd want "in today's dollars," a range, and "not guaranteed."
- **The word "guaranteed return" on debt payoff.** Mathematically defensible (paying 28% debt ≈ a 28% pre-tax risk-free return), but **Morgan Stanley compliance flags "guaranteed."** They'd soften to "the highest-certainty return available to you."
- **`young_professional` / `bank_income` — "Open a Roth IRA" while a 20–22% card exists.** A planner would challenge the sequencing: confirm the card is paid in full monthly and the emergency fund is funded _before_ steering dollars to investing. (Here the cards are low-utilization, so it's a soft challenge — but the engine doesn't check.)
- **`high_income_executive` — "move spare cash to a brokerage."** A Morgan Stanley advisor would challenge this as far too generic for a $1.5M-liquid client: no asset-location, no tax-loss harvesting, no equity-comp or estate conversation, and **lump-sum deployment of $193k without a DCA/risk discussion**. Not wrong — just malpractice-by-omission at this tier.
- **`married_family` — assumes a 401(k) match exists.** Challenge: recommend confirming the match _exists and its formula_ before asserting "free money."

### ❌ Would REJECT (a fiduciary would not let these stand)

- **`salary_plus_bonus` — "$4,200 idle cash → ~$105/yr" as the headline.** Rejected. A $12,000 bonus just landed and the client's #1 goal is bonus allocation; leading with a $105/yr buffer optimization is answering the wrong question. An advisor would call this a miss.
- **`gig_worker` — "Ask your advisor how to manage variable income."** Rejected outright — it is **not advice**, it's a deflection, while the system is sitting on the exact data (quarterly-tax payment, SEP-IRA) to give a real answer.
- **`earned_wage_access` — "Send any spare cash to this card."** Rejected as **tone-deaf and potentially harmful**: the client has $180 and is advancing wages to survive the month. Directing nonexistent "spare cash" to a card — while ignoring the EWA fee trap — could push someone to skip essentials. Wrong problem, wrong tone.
- **The latent Next-Dollar Optimizer would tell `credit_rebuilding` and `earned_wage_access` to "invest in a taxable brokerage."** Categorically rejected — recommending taxable investing to someone carrying 27% debt with overdrafts is the textbook fiduciary violation. (Currently unreachable, but it must never become reachable for these personas.)
- **Displaying 13% APR when the real rate is 27.99%.** A compliance reviewer rejects presenting materially **inaccurate numbers** to a client, full stop — fix the APR persistence before these go in front of users.

### One-line summary for the planner's memo

> _"The engine's financial **judgment** is sound where it engages — debt-before-invest, match-first, SEP-for-owners are all advisor-grade. But it engages on only one decision per client, defaults to deflection or a low-altitude 'move your cash' line for the wealthy and the self-employed, ignores insurance and tax-set-aside entirely, and shows a wrong APR. I'd approve ~30% of what ships, challenge ~40% on framing/sequencing, and reject ~30% — concentrated, notably, on the two most financially fragile personas, who can least afford a wrong answer."_

---

### Appendix — the 4 fixes that would move the most of this from "reject/challenge" to "approve"

1. **Fix the APR persistence** (sandbox override → real rate) so debt recommendations are numerically honest. _(Bug.)_
2. **Add a tax-set-aside rule** for `gig_worker` / `small_business_owner` — the highest-ranked gaps, and a catastrophic-risk avoidance an advisor leads with.
3. **Replace the two remaining deflections/mis-fits** (`gig_worker` "ask your advisor"; `earned_wage_access` "send spare cash") with the rewrites above.
4. **Differentiate the wealthy personas** (`salary_plus_bonus` bonus-allocation; `high_income_executive` tax/asset-location) so the system stops answering a $1.5M client with a $105/yr cash tip.
