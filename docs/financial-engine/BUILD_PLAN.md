# Financial Engine — Full Coverage Build Plan

> **Premise (owner decision, 2026-10-11):** the model must never do arithmetic. Every number the
> advisor states comes from a deterministic calculator. The enforcement already exists — the number
> gate admits only figures present in `allowed_numbers` (STRICT) or `scenario_numbers` (SCENARIO),
> and only calculators put them there. **This plan is therefore about COVERAGE, not policy.**
>
> Corollary worth stating plainly: the `advisor-benchmark` finding "LN never advises" is partly a
> coverage artifact. A gate with nothing to admit must go vague. Each calculator below converts a
> class of question from _unanswerable with a number_ to _answerable with a cited one_.

## 0. Where we start

**Built and tiered — `app/services/calculators/` (10):**
`amortized_payment`, `total_interest`, `payoff_months`, `avalanche_order`, `future_value`,
`monthly_contribution_for_target`, `monthly_surplus`, `projected_balance`, `sustainable_income`,
`balance_needed`

**Built and UNtiered — `app/services/tools.py` (10):**
`emergency_fund`, `savings_rate`, `net_worth`, `debt_payoff`, `retirement_projection`, `k401_match`,
`home_affordability`, `rent_vs_buy`, `offer_comparison`, `degree_roi`

**Assumption registry — `app/services/assumptions.py` (20 entries after Phase A):** categories
`markets`, `economy`, `education`, `housing`, `retirement`, `career`, `tax`, `finance`.

### Three defects to fix before adding anything

1. **Two overlapping registries.** `debt_payoff`/`payoff_months` and
   `retirement_projection`/`projected_balance` compute the same things by different code. This is the
   divergence risk the parity fixtures exist to prevent, living inside one service.
2. **`tools.py:_f()` defaults silently to `0.0`.** A missing input becomes a confident zero. In a
   financial calculator a silent zero is the most dangerous possible default — it reads as a real
   answer. Must raise, as `calculators/base.py:require_money` does.
3. **No tax engine in Python.** The only one is `apps/web/src/lib/finance/tax.ts`, which is
   (a) hardcoded `BRACKETS_2024` / `STANDARD_DEDUCTION_2024` — **two tax years stale**,
   (b) in the web tier, unreachable from the advisor, and
   (c) missing credits (`totalCredits = 0`), state tax, capital gains, and above-the-line
   adjustments. Meanwhile `assumptions.py:marginal_tax_rate` documents itself as a fallback used
   "only when income is unknown; otherwise computed from your income bracket" — a capability the
   Python tier does not have.

## 1. Non-negotiable rules for every calculator

| #   | Rule                                                                                                                               | Why                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| R1  | **One registry.** Everything lands in `calculators/`, registered via `base.register`.                                              | Two registries diverge.                                                                       |
| R2  | **No inline assumptions.** Defaults come from `assumptions.py` via `from_registry()`.                                              | Already the stated rule; already violated once (5% real vs 6% nominal).                       |
| R3  | **STRICT vs SCENARIO on every result.** Any registry default in the inputs ⇒ SCENARIO.                                             | A projection is never the user's money.                                                       |
| R4  | **Missing input raises.** Never default to zero.                                                                                   | See defect 2.                                                                                 |
| R5  | **Rates are decimals; >1.0 is rejected as an unconverted percent.**                                                                | `require_rate` already does this. Migration 062 vs `tools.py` already disagree.               |
| R6  | **Year-versioned data lives in JSON, not source.** `tax_tables/2026.json`, `col_index/2026.json`, `contribution_limits/2026.json`. | A drift gate can fail a stale year; a hardcoded constant cannot.                              |
| R7  | **A parity fixture per calculator**, shared with the TS side where a TS twin exists.                                               | Finance math lives on both sides of the language boundary.                                    |
| R8  | **Verify independently, never self-consistently.** Simulate, or check against a published worked example.                          | Simulation caught the annuity-due error; a test written from the same formula would not have. |
| R9  | **Every output carries `assumptions[]`, `limitations[]`, and a `calculation` string.**                                             | The advisor must be able to cite and hedge. `_result()` already models this.                  |

### Drift gates to add

