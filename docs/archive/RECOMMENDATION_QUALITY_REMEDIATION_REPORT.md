# RECOMMENDATION_QUALITY_REMEDIATION_REPORT.md — LifeNavigator

**Date:** 2026-06-04
**Source of truth:** `RECOMMENDATION_GOLDEN_SET.md`
**Goal:** Move recommendation quality from `READY_WITH_P0_FIXES` → `READY_FOR_20_USERS`.
**Deployed:** commit `cc43ed4` → production (`life-nav-mvp-web.vercel.app`)
**Verdict:** ✅ **READY_FOR_20_USERS** (recommendation-quality dimension) — 153/153 unit tests, **60/60 live checks across all 10 personas**.

---

## 1. What shipped

A new **persona-aware recommendation engine** (`apps/web/src/lib/finance/recommendations.ts`) that returns **≥3 categorized recommendations per persona** — one _immediate action_, one _risk reduction_, one _growth/opportunity_ — replacing the old single-line, partly-generic First Insight. `first-insight.ts` is now a thin adapter over the engine's top recommendation (one source of truth; the "Today's brief" hero and the new full set on the dashboard both come from it). A new `GET /api/recommendations` route and a `RecommendationsCard` render the full set.

The engine is **deterministic (no model call)** — so it has no 502 surface and always returns something useful, which is itself a trust property.

---

## 2. P0 requirements — status with evidence

| #   | Requirement                                                                                                                                | Status | Evidence                                                                                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Fix APR persistence** (config APR wins over sandbox default; credit_rebuilding shows 27.99%)                                             | ✅     | `activate-persona/route.ts` now sources APR from the persona config matched by account name (+single-card fallback); live read of `finance.financial_accounts` after activation → `interest_rate = 0.2799` (credit_rebuilding) and `0.2699` (earned_wage_access), **not ~13%**.                                               |
| 2   | **Tax set-aside** (SBO, freelancer, gig, real-estate, consultant; a _range_, not a promise)                                                | ✅     | `taxSetAsideRec` fires for self-employed (`income_type` matches 1099/business/owner-draw/consultant/commission/real-estate, or stage self_employed/business_owner). Copy: "an estimated **25–30%**… roughly $X–$Y/month". Live: gig_worker + small_business_owner both PASS `tax-set-aside`.                                  |
| 3   | **Bonus allocation** (salary_plus_bonus + executive; debt→reserve→tax→retirement→liquidity)                                                | ✅     | `bonusAllocationRec` ladder. Live: salary_plus_bonus top = "Run your $12,000 bonus through a priority ladder"; high_income_executive gets "Have a plan ready for your next bonus or equity vest". Both PASS `bonus-allocation`.                                                                                               |
| 4   | **Debt-before-invest sequencing** (no invest ahead of high-interest revolving debt; APR vs market in conservative language)                | ✅     | `revolvingDebt` gate blocks invest-themed growth; debt copy: "comparable to locking in a **{apr}%** return — well above the ~7% long-run **historical** average, and with far less uncertainty." Dedicated synthetic test (24% card, $8k balance, has investments) → leads with debt, **no** taxable-invest growth rec.       |
| 5   | **Emergency reserve** (months of runway; target range by stability)                                                                        | ✅     | `emergencyReserveRec`: range **3–6 months** (steady) / **6–12 months** (variable/self-employed/fragile), computed from cash ÷ estimated monthly spend. Live: gig_worker risk = "Build your emergency reserve toward 6–12 months".                                                                                             |
| 6   | **Replace weak deflections** (no "ask your advisor" as primary; only a secondary caveat)                                                   | ✅     | "ask your advisor" removed from all primary recs; each rec ends with a _secondary_ "Discuss this with your advisor →" link. Live: all 10 personas PASS `no-deflection`.                                                                                                                                                       |
| 7   | **Remove prohibited language** (ban guaranteed/certain/will earn/risk-free → could/may/historically/estimated/range/based on current data) | ✅     | `PROHIBITED_LANGUAGE` regex + `findProhibitedLanguage`; authored copy uses "could/may/estimated/historically/range". The old shipped "guaranteed return" line is gone. Live: all 10 PASS `compliance`; unit compliance scan passes.                                                                                           |
| 8   | **Persona-aware engine** (recs differ by persona; fragile→stabilize; wealthy→tax/concentration/liquidity/opportunity cost)                 | ✅     | Distinct rule branches by fragility / self-employment / bonus-eligibility / wealth / life-stage. Fragile (credit_rebuilding, earned_wage_access) lead with **stabilization**; executive gets **idle-cash + concentration + tax-optimization + equity-bonus**. Live: every persona's top recommendation differs appropriately. |
| 9   | **≥3 recs per persona** (immediate / risk / growth)                                                                                        | ✅     | Assembly guarantees all three categories with distinct themes; extras added for self-employed (card paydown) and bonus-eligible. Live: all 10 PASS `>=3 recs` and `3 categories`.                                                                                                                                             |
| 10  | **Tests**                                                                                                                                  | ✅     | See §3 — all 7 required conditions covered; 153/153 pass.                                                                                                                                                                                                                                                                     |
| 11  | **Live verify all 10 personas**                                                                                                            | ✅     | See §4 — 60/60 live checks pass against production.                                                                                                                                                                                                                                                                           |

