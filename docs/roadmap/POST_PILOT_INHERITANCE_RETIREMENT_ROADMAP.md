# Post-Pilot Roadmap — Inheritance Stewardship & Retirement Obligations Engine

**Status: BACKLOG / DESIGN ONLY. No implementation before first-5 founder-beta stabilization** unless
explicitly reprioritized. This document satisfies the "design now so data models don't paint us into a
corner" requirement. Pilot scope is unchanged.

Both features are **planning intelligence, not legal/tax/financial advice**: model scenarios, show
assumptions, cite source rules/data, explain uncertainty, and recommend CPA / estate attorney / financial
advisor review where appropriate (see Safety Boundaries).

---

## EPIC 1 — Inheritance Stewardship / Survivor Windfall Planning

Help a **recipient** (not the giver) understand, organize, and responsibly allocate inherited assets after a
death. Emotionally aware, document-first, tax/basis-aware, scenario-driven.

**Stories**

1. Inheritance intake (decedent relationship, dates, state(s), estate/probate status, user role, expected/
   received assets, liabilities, deadlines, family dynamics, goals).
2. Asset intake by type (cash, taxable brokerage, inherited IRA/401k/Roth, real estate, business interest,
   life insurance, annuity, personal property, vehicles, trust distributions, family note, needs-review).
3. Document checklist (death certificate, will, trust docs, beneficiary designations, statements, deeds,
   mortgage, insurance claim forms, retirement beneficiary forms, estate inventory, probate letters, tax
   forms, appraisals, attorney/CPA/advisor contacts).
4. Basis / tax-awareness layer (date-of-death FMV basis concept, retirement-account distribution rules,
   insurance vs investment treatment, RMD/10-year window by beneficiary type, state exposure) → **never a
   definitive conclusion**; outputs "questions + documents to take to your CPA/estate attorney."
5. Allocation engine → planning buckets: immediate obligations · tax/legal reserve · emergency foundation ·
   high-interest debt payoff · long-term investment · goal funding · family/legacy wishes · discretionary cap
   · "do nothing for 90 days" grief option.
6. Inheritance card (under Family + Finance): status (planning/pending/received/settled), assets + est.
   value, liquidity, tax/legal review status, missing docs, next deadline, next step, linked goals impacted.
7. Emotionally-aware Inheritance Advisor (acknowledge grief, organize first, one question at a time, separate
   emotional from financial decisions).

**Scenario Lab deps:** inherit $X · sell vs keep/rent inherited house · invest inherited brokerage · inherited
IRA distribution-over-time · fund children's education · support surviving parent · preserve as legacy fund ·
pay off debt vs invest. (Depends on the existing Scenario Lab + the allocation engine + the assumption engine.)

---

## EPIC 2 — Retirement Obligations & Tax-Aware Spending Projection

Align **risk** with reality: separate **risk tolerance (emotional preference)** from **risk capacity (what
obligations allow)** and **risk required (what goals demand)**.

**Stories**

1. Retirement obligation profile (ages, marital/dependents, state, target retirement age, life-expectancy
   assumption, income + growth, savings/accounts, pension/VA/disability, SS estimate, housing/mortgage, debt
   plan, insurance, family/eldercare/education obligations, charitable, legacy).
2. Spending model by category (housing, utilities, food, transport, healthcare, insurance, taxes, travel,
   family support, lifestyle, education, caregiving, emergency, inflation, one-time goals).
3. Income-source model (Social Security, pensions, VA/disability, taxable withdrawals, traditional, Roth,
   HSA, annuities, rental/business, inheritance, part-time).
4. Tax-aware projection by year (ordinary income, qualified dividends, LTCG, taxable SS portion, RMDs, state
   tax, std deduction, brackets, effective + marginal rate, after-tax spending capacity, Roth-conversion
   opportunity, tax drag) — base / conservative / high-tax / current-law cases + law-change sensitivity.
5. Social Security modeling (62/FRA/70 claiming, spouse/survivor, COLA, earnings test, taxation, optional
   benefit-cut scenario; break-even + replacement-rate contribution).