- `test_tax_year_current` — fails when `tax_tables/<current year>.json` is absent.
- `test_contribution_limits_current` — same for 401k/IRA/HSA/FSA limits.
- `test_no_duplicate_calculators` — fails if two registered names compute the same quantity.
- `test_every_calculator_has_parity_fixture`.
- `test_no_inline_rate_literals` — AST scan for float literals in rate position outside `assumptions.py`.

## 2. Phases

Dependency-ordered. Each phase is shippable and independently testable.

### Phase A — Foundations & consolidation ✅ **DONE (2026-10-11)**

_No new user capability; everything after this depends on it._

**Shipped:**

- `calculators/primitives.py` — `npv`, `irr`, `payback_period`, `discounted_payback_period`,
  `present_value`, `growing_annuity_pv`, `real_from_nominal`, `annualize_monthly`, + registered
  `CalcResult` wrappers. Three bugs found by independent verification: IRR missed roots strictly
  inside the search bounds; IRR's rate tolerance left NPV residuals near 1e-5; `require_rate`
  rejected the negative rates that IRR legitimately produces (added `require_discount_rate`).
- `calculators/versioned_data.py` — 9 declared families, `STRICT` vs `CARRY_FORWARD` policies, so
  January degrades loudly instead of breaking, and a prior-year figure is never unlabelled.
- **`tools.py` is now an adapter.** All arithmetic moved into `calculators/`; the 10 tools compose
  it and recompose the legacy response shape. HTTP contract, `tools.tool_runs` rows and all five
  callers unchanged. New modules: `cash`, `housing`, `career`, `education`, plus `debt.payoff_plan`.
  One tool → several calculators, because per-figure tiering is the point:
  `cash.months_covered` is STRICT while `cash.emergency_fund_target` is SCENARIO.
- **Silent zeros gone.** `_f(v, default=0.0)` → `_req`/`_opt`/`_parse`; router returns 422, not the
  404 it gave for a valid request missing one field.
- **Eight inline assumptions moved to the registry** (20 entries now): `retirement_age`,
  `working_years_horizon`, `rent_vs_buy_horizon`, `dti_front_pct`, `dti_back_pct`,
  `default_contribution_rate_pct`, `emergency_fund_months`, `degree_salary_growth`.
- **5 drift gates**, incl. an AST gate asserting `tools.py` contains no exponentiation at all.

**Defects found and fixed along the way:**

