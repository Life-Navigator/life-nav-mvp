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

### Phase B — Tax engine ← **the critical path** · **ENGINE DONE (2026-10-11), DATA PENDING VERIFICATION**

_Blocks retirement, equity comp, 529, HSA, and both composites._

**Shipped (8 calculators):** `federal_income_tax`, `fica`, `capital_gains_tax`,
`effective_marginal_rate`, `standard_vs_itemized`, `state_income_tax`, `tax_credits`, plus
`validate_state_table`.

**Why the marginal rate is MEASURED, not looked up.** The statutory bracket is not what the next
dollar costs. At $150k single it is 24% but the true combined rate is 31.65%; at $400k the bracket is
_higher_ (35%) while the FICA component has fallen from 7.65% to 2.35% because Social Security
stopped. `effective_marginal_rate` re-runs the whole return with a $1,000 increment and divides.
This is the figure `assumptions.py:marginal_tax_rate` has been standing in for.

**FICA is regressive, and that is the point.** $400k single, 2024: `168,600 × 6.2%` capped +
`400,000 × 1.45%` + `200,000 × 0.9%` = $18,053.20 — a 4.51% effective rate against 7.65% at $150k.
The flat-7.65% shortcut charges $30,600, overstating by $12,547.

**Capital gains stack.** LT gains are measured against ordinary taxable income PLUS the gain, so an
identical $50k gain attracts ~0% or 23.8% depending on the rest of the return. Computing it against
the gain alone errs in the user's favour — the worse direction.

#### The data is gated; the engine is not

2026 figures could not be verified (they post-date the OBBBA changes of July 2025), so
`tax_tables/2026.json` ships `_meta.verified: false` listing which fields are high- and
low-confidence. **Every calculator loads with `require_verified=True`**, so an unverified table
cannot produce a user-facing figure. Engine correctness is proven against **2024** — historically
fixed and cross-checked against what `tax.ts` shipped — so a data gap can never look like an engine
bug, nor the reverse.

#### State coverage: 29 states, per-state verification

| Regime        | Count | States                        | Status                        |
| ------------- | ----- | ----------------------------- | ----------------------------- |
| No income tax | 9     | AK FL NV NH SD TN TX WA WY    | **verified, usable**          |
| Flat          | 10    | AZ CO GA IL IN KY MI NC PA UT | unverified → refuses to quote |
| Bracketed     | 10    | CA NY NJ MA VA MD OH WI MN OR | unverified → refuses to quote |
| Absent        | rest  | NM ID IA SC AL MS CT RI DE …  | `UnmodelledStateError`        |

Per-state flags because the confidence genuinely differs: "Texas has no income tax" is statutory and
stable; "Illinois is 4.95%" is a number a legislature changes.

Documented in-table rather than silently omitted: **NYC's ~3.1–3.9% local tax**, **every Maryland
county's 2.25–3.20%**, Ohio municipal taxes, CA's 1% Mental Health Services surtax above $1M, and
MA's 4% millionaire surtax (which IS modelled, as 5% → 9%). **NJ and MD publish separate joint
schedules rather than doubling the single one** — their `married_jointly` entries are copies and are
flagged `WRONG, replace before verifying`, because assuming every state doubles is a real and common
error.

#### `validate_state_table` — structure, which is a different question from correctness

Verification asks "is 4.95% right for Illinois?" — only a primary source settles that. Validation
asks "is this schedule well-formed?" — answerable exhaustively, and it is where hand-transcription
actually fails: 29 states × 4 statuses × up to 9 brackets is thousands of numbers. Catches a rate
typed as `4.95` instead of `0.0495` (would charge 495%), descending or duplicate thresholds (truncate
the bracket walk and **silently undercharge**), a regressive rate step, a closed top bracket (leaves
high income untaxed), an `upto: null` that is not last, a missing filing status, a state declared in
two regimes, and a missing `verified` flag. None of these error on their own — they just compute the
wrong tax, so `state_income_tax` validates the state it is about to use **on every call**, not only
in CI.

**Gates:** Gate 6 (verified, not merely present) and Gate 7 (state schedules well-formed). Both data
gates assert an exact match against a declared `PENDING` list — a gate that fails permanently gets
disabled, so anything _new_ fails immediately while each known gap is recorded with what it needs.

**1,578 tests pass.** Commit `33460715` + state tables.

#### Credits, and why they belong in the marginal rate