6. **Risk Alignment panel**: risk_capacity vs risk_tolerance vs risk_required → mismatch warnings.

**Scenario Lab deps:** delay SS · retire at 60/65/67/70 · move states · Roth conversion · downsize · fund
child education · support family. (Depends on the assumption engine + a Monte-Carlo/drawdown engine later.)

---

## DATA MODEL IMPACT (additive `finance.*` — design only, NOT migrated yet)

All tables: `user_id`, `source`, `confidence`, `created_at`, `updated_at`; RLS user-own + service-role sync;
provenance preserved. Mirrors the existing `finance.*` pattern. **Never overwrite canonical account/asset/
liability/transaction data** — these are planning tables alongside, never on top of, accounts.

- `finance.inheritance_events` (decedent_relationship, date_of_death, user_role, status, estate_status, state)
- `finance.inherited_assets` (inheritance_event_id, asset_type, description, estimated_value, liquidity,
  basis_status, tax_review_status, distribution_status)
- `finance.inheritance_plans` (inheritance_event_id, tax_reserve/debt_payoff/emergency/investment/home_goal/
  family_support/charitable/discretionary amounts, advisor_notes, status)
- `finance.retirement_obligation_profiles` (target_age, desired/essential/discretionary spending, housing,
  healthcare_assumption, tax_state, ss_claiming_age, ss_estimate, pension/other income, legacy/family obligs)
- `finance.retirement_tax_assumptions` (**versioned by tax_year + source_url + source_date**; filing_status,
  federal_brackets_json, standard_deduction, capital_gains_brackets_json, ss_taxation_rules_json, rmd_rules_json)
- `finance.retirement_projection_runs` (scenario_id, projection_year, gross/taxable income, federal/state tax,
  SS income + taxable, withdrawals, rmd, after_tax_spending, portfolio_balance, risk_capacity_score)

**Corner-avoidance note for the CURRENT models:** keep `finance.financial_planning_goals` (already designed)
generic enough to hold inheritance/retirement-linked targets; keep the existing `finance.retirement_plans`
(mig 031) as-is and layer `retirement_obligation_profiles` beside it (don't overload retirement_plans).

---

## CURRENT-LAW / ASSUMPTION ENGINE (shared by both epics)

A **versioned, sourced** rules data layer: federal brackets, std deduction, cap-gains brackets, SS taxation
thresholds, SS wage base/benefit assumptions, RMD age, Medicare/IRMAA thresholds, estate/gift thresholds,
state tax assumptions, inflation + healthcare-inflation assumptions. Each row carries `tax_year`,
`source_url`, `source_date`, `confidence`. Official sources (IRS / SSA / Medicare-CMS / state agencies).
Every projection surfaces: tax-year assumptions used · source date · confidence · "law may change" caveat ·
scenario sensitivity.

---

## SAFETY BOUNDARIES (every screen)

State clearly: planning estimates only · not legal/tax/investment advice · review with a qualified CPA /
estate attorney / financial advisor before acting. But stay useful: organize info, estimate ranges, identify
missing documents, show tradeoffs, flag risks, recommend professional review. **Never**: definitive tax/legal
conclusions, "must" statements, licensed appraisal/valuation, probate representation, tax filing.

---

## IMPLEMENTATION SEQUENCE (post-pilot)

- **Phase 1**: specs + additive migrations + assumption-source framework + simple inheritance intake + simple
  retirement spending profile.
- **Phase 2**: inheritance allocation scenarios + retirement tax projection v1 + SS claiming assumptions +
  risk capacity vs tolerance comparison.
- **Phase 3**: state tax + Medicare/IRMAA + inherited-IRA distribution planning + Roth conversion + Monte
  Carlo + advisor-facing report.

**Reuses today's foundation:** the shared domain-summary contract, fact→domain sync, Scenario Lab, the
finance canonical resolver (untouched by chat), and the advisor welcome/handoff.
