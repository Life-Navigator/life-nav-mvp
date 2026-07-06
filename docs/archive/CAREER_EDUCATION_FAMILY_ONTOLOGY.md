# CAREER × EDUCATION × FAMILY — CROSS-DOMAIN ONTOLOGY

The semantic edges that wire the three new domains to each other and to the live Finance/Health
graphs, turning them into one life-decision graph. Extends LIFENAVIGATOR_ONTOLOGY_STANDARD +
CROSS_DOMAIN_DECISION_ONTOLOGY. Design only.

## Influence chains (what the decision engine traverses)

```
Education ──▶ Career ──▶ Compensation ──▶ Cash Flow ──▶ Family Goals ──▶ Retirement
Skills    ──▶ Roles  ──▶ Compensation ──▶ Education ROI (the loop closes: ROI re-ranks programs)
Family Constraints ──▶ Education Recommendation (time/geo/budget gate the comparison engine)
```

## Edge catalog (source → REL → target)

**Education → Career**

```
(:Program)-[:QUALIFIES_FOR]->(:JobTarget)
(:Certification)-[:CLOSES_SKILL_GAP]->(:Skill)
(:DegreeOption)-[:IMPROVES_JOB_READINESS]->(:CareerGoal)
(:Program)-[:BUILDS_SKILL]->(:Skill)
```

**Career → Compensation/Finance**

```
(:CareerGoal)-[:IMPROVES_COMPENSATION]->(:CompensationRecord)
(:JobTarget)-[:IMPACTS]->(:IncomeSource)
(:CompensationRecord)-[:AFFECTS_CASHFLOW]->(:CashFlowSnapshot)
(:Role)-[:HAS_COMP_BAND]->(:CompensationBand)        # central reference, cited by value
```

**Education → Finance**

```
(:Program)-[:IMPACTS]->(:CashFlowSnapshot|:NetWorthSnapshot)
(:Program)-[:FUNDED_BY]->(:FinancialGoal)
(:TuitionCost)-[:AFFECTS_NET_WORTH]->(:NetWorthSnapshot)
(:EducationROIModel)-[:EVALUATES]->(:Program)
```

**Family → Finance/Education**

```
(:FamilyGoal)-[:FUNDED_BY]->(:FinancialGoal)
(:Dependent)-[:IMPACTS]->(:ExpenseCategory)
(:ProtectionItem)-[:ADDRESSES]->(:InsuranceNeed)
(:FamilyGoal{type:college})-[:FUNDED_BY]->(:FinancialGoal)   # links to Education cost
(:FamilyConstraint)-[:CONSTRAINS]->(:EducationRecommendation)
```

**Health → Finance/Family** (already live for Finance; Family bridge new)

```
(:HealthInsurancePlan)-[:COVERED_BY]->(:EmployerBenefit)
(:WellnessGoal)-[:IMPACTS]->(:CashFlowSnapshot)   # only when a financial effect exists
```

## Shared nodes (defined once, owned jointly)

`Skill`, `Certification`, `Degree` (Career⇄Education) · `Household`, `InsuranceNeed`,
`EstateDocument` (Family⇄Finance) · `Evidence`, `Assumption`, `Tradeoff`, `AdviceBoundary`,
`GovernanceRule` (platform). Define in the ontology standard; each domain references, never
redefines.

## Hard rules

- **Both endpoints must be live + the FK must exist** before a cross-domain edge is emitted —
  no edge into an unbuilt domain, no fake edges (the finance/health precedent).
- **Tenant-safe**: every personal edge is single-owner; central market/benchmark data
  (`CompensationBand`, `MarketDemand`) is cited by value into `:Evidence`, never linked.
- **Direction** follows `merge_cypher_for` (edge into the processed node) or the worker's child
  fan-out; reverse-direction edges are extension points until outgoing-edge support lands.

## Questions this unlocks (end-to-end, graph-grounded)

- "Can I afford this program **and** still retire on time?" (Education→Finance→retirement)
- "Would changing jobs improve my **family** financial plan?" (Career→Finance→FamilyGoal)
- "Which education choice best supports my family goals?" (Education×Family×Finance)
- "What is the highest-leverage move across my whole life right now?" (leverage = reach across
  domains × confidence × goal priority — the decision engine's core).
