# Post-Pilot Architecture Branch — Inheritance Stewardship & Retirement Obligation Engines

**Status: ARCHITECTURE / BACKLOG. Do NOT implement before first-5 founder-beta stabilization** unless
explicitly reprioritized. This document is the design branch so current schema + scenario design can support
these later — not bolted on like "a tax-planning raccoon in the attic." Pilot scope is unchanged.

**These engines are planning intelligence — NOT legal/tax/investment advice.** They model scenarios, organize
information, show assumptions + provenance + uncertainty, surface missing inputs, and prompt CPA / estate
attorney / financial advisor review where appropriate (see Safety Boundaries).

## The architecture spine (both engines plug into the SAME pipeline)

```
advisor capture → LLM structured extraction → durable domain tables → shared summary contract
   → scenario engine → dashboard / advisor / report outputs
```

Both engines are **engines connected to Scenario Lab and Risk Alignment — not standalone pages.** Every output
carries: assumptions · confidence · source/provenance · missing inputs · scenario sensitivity · professional-
review caveat where applicable.

**Strategic frame:**

- Your **goals** determine what you want.
- Your **obligations** determine what you can risk.
- Your **taxes and retirement spending** determine what the plan must survive.

---

# ENGINE 1 — Inheritance Stewardship

**Mission:** help the **recipient / responsible party** handle inherited assets after a death (or expected
inheritance). This is the _receiving_ side — distinct from the giver-side legacy/trust planning we already
support.

## Role-adaptive (the product changes shape by role)

Supported roles: beneficiary only · executor · trustee · successor trustee · surviving spouse · child/heir ·
POA-before-death · family organizer (no legal authority) · recipient of (cash after admin / trust distribution
/ probate distribution / beneficiary designation / inherited retirement account / life insurance / real estate
/ business interest / personal property).

| Role / situation             | Mode                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Executor / trustee           | **Organization/checklist**: estate-trust tasks, document checklist, deadlines, beneficiary comms, asset inventory, tax/legal checklist, professional-review prompts                   |
| Beneficiary only             | **Tracking/understanding**: what to gather, track expected distributions, plan what to do with received assets — never pretend they control estate administration                     |
| Cash received after the fact | **Financial-allocation**: skip probate/trust workflows; focus on allocation, taxes, reserves, debt, goals, investment                                                                 |
| Inherited retirement account | **Tax/distribution-review**: flag distribution-rule + tax-treatment may apply; collect account type + beneficiary relationship; high-level distribution scenarios; CPA/advisor review |
| Real estate                  | **Sell/keep/rent/buyout scenarios**: value, mortgage, title/ownership, intended use; flag appraisal, basis, property tax, insurance, maintenance, family conflict                     |
| Life insurance               | **Liquidity event**: tax reserve if needed, debt payoff, emergency reserve, home/family goals, long-term investment                                                                   |

## Advisor behavior (start with role + transfer path)

First questions: (1) your role? (2) trust / probate / beneficiary designation / already received? (3) asset
types? (4) received or expected? (5) urgent deadlines, family conflict, taxes, property, distributions?
Then adapt to the mode above. Emotionally aware open: _"I'm sorry you're dealing with this. We can go step by
step: first understand your role, then identify the assets, then separate urgent legal/tax items from financial
planning decisions."_ Safety: no legal advice, no tax-filing advice, no investment rec without stated
assumptions, clear CPA/estate-attorney/financial-advisor review prompts.

## Inheritance data model (additive; `finance.*`, some `family.*` links)

All tables: `user_id`, `source`, `confidence`, `created_at`, `updated_at`; RLS user-own + service-role sync;
provenance preserved. **Never overwrite canonical account/asset/liability/transaction data** — planning tables
alongside accounts, never on top.

- **`finance.inheritance_events`** — decedent_relationship, date_of_death, user_role, `transfer_path` (trust /
  probate / beneficiary_designation / direct_cash / unknown), estate_status, trust_status, probate_status,
  state, user_is_executor (bool), user_is_trustee (bool), user_is_beneficiary (bool), notes