`tax_credits` covers the child credit, other-dependent credit, AOTC, LLC and the saver's credit,
with the refundable/nonrefundable split handled properly. `tax.ts` set `totalCredits = 0`, so a
family with two children was shown **$4,000 more tax than they owe** — its largest error for anyone
with dependents.

Three mechanics that need code rather than a rate:

- **The child phase-out is a STAIRCASE.** $50 per $1,000 _or fraction_ above the threshold is
  statutory, so $1 over a boundary costs the full $50. Modelling it as a linear ramp understates the
  loss at every point inside a step.
- **The reduction applies to the AGGREGATE credit, not per child.** More children lengthen the band
  (2 children exhaust over $80k, 4 over $160k) but do not steepen it — the implicit surtax is 5%
  either way. Reading it as 5% per child overstates a large family's marginal rate by a multiple.
  _(This corrected an error in the first draft of the code comments and the test.)_
- **The saver's credit is a CLIFF.** One dollar of AGI over a tier ceiling drops the rate from 50%
  to 20% — a $600 loss on a $1 raise. The result flags `is_cliff` explicitly.

`effective_marginal_rate` now takes `include_credits` (default **off**, pending verified
parameters), so the measured rate captures the phase-out as the implicit surtax it is. This is the
payoff for measuring rather than reading a bracket.

**EITC is deliberately excluded and gated off.** Its phase-in/phase-out parameters are the
least reliable figures in the table, it is fully refundable, and it targets the filers least able to
absorb an error. `credits.earned_income_credit.enabled: false` until sourced from Pub 596.

**1,605 tests pass.** Commits `33460715`, `b8d83736`, + credits.

#### Still open in Phase B — all owner tasks or decisions

1. **Verify `tax_tables/2026.json`** against the IRS Rev. Proc. for TY2026 + the SSA wage base. This
   gates every 2026 figure.
2. **Verify the 20 rate-bearing states**, and replace NJ's and MD's copied joint schedules.
   `validate_state_table` will catch transcription errors.
3. **Verify the credit parameters** (Schedule 8812, Pub 970, Form 8880) in both years. Unlike the
   ordinary brackets, credits had **no independent cross-check** available in this repo, so the
   section is unverified in 2024 as well as 2026 and the engine is proven against synthetic
   fixtures.
4. **Source EITC** from Pub 596, then enable it.
5. **Port `tax.ts` onto this tier.** Not mechanical — the web tier would call core-api over HTTP,
   making the browser-side tax page server-dependent. An architecture decision, not a move.

### Phase B2 — Tax TREATMENT layer (rules, not rates) ← **designed 2026-10-11, not built**

Owner ask: HSA, 401(k), HDHP, 7(a), securities-based lending, HELOC, short-term rentals, and the
rest. **Full design in [TAX_TREATMENT_LAYER.md](TAX_TREATMENT_LAYER.md).**

Phase B answers "how much?" from a rate schedule. B2 answers "what is the treatment?" — deductible,
excludable, what character, which limit binds, what trap bites later. That is a rules engine with
its own output contract (`TreatmentResult`: determination + the tests that decided it + authority +
traps), not another table.

**Key insight that makes it tractable:** rules are statutory and stable; parameters are annual.
§163(d), the HELOC tracing rule and the 7-day STR rule can be encoded now with high confidence,
over a `tax_parameters/<year>.json` that carries the dollar thresholds under the same verification
gate as the rate tables. A determination can be right about the rule and explicit that the limit is
unverified.

**~35-45 rules in three groups:** account wrappers (HSA/HDHP/FSA/401k/IRA/529/solo-k),
debt-interest tracing (mortgage/HELOC/SBL-margin/7(a)/504/student), activity character
(STR 7-day rule/LTR passive/SE+QBI/equity comp), plus cross-cutting (SALT, charitable, wash sale,
§1031, §121, step-up).

**SEQUENCING CHANGE:** B2-a (wrappers) and B2-b (debt interest) must land **before F and L**, not
after. `offer_impact` cannot value "HSA with HDHP and limited FSA" without the eligibility test and
the payroll-FICA exclusion; `financing_optimizer` cannot rank HELOC vs margin vs 7(a) without
after-tax cost of capital. A HELOC at 8% deductible beats a margin loan at 7% non-deductible, and
nothing in the plan could see that until B2.

**Found while designing:** `comp_benefits.py:23-25` hardcodes `FSA_CAP = 3300`,
`HSA_CAP_INDIVIDUAL = 4300`, `HSA_CAP_FAMILY = 8550` — annual limits in source, in the web-facing
benefits service, invisible to the tax engine. Same defect class as `BRACKETS_2024`.

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