| Where                                | Defect                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scenario_compare._financial_inputs` | fabricated 5 inputs into user-visible comparisons: `current_age: 40` hardcoded for every user, so every retirement comparison ran on a stranger's horizon; `tuition_total: 0` + `salary_after: income * 1.4` made the MBA variant pay back instantly on a free degree and an invented 40% raise; `monthly_debts: 0` inflated affordability |
| `tools.debt_payoff`                  | `total_interest` accumulated after payment, then discarded — the figure that makes the case for paying extra; ran to a 600-month ceiling and reported it as a payoff date for balances that GROW; `method="highest_apr"` silently ran snowball                                                                                             |
| `tools.degree_roi`                   | `annual_gain * 25 - cost`, undiscounted — overstated a representative degree by **$610,000**                                                                                                                                                                                                                                               |
| `tools.retirement_projection`        | required income, so a balance-only projection was refused; now the target returns `None` rather than a `$0` nest egg reading as "fully funded"                                                                                                                                                                                             |
| `financial_resolver`                 | inline `6.0` contribution rate and `65` retirement age                                                                                                                                                                                                                                                                                     |
| `test_calculators.py`                | `len(C.available()) == 10` — order-dependent, would break on every phase                                                                                                                                                                                                                                                                   |

**1,483 tests pass** (was 1,361 at Phase A start). Commits `f716500a`, `2d422f4e`.

### Phase B — Tax engine ← **the critical path**

_Blocks retirement, equity comp, 529, HSA, and both composites._

- `tax_tables/2026.json`: federal brackets × filing status, standard deduction, FICA wage bases,
  capital-gains thresholds, NIIT, AMT exemption, QBI thresholds.
- `federal_income_tax` — marginal + effective from brackets.
- `fica` — Social Security (with wage base) + Medicare + additional Medicare.
- `state_income_tax` — table-driven; flat, bracketed, and no-tax states. Start with the top ~12
  states by user count, fail loudly on an unmodelled state rather than assuming zero.
- `capital_gains_tax` — short vs long term, 0/15/20 + NIIT.
- `standard_vs_itemized`.
- `effective_marginal_rate` — the one retirement/Roth/equity decisions actually need (includes
  phase-outs, not just the bracket).
- `tax_credits` — CTC, EITC, AOTC/LLC, saver's credit.
- Port `tax.ts` to call this tier, so there is one engine and the web no longer owns tax math.

### Phase C — Cash flow & paycheck

- `paycheck_net` — gross → net: pretax deductions, FICA, federal/state withholding. _Removes the
  `advisor_context._parse_monthly` guess-from-chat-text path._
- `cash_flow_forecast` — month-by-month with lumpy/annual expenses.
- `sinking_fund` — monthly reserve for known annual costs.
- `budget_variance`, `category_benchmark`.
- Re-tier `savings_rate`, `monthly_surplus` to STRICT once net income is real.

### Phase D — Debt & credit

- `snowball_order` (you only have avalanche).
- `refinance_breakeven` — closing costs vs rate saving, with the horizon.
- `extra_payment_impact`, `biweekly_payment`.
- `revolving_minimum_payoff` — variable minimum %, the realistic credit-card case.
- `consolidation_comparison`.
- `dti` — front-end and back-end.
- `credit_utilization`.
- `student_loan_idr` — SAVE/PAYE/IBR payment + forgiveness horizon + tax treatment of forgiveness.
- `pslf_projection`.

### Phase E — Housing

- `total_cost_of_ownership` — P&I + taxes + insurance + maintenance + HOA.
- `pmi_threshold` — when it starts, when it drops, what it costs in total.
- `closing_costs`.
- `arm_reset_scenarios`.
- `home_equity_capacity` / HELOC.
- Re-tier `home_affordability`, `rent_vs_buy` and route them through `total_cost_of_ownership`.

### Phase F — Investing & retirement

- `expense_ratio_drag` — cheap to build, one of the highest explanatory-value outputs in the whole
  engine.
- `real_vs_nominal` projection toggle.
- `asset_allocation_target` / `glide_path`; `rebalancing_drift`.
- `lump_sum_vs_dca`.
- `roth_vs_traditional` — marginal-rate crossover (needs Phase B).
- `social_security_claiming` — 62 / FRA / 70 breakeven.
- `withdrawal_sequencing` — taxable → tax-deferred → Roth.
- `rmd_schedule`; `roth_conversion_ladder`.
- `contribution_limit_check` — including catch-up.
- `pension_lump_sum_vs_annuity`.
- `withdrawal_guardrails` — dynamic, not just the 4% constant.

### Phase G — Insurance & risk

- `life_insurance_need` (DIME and income-replacement, both).
- `disability_gap`; `umbrella_need`.
- `deductible_vs_premium`.
- `hdhp_vs_ppo_total_cost` — premium + expected OOP + employer HSA contribution. _Also a direct
  input to Phase J._
- `long_term_care_projection`.

### Phase H — Education → _enables the college comparison_

- `net_price` — sticker − grants/scholarships, per year, with `tuition_inflation`.
- `aid_estimate` — SAI/EFC-style.
- `college_529_projection` — contributions, growth, state deduction, qualified drawdown.
- `education_loan_need` and `loan_burden_vs_starting_salary`.
- `opportunity_cost_of_study` — foregone earnings during enrolment.
- `completion_risk_adjustment` — expected value weighted by completion probability.

### Phase I — Career & equity → _enables the offer comparison_

- `equity_grant_value` — RSU vest schedule; ISO/NSO spread; AMT on exercise; 83(b).
- `total_comp_npv` — vesting + attrition probability + `salary_growth`.
- `col_adjustment` — `col_index/<year>.json`, metro-level.
- `relocation_cost` — move + home sale/purchase + break-even month.
- `career_break_cost` — lost earnings plus permanent compensation-growth impact.
- `benefit_value` — employer HSA contribution, FSA, dependent-care FSA, ESPP discount,
  tuition reimbursement, PTO cash-equivalent, commuter.
- `k401_match_value` — replaces `k401_match`; real match formulas (tiered, capped), vesting
  schedule, true-up.

### Phase J — Composites

_These are the two the owner asked for. They are last because they are integrations, not formulas —
`offer_impact` depends on ~14 calculators from A, B, C, F, G, I._

#### J1. `college_comparison`

Per school/degree option: `net_price` × years (tuition-inflated), aid, `college_529_projection`
drawdown, `education_loan_need` → `student_loan_idr` payment path, `opportunity_cost_of_study`,
expected earnings path by major/institution, `completion_risk_adjustment`.
**Outputs:** NPV, IRR, payback year, first-10-year and lifetime net-worth delta, monthly loan burden
as % of expected starting net income, and the breakeven starting salary each option requires.
Ranked, with the dominating variable named.

#### J2. `offer_impact` — total improvement to the plan and to net worth

Per offer, net of tax and net of cost of living:

| Component                                   | Calculator                                               |
| ------------------------------------------- | -------------------------------------------------------- |
| Base + bonus + equity                       | `total_comp_npv`, `equity_grant_value`                   |
| Federal + state + FICA                      | `federal_income_tax`, `state_income_tax`, `fica`         |
| Take-home                                   | `paycheck_net`                                           |
| 401k match                                  | `k401_match_value`                                       |
| Health plan true cost                       | `hdhp_vs_ppo_total_cost`                                 |
| HSA (incl. employer seed, triple advantage) | `benefit_value` + Phase B                                |
| Limited-purpose FSA, dependent-care FSA     | `benefit_value`                                          |
| Other benefits                              | `benefit_value`                                          |
| Location                                    | `col_adjustment`                                         |
| Moving                                      | `relocation_cost`                                        |
| Plan effect                                 | `projected_balance`, `balance_needed`, readiness scorers |

**Outputs:**

1. **Real spendable delta** — annual, net of tax and COL. The honest "is this a raise?" number.
2. **Tax-advantaged capacity captured** — HSA + FSA + 401k, quantified. An HDHP+HSA offer at a lower
   salary can beat a PPO offer at a higher one; this is the term that shows it.
3. **Net-worth delta at horizon** (5/10/20y), via `projected_balance`.
4. **Plan effect** — retirement readiness change, and which goal dates move and by how much.
5. **Relocation break-even month.**
6. **The deciding variable** — what the ranking actually turns on, so the advisor explains rather
   than asserts.

All SCENARIO-tier (growth, returns and attrition are registry assumptions), except the current-year
take-home and benefit arithmetic, which is STRICT.

### Phase L — Acquisition & Financing Engine

_The owner ask: for any purchase, decide **whether it is worth buying** and **how to finance it** —
credit-aware, asset-aware, with a payback period. Scope: college and advanced degrees, houses, cars,
land, commercial buildings, companies, equipment._

The unifying abstraction: **every purchase decision is `(asset model) × (financing structure) ×
(qualification constraints) → ranked outcome`.** One engine; the asset class is data, not code.
This is why L sits after B/E/F/H/I — it composes them rather than duplicating them.

#### L1. Credit & capacity layer

- `credit_tier` — FICO band → product rate tier. Bands are data (`rate_tables/<year>.json`), never
  source.
- `rate_quote` — (product × credit tier × term × LTV) → APR. Replaces the single
  `assumptions.mortgage_rate` for anything credit-sensitive. **STRICT when the user supplies a real
  quote; SCENARIO when it comes from the table.**
- `borrowing_capacity` — per product, from DTI (front/back), LTV, DSCR, reserve requirements and
  minimum down payment.
- `qualification_check` — pass/fail per structure, **naming the binding constraint**.
- `credit_improvement_value` — _the high-value output_: what a FICO delta is worth in dollars on this
  specific purchase ("+21 points moves you a tier: $14,200 over the term"). Only possible because
  L1 holds both the tier map and the rate table.

#### L2. Asset models — what it costs to hold, and what it returns

Each returns a common shape: acquisition cost, carrying cost, cash flow (may be negative), terminal
value, and holding-period risk.

| Class                       | Model                                                                      | Reuses  |
| --------------------------- | -------------------------------------------------------------------------- | ------- |
| Education / advanced degree | earnings uplift, time-to-completion, opportunity cost                      | Phase H |
| Residential property        | appreciation, full TCO, leverage effect                                    | Phase E |
| Vehicle                     | **depreciation curve**, insurance, maintenance, fuel/energy, registration  | new     |
| Land                        | carrying cost (taxes, no cash flow), appreciation, entitlement optionality | new     |
| Commercial building         | NOI, cap rate, vacancy, capex reserve, DSCR                                | new     |
| Company / business          | SDE or EBITDA multiple, owner-comp add-back, working capital, DSCR         | new     |
| Equipment                   | depreciation, Section 179 / bonus, productive yield                        | Phase B |

**Consumption vs investment must be explicit.** A boat has no IRR. `asset_model` returns a
`return_basis` of `economic` (cash flow and/or appreciation) or `utility` (consumed). For a
`utility` purchase the engine reports **affordability, total cost and opportunity cost — and
refuses to report an IRR**, rather than inventing a return. Same discipline as the no-fake-data rule:
an honest "this is a cost, here is what it costs you" beats a fabricated yield.

#### L3. Financing structures

Each returns total cost of capital, monthly obligation, collateral at risk, recourse, and rate-reset
exposure.

- `finance_cash` — the opportunity cost is `investment_return` foregone. **The structure most often
  mispriced as "free."**
- `finance_secured_loan` — auto, equipment.
- `finance_mortgage` — conventional / FHA / VA / jumbo; fixed and ARM.
- `finance_heloc` — second-lien capacity against existing equity.
- `finance_pledged_asset_line` — margin / portfolio line; includes maintenance-call risk.
- `finance_sba_7a`, `finance_sba_504` — business and owner-occupied commercial.
- `finance_seller_note` — seller financing, earnout, holdback.
- `finance_lease` — lease vs buy; money factor, residual, mileage terms.
- `finance_promotional_zero_pct` — models the **deferred-interest retroactive-charge trap**, which is
  the whole reason this structure needs a calculator rather than a footnote.
- `finance_blended` — a stack (cash + loan + seller note), with a weighted cost of capital.

#### L4. The decision calculators

**`purchase_worth_it`** — should this be bought at all?
Outputs: **payback period**, NPV, IRR (economic assets only), total cost of ownership over the hold,
**opportunity cost of the capital deployed**, breakeven hold period, breakeven resale/terminal value,
and a "what has to be true" sensitivity naming the variable the answer hinges on.

**`financing_optimizer`** — given it is worth buying, how should it be financed?
Ranks every structure that passes `qualification_check` by total cost of capital, monthly cash-flow
impact, net worth at horizon, and risk (collateral, recourse, rate reset, call risk). Reports the
binding constraint for each structure that failed, and what would clear it.

**`acquisition_impact`** — the plan-level effect, mirroring `offer_impact`:
net-worth delta at 5/10/20y, which goal dates move and by how much, retirement-readiness change,
**liquidity after close measured against the emergency-fund floor**, and the new DTI.

#### New versioned data

`rate_tables/<year>.json` (product × FICO band × term × LTV), `depreciation_curves.json`,
`cap_rate_benchmarks.json`, `sba_program_rules.json`, `loan_product_rules.json` (DTI/LTV/reserve
minimums per product). All under R6 and the drift gates.

#### Scope flag — business acquisition

Valuing a company is a materially harder problem than the rest of this phase: multiples are
industry- and size-specific, quality-of-earnings adjustments are judgement-heavy, and the data is
licensed. Recommend shipping L with **business as a DSCR-and-structure calculator** (can this deal
service its debt, and how should it be stacked?) and treating **valuation as a separate, later
decision** rather than implying the engine can price a company.

#### Disclosure posture (owner decision, 2026-10-11)

**Settled:** LifeNavigator does not custody or manage money and charges no fee for advice — revenue
is a flat tool subscription. The posture is therefore **decision support with disclosure**: the user
owns diligence, and is told to verify with their own advisor / CPA / attorney before acting.

The machinery for this is largely built. `apps/web/src/lib/advice/disclosure.ts` already implements
four context-aware tiers (`none` / `subtle` / `explicit` / `formal`) with keyword routing, rendered
by `AdviceDisclaimer.tsx` — deliberately _not_ a blanket notice under every message, which is the
right call. Phase L needs four specific additions:

1. **Financing keywords are absent from `EXPLICIT_KEYWORDS`.** Add: mortgage, refinance, HELOC,
   loan, lease, APR, credit score, FICO, down payment, closing costs, SBA, seller financing, margin,
   pledged asset, acquisition, valuation, LTV, DTI, DSCR. Without these, a Phase L answer routes to
   `subtle` or `none`.
2. **A fifth tier: `diligence`** — for L4 outputs (`purchase_worth_it`, `financing_optimizer`,
   `acquisition_impact`) and both Phase J composites. Copy must carry the three elements the owner
   specified: _verify independently_, _diligence is yours_, _consult your own advisor / CPA /
   attorney_. Current `FORMAL_COPY` says "consult a licensed professional" but does not assign
   diligence to the user, which is the load-bearing sentence here.
3. **The level is computed CLIENT-SIDE from keyword matching** — the file says so explicitly:
   _"because no domain/risk classification reaches the frontend today."_ But the server already
   classifies every turn (`model_router.classify_domain` / `classify_risk`). Phase L should return
   the computed `disclosure_level` on the response so the client stops guessing. A keyword miss on a
   financing answer is a silent downgrade to no disclosure.
4. **`PROHIBITED_LANGUAGE` is TypeScript-only and has 4 patterns** (`guaranteed`, `certain`,
   `will earn`, `risk-free`). Phase L needs a Python-tier equivalent in the validator, extended for
   financing-specific overclaims: _pre-approved_, _you qualify_, _best rate_, _you should borrow_,
   _lowest cost guaranteed_. The gate must block `qualification_check` passing a _structure class_
   from being rendered as an _approval_.

**Product-steering line.** The engine recommends **structure classes** ("a 504 fits this better than
a 7(a)"), never named lenders or products. That keeps it analysis rather than brokerage, and is a
code-level rule, not a copy rule: `rate_quote` is sourced from published rate _tables_, and there is
no lender entity in the model.

### Phase K — Probabilistic layer

`monte_carlo` engine (one, shared), `success_probability`, `sequence_of_returns_risk`,
`confidence_bands`. Today `projected_balance` returns a single deterministic path; users asking "will
I be OK?" need a probability, and a point estimate quietly overstates certainty.

### Deferred

Estate tax exposure, probate cost, guardianship funding, childcare projection, tax-loss harvesting,
AMT/QBI detail, business/self-employment (QBI, SE tax, entity choice).

## 3. Scale

| Phase     | New calculators            | Blocks                     |
| --------- | -------------------------- | -------------------------- |
| A         | 7 + consolidation          | everything                 |
| B         | 8                          | F, H, I, J                 |
| C         | 5                          | J                          |
| D         | 9                          | —                          |
| E         | 5                          | J2                         |
| F         | 12                         | J                          |
| G         | 5                          | J2                         |
| H         | 6                          | J1                         |
| I         | 7                          | J2                         |
| J         | 2 composites               | —                          |
| **L**     | **~28 + 3 decision calcs** | **the acquisition engine** |
| K         | 4                          | —                          |
| **Total** | **~98 + 5 composites**     |                            |

## 4. Open questions for the owner

1. **State tax scope.** All 50 + DC is a large data-maintenance commitment. Recommend the top ~12 by
   user count, and a loud `UNMODELLED_STATE` rather than a silent zero.
2. **COL index source.** Needs a licence-compatible metro-level dataset, refreshed annually.
3. **Earnings-by-major data** for J1. Public (IPEDS / College Scorecard) is free and credible but
   coarse; anything better is licensed.
4. **Is a composite one calculator or an orchestration?** Recommend: a composite is a _calculator_
   returning one `CalcResult`, so the number gate governs its outputs like any other.
5. **Who owns annual data refresh** (tax tables, contribution limits, COL, rate tables)? The drift
   gates will fail CI every January by design — that needs an owner.
6. **~~Compliance posture~~ — SETTLED 2026-10-11.** Subscription-only, no custody, no advice fee;
   decision support plus a diligence disclosure. See Phase L → Disclosure posture.

---

_Grounded in the code as of 2026-10-11. Figures for existing coverage were read from source, not
estimated._