- **`finance.inherited_assets`** — inheritance_event_id, `asset_type` (cash / brokerage / inherited_ira /
  roth_ira / 401k / real_estate / life_insurance / annuity / business_interest / personal_property / other),
  description, estimated_value, received_value, liquidity, date_received, basis_status, valuation_needed (bool),
  tax_review_status, distribution_status, professional_review_needed (bool)
- **`finance.inheritance_obligations`** — inheritance_event_id, `obligation_type` (tax_reserve / debt /
  estate_expense / family_support / property_maintenance / legal_fee / other), description, amount_estimate,
  due_date, status
- **`finance.inheritance_plans`** — inheritance_event_id, tax_reserve / emergency_reserve / debt_payoff /
  investment / home_goal / education_goal / family_support / charitable / discretionary amounts,
  hold_period_days ("do nothing for N days" grief option), advisor_notes, status

---

# ENGINE 2 — Retirement Obligation & Tax Projection

**Mission:** extrapolate from the user's situation + goals + family obligations + tax rules + Social Security
assumptions + healthcare + spending goals to estimate retirement cost, after-tax income need, and **risk-
capacity gaps** — making risk tolerance _smarter_.

## Risk Alignment — three distinct concepts (the core differentiator)

1. **Risk tolerance** — what the user emotionally prefers/can tolerate.
2. **Risk capacity** — what the user's obligations _allow_.
3. **Risk required** — what return/risk the stated goals _demand_.

Examples: high tolerance + low capacity → "comfortable with aggressive investing, but fixed obligations + near-
term withdrawals reduce your capacity"; low tolerance + high required → "your goals may require a return higher
than your conservative approach is likely to support"; high capacity + moderate tolerance → "you have
flexibility, so your capacity may be higher than your stated comfort." Influences: portfolio recommendations,
scenario warnings, retirement readiness, advisor explanations, Recommendation OS.

## Obligation model

**Inputs:** ages (self/partner), filing status, state, retirement target age, desired lifestyle, essential +
discretionary monthly spending, housing/mortgage payoff, healthcare + insurance, travel/lifestyle, family
support, education support, caregiving, legacy/inheritance + charitable goals, current income/savings,
retirement balances, taxable investments, Roth/traditional split, expected Social Security, pension/VA/
disability/other income, part-time assumption, home sale/downsize/move assumptions.

**Outputs:** projected annual retirement spending (essential vs discretionary), projected tax bill, after-tax
income need, Social Security contribution, withdrawal need by account type, retirement gap, required savings
rate, required return assumption, risk-capacity score, risk-mismatch warning, scenario recommendations.

## Current-law / assumption engine (versioned — do NOT hardcode law in projection logic)

A rules/assumptions table or versioned config supporting: federal brackets, standard deduction, capital-gains
brackets, Social Security taxation rules, SS claiming ages + benefit assumptions, RMD rules, Medicare/IRMAA
(later), state tax, inflation + healthcare-inflation assumptions. **Versioned by** `tax_year`, `source`,
`source_date`, `effective_date`, `assumption_type`, `jurisdiction`, `confidence`, `notes`. Every projection
surfaces: tax year used · law assumptions · "rules may change" caveat · confidence · source/provenance ·
scenario sensitivity. Official sources (IRS / SSA / Medicare-CMS / state agencies).

## Retirement data model (additive `finance.*`)

- **`finance.retirement_obligation_profiles`** — target_retirement_age, desired/essential/discretionary
  spending_monthly, housing_status, mortgage_status, healthcare_assumption, tax_state, filing_status,
  social_security_claiming_age, social_security_estimate_monthly, pension/va_disability/other income_monthly,
  family_obligations, legacy_goals, lifestyle_goals
