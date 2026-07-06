# GRAPH QUALITY GATES

Mandatory gates a domain MUST pass before it unlocks in production. No domain ships a
half-built graph. Each gate has an audit query/command; a domain is "green" only when
**all 15** pass.

| #   | Gate                                                                                                    | How to verify                                                                             | Finance status                         |
| --- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------- |
| 1   | Known entity type exists in worker enum                                                                 | grep `entities.rs` for the `EntityType` variant                                           | ✅ (7 finance types)                   |
| 2   | Node label is correct (PascalCase, matches standard)                                                    | `MATCH (n:Label) RETURN count(n)`                                                         | ✅ FinancialAccount/TransactionSummary |
| 3   | No `:Unknown` nodes                                                                                     | `MATCH (n:Unknown) RETURN count(n)` = 0                                                   | ✅ 0                                   |
| 4   | No mapped entity falls back to `RELATED_TO`                                                             | registry test `all_finance_entities_..._no_fallback`                                      | ✅ test green                          |
| 5   | Required typed user edge exists                                                                         | `MATCH (:UserProfile)-[:OWNS_ACCOUNT]->(:FinancialAccount) RETURN count(*)`               | ✅ 190                                 |
| 6   | Inter-entity edges exist when FK fields exist                                                           | `MATCH (:FinancialAccount)-[:HAS_TRANSACTION]->(:TransactionSummary) RETURN count(*)`     | ✅ 786                                 |
| 7   | Qdrant payload preserves `tenant_id`/`user_id`/`entity_type`/`source_table`/`title`/`sensitivity_level` | scroll one point, assert keys                                                             | ✅ all 6 present                       |
| 8   | Neo4j node count reconciles with Supabase OR drift documented                                           | compare `MATCH (n:Label) count` vs `SELECT count(*)`                                      | ⚠️ 99+81 orphans (documented; Phase 5) |
| 9   | Cross-tenant edge count = 0                                                                             | `MATCH (a)-[r]->(b) WHERE a.tenant_id<>b.tenant_id RETURN count(r)` = 0                   | ✅ 0                                   |
| 10  | Recommendations have evidence links                                                                     | `MATCH (r:FinancialRecommendation) WHERE NOT (r)-[:HAS_EVIDENCE]->() RETURN count(r)` = 0 | ❌ not modeled yet (Part 5)            |
| 11  | Chat can cite graph evidence                                                                            | grounding test: answer includes a `source_table`/Evidence ref                             | ⚠️ facts cited; graph-evidence pending |
| 12  | Deletion behavior is defined                                                                            | `DETACH DELETE` on source-row delete (`delete_node`)                                      | ✅ defined                             |
| 13  | Reprocessing is idempotent                                                                              | `MERGE` semantics; test `relationship_creation_is_idempotent_via_merge`                   | ✅ test green                          |
| 14  | Audit query exists                                                                                      | `RELATIONSHIP_REPROCESSING.md` + this doc                                                 | ✅                                     |
| 15  | Domain does not unlock until gates pass                                                                 | governance: this checklist                                                                | —                                      |

## Canonical audit queries (run in-container, Neo4j Query API v2 + Qdrant)

```cypher
MATCH ()-[r]->() RETURN type(r) AS t, count(r) AS c ORDER BY c DESC;          -- rel mix
MATCH (n:Unknown) RETURN count(n);                                            -- gate 3
MATCH (a)-[r]->(b) WHERE a.tenant_id <> b.tenant_id RETURN count(r);          -- gate 9
MATCH (:UserProfile)-[:OWNS_ACCOUNT]->(:FinancialAccount) RETURN count(*);    -- gate 5
MATCH (:FinancialAccount)-[:HAS_TRANSACTION]->(:TransactionSummary) RETURN count(*); -- gate 6
```

## Finance scorecard against the gates

**13 / 15 green.** Outstanding:

- **Gate 10** (recommendation evidence graph) — not modeled; needs Part 5 + the
  `financial_recommendations` table + worker enum variants (enum-before-trigger).
- **Gate 8** (node-count reconcile) — 180 orphan nodes; documented, reconciled in the
  Phase 5 Qdrant↔Neo4j drift work.
- **Gate 11** (chat cites graph evidence) — partial: chat cites authoritative Supabase
  facts today; graph-evidence citation lands with Gate 10.

## Rule for future domains (Health next)

A domain is **not permitted to unlock** until it reaches the same bar finance has
(≥13/15, with a documented plan for the rest). Health must:

1. Add its enum variants **before** any trigger.
2. Register its ontology edges in `ontology.rs` (no `RELATED_TO` for mapped types).
3. Pass gates 1–9, 12–14 at minimum; 10–11 as the evidence graph matures.
   This is what prevents every new domain from re-creating the `RELATED_TO` star.
