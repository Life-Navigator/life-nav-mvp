# SEMANTIC GRAPH AUDIT

**Date:** 2026-06-07 · **Scope:** current Neo4j + worker ontology state (post finance typed-relationship rollout, Phase 3). Audit/findings only.

## 1. Current node labels (live counts)

| Label                 | Nodes | Source                     |
| --------------------- | ----- | -------------------------- |
| `:TransactionSummary` | 867   | finance.transactions       |
| `:FinancialAccount`   | 289   | finance.financial_accounts |
| `:UserProfile`        | 79    | user anchor                |
| `:PersonaProfile`     | 77    | beta sample profiles       |
| `:RiskAssessment`     | ~1    | public.risk_assessments    |
| `:Unknown`            | **0** | (clean)                    |

**Defined-but-unused labels** (in the worker enum, 0 nodes today): `Asset, Debt, InvestmentHolding, RetirementPlan (→ RetirementAccount), FinancialGoal`, plus ~110 non-finance types (Health/Career/Education/Decision-intelligence). The worker enum has **125 variants**; only ~5 labels are materialized in production.

## 2. Current relationship types (live counts, post-Phase-3)

| Type              | Count | Meaning                                           |
| ----------------- | ----- | ------------------------------------------------- |
| `HAS_TRANSACTION` | 1,572 | 786 user→txn + 786 account→txn                    |
| `RELATED_TO`      | 1,233 | generic fallback (all non-finance + orphan nodes) |
| `OWNS_ACCOUNT`    | 190   | user→account                                      |

Only **3 relationship types exist** in the live graph. `HAS_TRANSACTION` + `OWNS_ACCOUNT` are the only semantic edges; everything else is `RELATED_TO`.

## 3. Which relationships are semantic

- `(:UserProfile)-[:OWNS_ACCOUNT]->(:FinancialAccount)` ✅
- `(:UserProfile)-[:HAS_TRANSACTION]->(:TransactionSummary)` ✅
- `(:FinancialAccount)-[:HAS_TRANSACTION]->(:TransactionSummary)` ✅ (the **only** inter-entity edge type in production)

## 4. Which relationships are generic / fallback

**Everything else.** All 1,233 `RELATED_TO` edges are `(:UserProfile)-[:RELATED_TO]->(:X)` — persona profiles, the 99 orphan account nodes, the 81 orphan transaction nodes, and (in code) every non-finance domain. Non-finance domains have _typed labels in the legacy `match`_ (e.g. `HAS_HEALTH_METRIC`) but **no production data exercises them yet**, so live they're absent.

## 5. Which relationships are missing

- **Inter-entity finance**: `SECURED_BY` (debt→asset), `SUPPORTS_GOAL`/`BLOCKS_GOAL`/`FUNDED_BY` (→ FinancialGoal), `IN_CATEGORY` (txn→ExpenseCategory), `AFFECTS_CASHFLOW`/`AFFECTS_NET_WORTH` (→ snapshots). Blocked on missing tables + linkage fields.
- **Evidence / Assumption / Tradeoff** nodes + `HAS_EVIDENCE`/`HAS_ASSUMPTION`/`HAS_TRADEOFF` — recommendations are **not** represented in the graph at all.
- **Cross-domain** edges — none exist; there is no path from finance to health/career/family/education.
- **Decision-intelligence** edges (`EVALUATES`, `IMPACTS`, `PROJECTS`, `GOVERNED_BY`).

## 6. Overloaded / inconsistent labels

- `RetirementPlan` (enum) vs `RetirementAccount` (target ontology label) — naming mismatch to reconcile.
- `Recommendation` and `OptimizerRecommendation` both emit `RECEIVED_RECOMMENDATION` — overloaded.
- Node-count drift: 289 account nodes vs 190 Supabase rows (99 orphans); 867 txn nodes vs 786 rows (81 orphans). Stale nodes carry only `RELATED_TO`.
- The graph is a **star**: `relationships_for` emits exactly one edge per node, all pointing to `:UserProfile`. No node-to-node structure except the new finance inter-entity edges.

