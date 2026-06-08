# EDUCATION — RECOMMENDATION ENGINE SPEC

Education recommendation families, all following RECOMMENDATION_FRAMEWORK (deterministic,
idempotent uuid5 id, no recommendation without evidence, evidence/assumptions/tradeoffs/
governance, worker fan-out into the evidence graph). Design only.

## Families

| family                        | fires when                                                 | key evidence                                   |
| ----------------------------- | ---------------------------------------------------------- | ---------------------------------------------- |
| `best_program_match`          | options scored; a clear leader on the user's weighted axes | six fit scores + decomposition                 |
| `lower_cost_alternative`      | a cheaper option achieves ≥ comparable ROI/goal-fit        | net_cost delta, ROI parity                     |
| `high_debt_warning`           | projected debt > debt capacity (Finance graph)             | debt_burden, monthly_payment, cash-flow impact |
| `better_roi_path`             | a non-obvious option has higher risk-adjusted ROI          | breakeven, income_lift, risk                   |
| `certification_before_degree` | a cert closes the target skill gap faster/cheaper          | CLOSES_SKILL_GAP, cost/time delta              |
| `delay_or_save_first`         | timing/cash-flow makes waiting/saving better               | cash-flow impact, opportunity cost             |
| `employer_funded_path`        | employer tuition benefit available/likely                  | benefit signal, net_cost after benefit         |
| `licensing_risk_warning`      | program's licensure/bar pass rate is low or unaccredited   | pass_rate, accreditation status                |
| `scholarship_opportunity`     | eligible aid the user hasn't applied for                   | scholarship match, amount                      |
| `career_alignment_gap`        | program does NOT QUALIFY_FOR the target role               | role-mapping gap                               |

## Every recommendation includes (RECOMMENDATION_FRAMEWORK)

- **evidence** (metric_name/value/source_table/observed_at/confidence/explanation) — e.g.
  `net_cost`, `income_lift`, `breakeven_months`, `debt_burden`, `employment_rate`, `pass_rate`.
- **assumptions** (text/confidence/user_confirmed/expires_at) — e.g. "salary outcome at program
  median", "income flat during school" (flagged for confirmation when high-stakes).
- **tradeoffs** (option_a/option_b/benefit/cost/affected_domains).
- **confidence** (from data completeness + band width).
- **affected_domains** (e.g. `["education","finance","career"]`).
- **source_tables** + **source_graph_nodes**.
- **governance**: `education_guidance` AdviceBoundary; **escalation** to
  `financial_advisor`/`admissions_counselor`/`legal` for high-debt (`high_debt_warning`) or
  licensure-gated (`licensing_risk_warning`, e.g. law school) paths — decision support, not
  professional advice.

## Hard rules (inherited)

- **No recommendation without evidence** (and no required-input → nothing, missing-data prompt).
- No fabricated outcomes/comp — cite or omit.
- Deterministic id (`uuid5(NS, "{user_id}:{slug}")`) → idempotent upsert + stable graph node.
- Worker fan-out (already generic for `*_recommendation`) builds the evidence subgraph.

## Chat grounding

Inherits the H2 domain-generic `Retriever.recommendation_evidence` (add `education` →
`EducationRecommendation` to `RECOMMENDATION_LABELS`). "Why is program X recommended?" answers
from the evidence subgraph, with the education disclaimer surfaced.
