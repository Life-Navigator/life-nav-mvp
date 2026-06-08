# EDUCATION × CAREER × FINANCE — INTEGRATION PLAN

How Education plugs into the live Finance graph and the (next) Career graph so the comparison
engine reasons across a user's whole life. Builds on CROSS_DOMAIN_DECISION_ONTOLOGY +
DECISION_ENGINE_ARCHITECTURE. Design only.

## Cross-domain edges

**Education → Career**

```
(:Program)-[:QUALIFIES_FOR]->(:JobTarget)
(:Certification)-[:CLOSES_SKILL_GAP]->(:Skill)
(:DegreeOption)-[:IMPROVES_JOB_READINESS]->(:CareerGoal)
```

**Career → Finance**

```
(:JobTarget)-[:IMPACTS]->(:IncomeSource)
(:CompensationRecord)-[:AFFECTS_CASHFLOW]->(:CashFlowSnapshot)
```

**Education → Finance**

```
(:Program)-[:IMPACTS]->(:CashFlowSnapshot)        (debt + reduced income during school)
(:Program)-[:FUNDED_BY]->(:FinancialGoal)
(:TuitionCost)-[:AFFECTS_NET_WORTH]->(:NetWorthSnapshot)
```

Rule: an edge is emitted **only when both endpoint domains are live and the FK exists** — no
cross-domain edge into an unbuilt domain, no fake edges.

## Questions unlocked

- **Can I afford this program?** → net_cost + debt vs Finance cash-flow/debt-capacity.
- **Will this degree improve my career enough to justify cost?** → income_lift (Compensation
  Engine, via Program→JobTarget) vs total cost → risk-adjusted ROI + breakeven.
- **Which option best supports retirement?** → Program→IMPACTS→NetWorthSnapshot scenarios.
- **How does student debt affect my financial goals?** → debt_burden vs FinancialGoal funding.
- **Is this program worth delaying home purchase / a family goal?** → tradeoff across
  Education + Finance + Family goals (the decision engine's leverage ranking).

## Reasoning path (decision engine)

```
Program --QUALIFIES_FOR--> JobTarget --IMPACTS--> IncomeSource --AFFECTS_CASHFLOW--> CashFlowSnapshot
Program --IMPACTS--> NetWorthSnapshot   Program --FUNDED_BY--> FinancialGoal
```

The DECISION_ENGINE_ARCHITECTURE pipeline (collect → aggregate evidence → score leverage by
reach×confidence×goal-priority → arbitrate → rank) consumes these edges. A program that lifts
income (career), is fundable (finance), and fits the time horizon (family) scores higher than a
single-axis option — and the ranking is explainable from the traversed evidence.

## Dependencies / sequencing

- **Education → Finance** edges work the day Education ships (Finance is live).
- **Education → Career** edges (QUALIFIES_FOR, CLOSES_SKILL_GAP) light up when **Career** is
  live (hence Career-before-Education in the Phase-3 sequence — see
  PHASE_3_IMPLEMENTATION_SEQUENCE).
- Compensation lift uses the COMPENSATION_INTELLIGENCE_ENGINE (shared), which depends on the
  central JOB_MARKET_INTELLIGENCE layer.

## Tenant + governance

All personal cross-domain edges are single-tenant (one owner). Central market/benchmark data is
cited by value, never linked into personal nodes. Education recommendations that hinge on
career comp carry the comp source + confidence as evidence and the `education_guidance` boundary.