---

## 3. Tests (153/153 pass)

New: `recommendations-personas.test.ts` (+ updated `first-insight-personas.test.ts`). Required conditions, all covered:

- **≥3 distinct recs + all 3 categories** per persona — `expect(recs.length>=3)`, distinct titles, each category present.
- **High-interest debt blocks invest-first** — synthetic 24%/$8k-balance non-fragile profile leads with debt; no growth rec mentions brokerage/taxable.
- **Fragile personas no tone-deaf cash rec** — credit_rebuilding/earned_wage_access lead with stabilization; no rec matches `brokerage|taxable|idle cash|invested account|put…to work`.
- **Bonus personas receive bonus allocation** — salary_plus_bonus + high_income_executive.
- **Self-employed receive tax set-aside** — gig_worker + small_business_owner.
- **Compliance language scan passes** — `findProhibitedLanguage` returns null for every rec of every persona.
- **APR persistence verified** — credit_rebuilding debt rec metric = "28% APR", earned_wage_access = "27% APR" (sourced from config 27.99/26.99, not the ~13% sandbox default).

---

## 4. Live verification (production, 60/60)

Harness: registered a fresh user per persona, activated it via the real `/api/integrations/plaid/activate-persona`, read the persisted APR, fetched the real `GET /api/recommendations`, and asserted the contract. All 10 personas green; test users cleaned up afterward.

```
● credit_rebuilding   PASS activate(200)  PASS >=3 recs(3)  PASS 3 categories  PASS compliance
                      PASS no-deflection  PASS fragile-stabilize-first  PASS fragile-no-invest-cash
                      PASS APR-27.99%(persisted=0.2799)
● earned_wage_access  … PASS fragile-no-invest-cash  PASS APR-26.99%(persisted=0.2699)
● gig_worker / small_business_owner   … PASS tax-set-aside
● salary_plus_bonus / high_income_executive   … PASS bonus-allocation
TOTAL: 60 PASS / 0 FAIL
```

---

## 5. Before → after (per persona, the shipped top action)

| Persona               | V1 (shipped)                                | V2 (shipped)                                                                                           |
| --------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| young_professional    | "Open a Roth IRA, $83/mo"                   | Start retirement ($1,000/yr → est. $160,337) + keep card paid + keep investing                         |
| small_business_owner  | "Open a SEP-IRA…"                           | **Tax set-aside 25–30%** + pay down 18% card + SEP/Solo 401(k)                                         |
| married_family        | "Capture the 401(k) match"                  | Capture 401(k) match + **term life + disability** + keep investing                                     |
| salary_plus_bonus     | "$4,200 idle → ~$105/yr" ❌                 | **Run your $12,000 bonus through a priority ladder** + keep card paid + max tax-advantaged             |
| high_income_executive | "Move spare cash to brokerage" (generic)    | Put idle cash to work (DCA) + **concentration & liquidity** + **tax optimization** + equity-bonus plan |
| credit_rebuilding     | "Send spare cash to this card" (13% APR ❌) | **Steady your cash flow first** + pay down **28%** card + automate a small save                        |
| gig_worker            | "Ask your advisor…" ❌ deflection           | **Tax set-aside 25–30%** + emergency reserve 6–12mo + SEP + 22% card                                   |
| earned_wage_access    | "Send spare cash to card" (tone-deaf ❌)    | **Steady your cash flow / break the advance cycle** + pay down **27%** card + automate a small save    |
| bank_income           | "Open a Roth IRA, $208/mo"                  | Start retirement ($2,500/yr → est. $158,123) + keep card paid + keep investing                         |
| dynamic_transactions  | generic / often degraded                    | 3 categorized recs (stabilize-led on the dynamic sandbox dataset)                                      |

---

## 6. Residual gaps (out of P0 scope; tracked for V3)

- **Future-value framing is still a single point estimate** ($160,337) — softened with "estimated / could / historical ~7% / actual results may vary", but a CFP would prefer a _range_ and an inflation-adjusted ("today's dollars") figure. (See `CFP_STYLE_REVIEW_REPORT.md`.)
- **`dynamic_transactions` spending-insight recommender** — still no recurring-cost detector (the persona's premise); it now returns a valid 3-category set but not the subscription/category insight from the golden set. GAP.
- **"Real-estate agent" persona** isn't a shipped sample; the tax rule _would_ catch it via `income_type` (regex includes `real estate|commission`), but no sample dataset exercises that label.
- Recommendations are **deterministic rules**, not yet a governed-LLM path; intentional for reliability, but richer/contextual advice still depends on the (separately hardened) chat surface.

---

## 7. Verdict

**READY_FOR_20_USERS** for the recommendation-quality dimension. All 11 P0 requirements are met and verified live; the two most financially fragile personas — the ones flagged in the golden set as most at risk of a harmful answer — now lead with stabilization, never investing, and display their true debt cost.
