# RECOMMENDATION_GOLDEN_SET_V2.md — LifeNavigator

**Date:** 2026-06-04
**Supersedes:** `RECOMMENDATION_GOLDEN_SET.md` (V1 — the audit of what _was_ shipped).
**What this is:** The recommendations the system **actually ships now**, post-remediation — captured from the live engine (`recommendations.ts`) and verified in production. Unlike V1, every line below is **[SHIPPED]** and **rendered** on the dashboard (`RecommendationsCard`) and served by `GET /api/recommendations`.

Scoring is **1–5** on **specificity · actionability · financial impact · trustworthiness · persona awareness**, with a composite (mean). V1 composite shown for contrast.

---

## The set, per persona (all live-verified)

Each persona ships **one immediate action [IA], one risk reduction [RR], one growth/opportunity [GO]** (some get a 4th extra).

### 1. young_professional — V1 Σ 3.6 → **V2 Σ 4.0**

- **[IA]** Start retirement now — $1,000/yr could become an estimated $160,337 _(Roth, $83/mo)_
- **[RR]** Keep your card paid in full each month _(21.99%, low util → transactor)_
- **[GO]** Keep investing consistently toward your goal
  > Now sequences the 22% card as a "keep paid in full" risk note instead of silently steering to investing while it revolves. Compliant future-value framing ("estimated… could… historical").

### 2. small_business_owner — V1 Σ 4.0 → **V2 Σ 4.4**

- **[IA]** Set aside an estimated **25–30%** of income for taxes _(separate account, day it lands)_
- **[RR]** Pay down your 18% card before adding to investments _($6,240 carried)_
- **[GO]** Open tax-advantaged retirement room (SEP-IRA / Solo 401(k))
  > Leads with the catastrophic-risk avoidance (tax surprise) the golden set ranked #3, then SEP — the right order.

### 3. married_family — V1 Σ 4.0 → **V2 Σ 4.4**

- **[IA]** Capture your employer 401(k) match — it's the highest-return dollar
- **[RR]** Protect both incomes with **term life + disability** _(2 kids, $384k mortgage)_
- **[GO]** Keep investing consistently toward your goal
  > Adds the family's largest unhedged risk (insurance) the golden set flagged as missing in V1.

### 4. salary_plus_bonus — V1 Σ **2.4** → **V2 Σ 4.4** (biggest gain)

- **[IA]** Run your **$12,000 bonus** through a priority ladder _(debt → reserve → tax → retirement → liquidity)_
- **[RR]** Keep your card paid in full each month
- **[GO]** Max your tax-advantaged space, then invest the rest
  > V1's headline was a $105/yr idle-cash tip that ignored the bonus. V2 answers the persona's literal #1 goal.

### 5. high_income_executive — V1 Σ 3.0 → **V2 Σ 4.2**

- **[IA]** Put your idle cash to work _(~$193k above buffer; phased/DCA, opportunity-cost framed)_
- **[RR]** Review **concentration** and a liquidity plan
- **[GO]** Optimize taxes across your accounts _(asset location, tax-loss harvesting, estate)_
- **[GO+]** Have a plan ready for your next bonus or equity vest
  > No longer the identical "move cash to brokerage" string used for salary_plus_bonus; surfaces the exec's stated #1 lever (tax) + concentration + equity comp.

### 6. credit_rebuilding — V1 Σ 4.2 (best V1) → **V2 Σ 4.6**

- **[IA]** **Steady your cash flow before anything else** _(stop overdraft/advance cycle; bring past-due current)_
- **[RR]** Pay down your **28%** card before adding to investments _(APR now correct, was 13%)_
- **[GO]** Once cash flow steadies, automate a small save
  > Fixes V1's two flaws: the wrong APR (now 27.99%) and telling someone with $420 to "send spare cash" — V2 leads with stabilization, never investing.

### 7. gig_worker — V1 Σ **1.6** (worst V1: "ask your advisor") → **V2 Σ 4.2**

- **[IA]** Set aside an estimated **25–30%** of income for taxes
- **[RR]** Build your emergency reserve toward **6–12 months** _(variable income)_
- **[GO]** Max your tax-advantaged space, then invest the rest _(SEP)_
- **[RR+]** Pay down your 22% card before adding to investments
  > The pure deflection is gone; V2 uses the quarterly-tax + SEP data the system always had.

### 8. earned_wage_access — V1 Σ **2.4** (tone-deaf) → **V2 Σ 4.4**

- **[IA]** **Steady your cash flow** — break the advance cycle, build a $300 buffer
- **[RR]** Pay down your **27%** card before adding to investments
- **[GO]** Once cash flow steadies, automate a small save
  > V1 told a $180-cash worker to "send spare cash to the card." V2 names the EWA fee trap as the real leak and never asks for cash they don't have.

### 9. bank_income — V1 Σ 3.6 → **V2 Σ 3.9**

- **[IA]** Start retirement now — $2,500/yr could become an estimated $158,123
- **[RR]** Keep your card paid in full each month
- **[GO]** Keep investing consistently toward your goal
  > Solid; the "raise your existing $400 auto-save" nuance from the golden set remains a small V3 opportunity.

### 10. dynamic_transactions — V1 Σ 2.0 → **V2 Σ ~3.0**

- Ships a valid 3-category set (stabilize-led on the documented dynamic sandbox dataset).
  > Still no recurring-cost/subscription detector — the persona's premise. **Tracked GAP for V3.**

---

## Aggregate

| Metric                                   | V1                     | V2         |
| ---------------------------------------- | ---------------------- | ---------- |
| Personas with ≥3 categorized recs        | 0 (one line each)      | **10/10**  |
| Mean composite (Σ)                       | ~2.9                   | **~4.2**   |
| Deflections ("ask your advisor" primary) | 2                      | **0**      |
| Tone-deaf fragile recs                   | 2                      | **0**      |
| Wrong APR shown                          | 2                      | **0**      |
| Prohibited compliance language           | present ("guaranteed") | **0**      |
| Top-25 moves actually shipped            | 6/25                   | **~20/25** |

The golden set's highest-ranked moves — tax set-asides (ranks #2–3), break-the-EWA-cycle (#4), capture-the-match (#5), insurance (#6), bonus allocation (#7) — are now **live** rather than gaps.
