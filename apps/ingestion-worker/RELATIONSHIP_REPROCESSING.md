# Finance typed-relationships — reprocessing & audit plan

**Change:** `normalizer.rs::relationships_for` now emits typed Neo4j edges for
finance entities instead of the generic `RELATED_TO` star:

| Entity             | User edge                                                  | Inter-entity edge (when FK in payload)                                           |
| ------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| FinancialAccount   | `(:UserProfile)-[:OWNS_ACCOUNT]->(:FinancialAccount)`      | —                                                                                |
| TransactionSummary | `(:UserProfile)-[:HAS_TRANSACTION]->(:TransactionSummary)` | `(:FinancialAccount)-[:HAS_TRANSACTION]->(:TransactionSummary)` via `account_id` |
| Asset              | `(:UserProfile)-[:HAS_ASSET]->(:Asset)`                    | —                                                                                |
| Debt               | `(:UserProfile)-[:HAS_DEBT]->(:Debt)`                      | (SECURED_BY → Asset deferred: reverse-direction edge)                            |
| InvestmentHolding  | `(:UserProfile)-[:HAS_HOLDING]->(:InvestmentHolding)`      | `(:FinancialAccount)-[:HAS_HOLDING]->(:InvestmentHolding)` via `account_id`      |
| RetirementPlan     | `(:UserProfile)-[:CONTRIBUTES_TO]->(:RetirementAccount)`   | —                                                                                |
| FinancialGoal      | `(:UserProfile)-[:HAS_GOAL]->(:FinancialGoal)`             | SUPPORTS_GOAL/BLOCKS_GOAL/FUNDED_BY deferred (need linkage fields)               |

`RELATED_TO` remains ONLY as the last-resort fallback for unmapped types. All
edges are `MERGE` (idempotent) and the target node is MERGEd under the same
`tenant_id` (no cross-user edges). `account_id` survives sanitization (the
sensitive regex strips `account_number`/`routing_number`, not `account_id`).

> **Nothing has been deployed or reprocessed.** The code + tests are committed;
> existing Neo4j edges are still `RELATED_TO` until the steps below are run.

---

## Reprocessing plan (run only when instructed)

### 1. Deploy the worker

```bash
~/.fly/bin/flyctl deploy apps/ingestion-worker --remote-only -a lifenavigator-ingestion-worker
```

After deploy, **new** finance writes get typed edges automatically. Existing
nodes need re-enqueue (below).

### 2. Re-enqueue existing finance jobs (idempotent — no duplicate nodes)

```sql
-- 190 accounts + 786 transactions. MERGE semantics => nodes are updated in
-- place, not duplicated; the new typed edges are added.
UPDATE graphrag.sync_queue
   SET sync_status='pending', attempts=0, last_error=NULL
 WHERE source_table IN ('finance.financial_accounts','finance.transactions')
   AND sync_status='completed';
```

Watch the drain (queue → 0 pending). The worker re-runs `merge_cypher_for`.

### 3. Remove the stale `RELATED_TO` edges (after typed edges are confirmed)

MERGE adds the new edge but does **not** delete the old one, so each node will
briefly carry BOTH `RELATED_TO` and the typed edge. Once step 5 confirms typed
edges exist, drop the stale ones (in-container, per FLY_SECRET_AUDIT.md):

```cypher
MATCH (:UserProfile)-[r:RELATED_TO]->(n)
WHERE n:FinancialAccount OR n:TransactionSummary OR n:Asset
   OR n:InvestmentHolding OR n:RetirementAccount OR n:FinancialGoal OR n:Debt
DELETE r;
```

### 4. Reconcile the 233-node Qdrant↔Neo4j drift

The 233 transactions that were relabeled `:Unknown`→`:TransactionSummary` in
Neo4j-only still have **`entity_type='unknown'` Qdrant points**. Re-enqueuing
(step 2) writes fresh `transaction_summary` points (new point_id), leaving the
old `unknown` points orphaned. After the drain, delete the orphans:

```python
# in-container (api-gateway): delete Qdrant points where entity_type='unknown'
# AND source_table='finance.transactions'
qpost('points/delete', {'filter': {'must': [
  {'key':'entity_type','match':{'value':'unknown'}},
  {'key':'source_table','match':{'value':'finance.transactions'}}]}})
```

Then Qdrant `transaction_summary` count should equal Neo4j `:TransactionSummary`.

---

## Audit checks (run in-container via api-gateway `python3` + Neo4j Query API v2)

```cypher
-- (a) relationships by type — RELATED_TO must no longer dominate finance
MATCH ()-[r]->() RETURN type(r) AS relationship_type, count(r) AS count ORDER BY count DESC;

-- (b) typed user->finance edges present
MATCH (u:UserProfile)-[r]->(n)
WHERE n:FinancialAccount OR n:TransactionSummary OR n:Asset OR n:InvestmentHolding
   OR n:RetirementAccount OR n:FinancialGoal
RETURN type(r) AS relationship_type, labels(n) AS labels, count(*) AS count ORDER BY count DESC;

-- (c) :Unknown still 0
MATCH (n:Unknown) RETURN count(n) AS unknown_count;

-- (d) inter-entity account->transaction edges exist
MATCH (a:FinancialAccount)-[:HAS_TRANSACTION]->(t:TransactionSummary)
RETURN count(*) AS account_transaction_edges;

-- (e) NO cross-tenant edges (must return 0)
MATCH (a)-[r]->(b) WHERE a.tenant_id <> b.tenant_id RETURN count(r) AS cross_tenant_edges;
```

**Expected after reprocessing:** `OWNS_ACCOUNT`≈289, `HAS_TRANSACTION`≈867 (user) +
≈786 (account→transaction), `RELATED_TO`→~persona/profile only (0 finance),
`unknown_count`=0, `account_transaction_edges`>0, `cross_tenant_edges`=0.
