# CROSS-DOMAIN DECISION ONTOLOGY

How LifeNavigator's domains connect into one reasoning graph. This is the blueprint
that turns five separate domain graphs into a **life decision graph**. No
implementation here — this defines the edges future domains MUST emit so cross-domain
questions become graph traversals.

**Rule:** cross-domain edges are still tenant-scoped (one owner). They connect a
user's own finance/health/career/family/education nodes — never another user's.

## Domain bridges

### Education → Career

```
(:Certification)-[:CLOSES_SKILL_GAP]->(:Skill)
(:Certification)-[:QUALIFIES_FOR]->(:JobTarget)
(:Program)-[:IMPROVES_JOB_READINESS]->(:CareerGoal)
(:EducationROIModel)-[:EVALUATES]->(:Program)
```

### Career → Finance

```
(:CareerGoal)-[:IMPROVES_COMPENSATION]->(:CompensationRecord)
(:JobTarget)-[:IMPACTS]->(:IncomeSource)
(:CompensationRecord)-[:AFFECTS_CASHFLOW]->(:CashFlowSnapshot)
```

### Family → Finance

```
(:FamilyGoal)-[:FUNDED_BY]->(:FinancialGoal)
(:Dependent)-[:IMPACTS]->(:ExpenseCategory)
(:ProtectionItem)-[:ADDRESSES]->(:InsuranceNeed)
(:EstateReadinessItem)-[:REQUIRES_REVIEW]->(:AdviceBoundary)
```

### Health → Finance

```
(:HealthInsurancePlan)-[:COVERED_BY]->(:EmployerBenefit)
(:MedicalExpense)-[:ELIGIBLE_FOR_HSA_FSA]->(:HealthSpendingAccount)
(:WellnessGoal)-[:IMPACTS]->(:CashFlowSnapshot)   // only when a financial effect exists
```

### Scenario → All (decision intelligence spine)

```
(:LifeScenario)-[:EVALUATES]->(:Goal)
(:LifeScenario)-[:PROJECTS]->(:NetWorthSnapshot)
(:LifeScenario)-[:HAS_TRADEOFF]->(:Tradeoff)
(:LifeScenario)-[:IMPACTS]->(:FinancialGoal | :HealthGoal | :CareerGoal | :FamilyGoal | :EducationGoal)
```

## The questions this unlocks

**"Can I afford this education program and still retire on time?"**

```
(:Program)-[:HAS_TUITION_COST]->(:TuitionCost)-[:AFFECTS_CASHFLOW]->(:CashFlowSnapshot)
(:Program)-[:FUNDED_BY]->(:FinancialGoal)
(:RetirementAccount)-[:SUPPORTS_GOAL]->(:FinancialGoal {type:"retirement"})
(:LifeScenario)-[:PROJECTS]->(:NetWorthSnapshot)   // with vs without the program
```

Traverse program cost → cash flow → retirement goal funding; compare scenario
projections. Answer is grounded in graph nodes, not a guess.

**"Would changing jobs improve my family financial plan?"**

```
(:JobTarget)-[:IMPROVES_COMPENSATION]->(:CompensationRecord)-[:AFFECTS_CASHFLOW]->(:CashFlowSnapshot)
(:FamilyGoal)-[:FUNDED_BY]->(:FinancialGoal)-[:SUPPORTS_GOAL]-(...)
```

**"Which health benefit decision improves my financial resilience?"**

```
(:HealthInsurancePlan)-[:COVERED_BY]->(:EmployerBenefit)
(:MedicalExpense)-[:ELIGIBLE_FOR_HSA_FSA]->(:HealthSpendingAccount)-[:AFFECTS_CASHFLOW]->(:CashFlowSnapshot)
```

**"What is the highest-leverage action across my life right now?"**
Rank `:Recommendation`/`:Opportunity` nodes by traversing their `ADDRESSES` /
`SUPPORTS_GOAL` / `IMPACTS` edges and scoring the breadth of `affected_domains` ×
confidence × goal priority. The graph makes "leverage" computable.

## Implementation order (mirrors domain rollout)

1. Finance internal ontology complete (in progress).
2. Decision-intelligence spine: `LifeScenario`/`Goal`/`Tradeoff`/`Evidence` nodes +
   `EVALUATES`/`PROJECTS`/`IMPACTS` edges.
3. Health → Finance bridges (first cross-domain pair) when Health unlocks.
4. Career → Finance, Education → Career, Family → Finance.

**Gating:** a cross-domain edge may only be emitted when BOTH endpoint domains have
passed `GRAPH_QUALITY_GATES.md`. No bridge to an unvalidated domain.
