# FAMILY DOMAIN — ENTERPRISE PLAN

Family is **life-readiness planning**, not household tracking. It answers "is my family
protected and on track?" by linking the household to the live Finance/Health/Education graphs.
Built on the proven platform. Design only.

## Vision

Model the household and its dependents, then continuously assess protection (insurance, estate),
readiness (emergency fund, guardianship), and family goals (college, caregiving) — surfacing
evidence-backed, governed recommendations and the highest-leverage family decisions.

## Core outcomes

Dependent protection · insurance readiness · emergency readiness · estate readiness · college
planning · caregiving planning · family-goal achievement.

## Entities (domain nouns)

`Household · FamilyMember · Dependent · Guardian · FamilyGoal · ProtectionItem · InsuranceNeed ·
InsurancePolicy · EstateReadinessItem · EstateDocument · CollegePlan · CaregivingPlan ·
EmergencyReadiness · FamilyRecommendation`. (`Household`, `InsuranceNeed`, `EstateDocument` are
shared with Finance — defined once in the ontology standard.)

## User outcomes

- A **household graph**: spouse/partner, dependents, guardianship.
- **Protection gaps**: life/disability insurance need vs coverage; estate-doc readiness.
- **Readiness scores**: emergency fund months (Finance), guardianship designated, beneficiaries set.
- **Family goals**: college funding (links to Education), on-track/at-risk vs the Finance plan.

## Recommendation families

`insurance_gap` (life/disability need > coverage) · `estate_readiness` (missing will/POA/
beneficiaries) · `emergency_fund_family` (reserve vs household expenses + dependents) ·
`college_funding_plan` (529/savings vs projected Education cost) · `guardianship_designation` ·
`caregiving_readiness` · `workforce_decision` (one parent leaving — cash-flow + retirement
impact).

## Evidence graph (shared model)

```
(:UserProfile)-[:HAS_FAMILY_MEMBER]->(:FamilyMember)
(:UserProfile)-[:HAS_DEPENDENT]->(:Dependent)
(:Household)-[:HAS_GOAL]->(:FamilyGoal)
(:ProtectionItem)-[:ADDRESSES]->(:InsuranceNeed)
(:FamilyGoal)-[:FUNDED_BY]->(:FinancialGoal)
(:Dependent)-[:IMPACTS]->(:ExpenseCategory)
(:EstateReadinessItem)-[:REQUIRES_REVIEW]->(:AdviceBoundary)
(:FamilyRecommendation)-[:HAS_EVIDENCE|HAS_ASSUMPTION|HAS_TRADEOFF|REQUIRES_REVIEW]->(...)
```

## Governance boundaries

`boundary_type: "family_planning"` for general guidance; **`legal`/`estate`** boundary with
escalation to an **attorney** for wills/POA/guardianship/estate (never legal advice); insurance
need-analysis is planning guidance, escalate to a **licensed agent/advisor** for product
selection. Sensitive (dependents, health-linked) → High sensitivity in the worker enum.

## Data required / never guess

- Dependents, ages, guardianship status (user-asserted).
- Coverage amounts, policy details (user-asserted / document fact).
- Insurance **need** = computed from income replacement + dependents + debts (Finance), cited.
- College cost projections → from the **Education** comparison engine, not guessed.
- Estate-doc status (has will? POA? beneficiaries?) — user-asserted, with confirmation.

## Quality

Same 15 gates: enum-before-trigger, typed edges (no RELATED_TO), evidence-backed recs, chat
grounding, :Unknown=0, cross-tenant=0, unlock only at 15/15.