- **`finance.retirement_assumptions`** — tax_year, jurisdiction, filing_status, federal_brackets_json,
  standard_deduction, capital_gains_brackets_json, social_security_taxation_rules_json, rmd_rules_json,
  medicare_irmaa_json, inflation_assumption, healthcare_inflation_assumption, source_url, source_date,
  effective_date
- **`finance.retirement_projection_runs`** — scenario_id, run_name, projection_start_year, projection_end_year,
  assumptions_version
- **`finance.retirement_projection_years`** — projection_run_id, projection_year, age, gross_income,
  social_security_income, pension_income, portfolio_withdrawals, taxable_income, federal_tax, state_tax,
  healthcare_cost, essential_spending, discretionary_spending, total_spending, after_tax_income, after_tax_gap,
  portfolio_balance, required_withdrawal, rmd, risk_capacity_score
- **`finance.risk_alignment_profiles`** — emotional_risk_tolerance, risk_capacity, risk_required, mismatch_type,
  mismatch_reason, flexibility_score, obligation_pressure_score, sequence_risk_score

**Corner-avoidance for CURRENT models:** keep `finance.financial_planning_goals` generic enough to hold
inheritance/retirement-linked targets; keep the existing `finance.retirement_plans` (mig 031) as-is and layer
`retirement_obligation_profiles` beside it (don't overload retirement_plans).

---

## Scenario Lab integration (future scenarios)

- **Inheritance:** receive $X cash · receive inherited IRA / brokerage / house · sell vs keep/rent inherited
  property · split inheritance among goals · use for debt / home / retirement / family support · inheritance
  received before retirement.
- **Retirement:** retire at 60/62/65/67/70 · claim SS at 62/FRA/70 · move states · downsize · Roth conversion ·
  higher healthcare · support adult child/parent · fund wedding/education · lower investment return · higher
  future tax.
- **Outputs per scenario:** after-tax income · goal success probability · spending gap · tax cost · risk
  mismatch · next best action.

## Architectural requirements — plug into, don't island

Both engines must integrate with: advisor capture · LLM structured extraction · durable domain tables · shared
domain summaries · Scenario Lab · Recommendation OS · reports · document intelligence (estate/trust/tax doc
extraction) · audit/provenance · risk alignment · Life Graph. **Do not build isolated feature islands.** Every
output needs: assumptions · confidence · source/provenance · missing inputs · scenario sensitivity ·
professional-review caveat where applicable.

## Roadmap sequence

- **Phase 1 — Architecture + Intake:** specs · additive schemas · versioned current-law assumption framework ·
  inheritance role/asset intake · retirement obligation profile intake · advisor flows · NO complex tax engine.
- **Phase 2 — Scenario Modeling:** inheritance allocation scenarios · retirement spending projection v1 · SS
  claiming assumptions · federal tax estimate v1 · risk tolerance/capacity/required model.
- **Phase 3 — Advanced Planning:** state taxes · Medicare/IRMAA · inherited-retirement-account distribution
  planning · Roth conversion scenarios · Monte Carlo · advisor reports · document-driven extraction from
  estate/trust/tax docs.

## Safety boundaries

**Inheritance:** planning support only · not legal advice · not tax advice · not probate representation ·
recommend estate attorney/CPA where appropriate. **Retirement/taxes:** estimates only · not tax-filing advice ·
not investment advice · current-law assumptions may change · cite assumptions/sources · recommend CPA/financial
advisor review for major decisions. Stay useful regardless: organize, estimate ranges, identify missing
documents, show tradeoffs, flag risks, recommend professional review.

## Definition of Done (for now)

Architecture branch/spec exists · backlog epics created · schema impact documented · scenario dependencies
documented · risk-alignment model documented · current-law assumption engine planned · safety boundaries
documented · **no implementation before first-5 stabilization unless explicitly reprioritized.**

**Reuses today's foundation:** the shared domain-summary contract, advisor fact→domain sync, the onboarding
depth gate, Scenario Lab, the finance canonical resolver (untouched by chat), the investment display contract,
and the advisor welcome/handoff.
