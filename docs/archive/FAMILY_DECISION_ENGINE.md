# FAMILY DECISION ENGINE

How the Family domain answers high-stakes household questions by traversing the cross-domain
graph (Family + Finance + Health + Education). Evidence-backed, governed, explainable. Design only.

## Questions it answers

| Question                                   | Reasoning path                                                           | Evidence                                             |
| ------------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------- |
| **Are my children protected?**             | Dependents + guardianship + life/disability coverage vs need             | InsuranceNeed vs ProtectionItem; guardianship status |
| **Can we afford college?**                 | FamilyGoal(college) FUNDED_BY FinancialGoal vs Education cost projection | 529/savings vs Education comparison-engine cost      |
| **Do we have enough insurance?**           | income-replacement need (Finance) + dependents vs coverage               | need calc + policy coverage, both cited              |
| **What happens if I die tomorrow?**        | survivor cash-flow: income loss vs reserves + coverage + debts           | Finance cash-flow/net-worth scenario + coverage      |
| **Are we on track for family goals?**      | each FamilyGoal vs funding trajectory                                    | goal target vs FinancialGoal progress                |
| **Should we move?**                        | cost-of-living + Education options + Career market delta by geography    | cross-domain (Finance + Education + Career)          |
| **Should one parent leave the workforce?** | household cash-flow + retirement impact of income loss                   | Finance scenario (IncomeSource removal)              |

## Method

Reuses the DECISION_ENGINE_ARCHITECTURE pipeline (collect → aggregate evidence → leverage score
→ arbitrate → rank). Family questions are inherently cross-domain, so the engine traverses:

```
Dependent --IMPACTS--> ExpenseCategory --> CashFlowSnapshot
FamilyGoal --FUNDED_BY--> FinancialGoal --> NetWorthSnapshot/retirement
ProtectionItem --ADDRESSES--> InsuranceNeed (= income_replacement × dependents + debts)
FamilyGoal(college) --funded vs--> Education comparison cost
```

Each answer is a ranked recommendation set with the evidence subgraph attached.

## Scenario engine (death / income-loss / move)

"What if I die tomorrow?" and "should a parent leave the workforce?" run a **survivor/loss
scenario**: remove an `IncomeSource`, recompute household cash-flow + net-worth + retirement
trajectory (Finance), compare to coverage + reserves, and surface the gap. Output is a range
(worst/likely/best), never a single number, with the assumptions listed.

## Governance (strict)

- Estate/guardianship questions → **`legal` boundary**, escalate to an **attorney**; never
  legal advice, never drafts a will.
- Insurance need-analysis → planning guidance; escalate to a **licensed agent/advisor** for
  product selection; never recommends a specific policy as advice.
- "What happens if I die" handled with care + a clear boundary; no morbid framing, factual
  readiness only.
- Health-linked family items respect the **MedicalSafetyGate** (no diagnosis/treatment).

## Explainability

Every family recommendation carries evidence (need calc, coverage, goal funding), assumptions
(income replacement multiple, college cost basis — confirmable), tradeoffs (e.g. coverage cost
vs protection), and the appropriate AdviceBoundary. No black-box "you're 72% ready" — the score
decomposes into the items that drove it.