## 7. Entity types in the worker enum

**125 variants** (`entities.rs`). Finance: `FinancialAccount, FinancialGoal, TransactionSummary, Debt, Asset, InvestmentHolding, TaxProfile, EmployerBenefit, RetirementPlan, UserFinancialProfile`. The rest span Health, Career, Education, Family, Decision-intelligence, Provider, Arcana, plus `PersonaProfile`, `RiskAssessment`, `Unknown`.

## 8. Entity types with normalizer summaries

~200 `build_summary`/`build_title` match arms — **broad coverage** across most enum variants (summaries are the most complete layer). Empty-summary entities are skipped (no Qdrant point).

## 9. Entity types with relationship emitters

**98 typed-label arms** in the legacy `match` + the new **ontology registry** (finance: 7 entity types, 3 relationship types, 2 inter-entity FK edges). Mapped finance entities now route through `ontology.rs`/`relationships.rs` and never fall back to `RELATED_TO`. All other types still use the single-user-edge legacy match.

## 10. Relationships supporting cross-domain reasoning

**None.** Every edge terminates at `:UserProfile` or (finance) at a same-domain account. There is no cross-domain edge, no scenario→domain edge, and no evidence graph. The graph cannot currently answer any cross-domain question.

---

## Finance ontology status

| Capability                                                                                                         | State                                       |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| Typed user edges (OWNS_ACCOUNT / HAS_TRANSACTION / HAS_HOLDING / HAS_ASSET / HAS_DEBT / CONTRIBUTES_TO / HAS_GOAL) | ✅ in registry; live for accounts+txns      |
| Inter-entity account→transaction                                                                                   | ✅ live (786)                               |
| Inter-entity account→holding                                                                                       | ✅ in registry (no data yet)                |
| Debt→Asset `SECURED_BY`, goal funding, category, snapshots                                                         | ⚪ extension points (missing tables/fields) |
| Evidence / Assumption / Recommendation graph                                                                       | ❌ not modeled                              |

## GraphRAG limitations (today)

1. **Star topology** → graph retrieval ≈ user-filtered vector search; no traversal value beyond finance.
2. **No evidence graph** → recommendations are generated text, not graph-traceable.
3. **No cross-domain edges** → cannot reason across finance/health/career/family/education.
4. **Central ontology (`ln_central`) empty** → no methodology/benchmark grounding.
5. **Orphan nodes** (180) inflate counts and dilute retrieval.

## Top 10 ontology defects (ranked by impact)

| #   | Defect                                                                               | Impact                                      | Fix locus               |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------- | ----------------------- |
| 1   | No evidence/assumption graph — recommendations untraceable                           | Blocks explainable AI (core promise)        | Part 5 spec + worker    |
| 2   | No cross-domain edges                                                                | Blocks the whole "life decision" value prop | Part 6 blueprint        |
| 3   | Star topology for all non-finance domains                                            | Future domains inherit a non-graph          | Registry (Part 3)       |
| 4   | Recommendations not persisted as nodes                                               | No reproducibility / accuracy tracking      | Part 5 + schema         |
| 5   | 180 orphan finance nodes (count drift)                                               | Retrieval noise; audit ambiguity            | Phase 5 reconcile       |
| 6   | `RELATED_TO` still dominant (1,233)                                                  | Generic edges = no reasoning                | Phase 4 cleanup         |
| 7   | Label naming mismatches (RetirementPlan/Account; overloaded RECEIVED_RECOMMENDATION) | Ambiguous traversal                         | Standard (Part 2)       |
| 8   | Missing inter-entity finance edges (SECURED_BY, FUNDS, IN_CATEGORY)                  | Shallow finance graph                       | Part 4 + Phase-1 schema |
| 9   | Empty central ontology corpus                                                        | No benchmark/methodology evidence           | Future                  |
| 10  | No relationship metadata (confidence/derived_by/version)                             | Can't distinguish asserted vs inferred      | Part 2.D + worker       |
