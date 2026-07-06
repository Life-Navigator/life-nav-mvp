# RECOMMENDATION / EVIDENCE / ASSUMPTION GRAPH SPEC

How a recommendation becomes a **graph-traceable, explainable** object instead of
generated text. This is the semantic layer that lets every AI answer cite its
evidence and surface its assumptions.

## Shape

```
(:FinancialRecommendation { id, title, priority, confidence, governance_verdict })
  -[:ADDRESSES]->        (:Debt | :BudgetCategory | :InsuranceNeed | :Goal)
  -[:SUPPORTS_GOAL]->    (:FinancialGoal)
  -[:HAS_EVIDENCE]->     (:Evidence)         // one per supporting fact
  -[:HAS_ASSUMPTION]->   (:Assumption)       // one per assumption
  -[:HAS_TRADEOFF]->     (:Tradeoff)
  -[:REQUIRES_REVIEW]->  (:AdviceBoundary)   // when a disclaimer/escalation applies
  -[:GOVERNED_BY]->      (:GovernanceRule)
```

All nodes carry `tenant_id`/`user_id`; the recommendation and its evidence/assumption
nodes are one tenant-scoped subgraph. Edges are MERGE (idempotent).

## Node field standards

### `:Evidence`

| field                  | notes                                      |
| ---------------------- | ------------------------------------------ |
| `tenant_id`, `user_id` | owner scope                                |
| `source_table`         | e.g. `finance.asset_loans`                 |
| `source_entity_id`     | the row the fact came from                 |
| `metric_name`          | e.g. `apr`, `balance`, `monthly_expense`   |
| `metric_value`         | the observed value (stringified for Neo4j) |
| `observed_at`          | when the fact was true                     |
| `confidence`           | 0–1                                        |
| `explanation`          | one-line human rationale                   |

### `:Assumption`

| field             | notes                                  |
| ----------------- | -------------------------------------- |
| `tenant_id`       | owner scope                            |
| `assumption_text` | e.g. "income stays flat for 12 months" |
| `confidence`      | 0–1                                    |
| `expires_at`      | when it must be re-validated           |
| `user_confirmed`  | bool — did the user confirm it?        |
| `source`          | `model` \| `user` \| `default`         |

### `:Tradeoff`

| field                   | notes                             |
| ----------------------- | --------------------------------- |
| `tenant_id`             | owner scope                       |
| `option_a` / `option_b` | the two choices                   |
| `benefit`               | what option_a buys                |
| `cost`                  | what it costs                     |
| `affected_domains`      | list, e.g. `["finance","family"]` |

### `:AdviceBoundary`

`tenant_id`, `boundary_type` (`medical` \| `legal` \| `tax` \| `investment`),
`disclaimer_text`, `requires_human_review` (bool), `escalation_path`.

## Why this matters

A recommendation node with `HAS_EVIDENCE` edges means the Core API / chat can answer
**"why did you recommend this?"** by traversing to the Evidence nodes and citing
`source_table`/`metric_name`/`metric_value` — the same authoritative facts the
deterministic engine used. An `:Assumption` with `user_confirmed=false` is surfaced as
"I assumed X — confirm?" An `:AdviceBoundary` forces the disclaimer/escalation. None
of this is possible with text-only recommendations.

## Provenance

Recommendation/Evidence/Assumption edges are **inferred** (`is_system_derived=true`,
`derived_by="finance-recommendation-engine"`, `confidence < 1`) — distinct from
**asserted** ownership edges (`OWNS_ACCOUNT`, `is_user_asserted=true`). This separation
is mandatory so the AI never presents a derivation as a user-stated fact.

## Ingestion path (when implemented)

1. `financial_recommendations` table (Phase-1 schema) is the system of record.
2. Worker enum gains `FinancialRecommendation`, `Evidence`, `Assumption`, `Tradeoff`,
   `AdviceBoundary` variants **before** any trigger (enum-before-trigger).
3. Ontology registry declares the edges above (source fields = the recommendation
   row's `addresses_*`, `evidence[]`, `assumptions[]` JSON).
4. Triggers enqueue; worker MERGEs the subgraph; Qdrant embeds the recommendation
   summary for retrieval.

## Acceptance

- Every `:FinancialRecommendation` has ≥1 `HAS_EVIDENCE` edge (Gate 10).
- Chat can cite at least one Evidence node per recommendation (Gate 11).
- No recommendation node without a `governance_verdict` / `GOVERNED_BY` edge.
