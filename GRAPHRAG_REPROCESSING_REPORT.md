# GRAPHRAG REPROCESSING REPORT

**Date:** 2026-06-06
**Scope:** what happens (and what to watch) when the 831 failed sync jobs are re-queued after the worker Gemini key fix.

---

## Pre-reprocess state (live, just probed)

```
sync_queue total:              1,028 rows
  failed:                        831  (80.8 %)
  completed:                     197  (19.2 %)

by source_table (queued):
  finance.transactions:          786
  finance.financial_accounts:    190
  public.user_persona_profile:    52

failed-job error distribution:
  613 × gemini 401 Unauthorized
  214 × gemini 401 Unauthorized (different batch timestamp)
    4 × gemini 429 Resource exhausted

Qdrant collections:
  life_navigator:    402 points
  ln_central:          0 points

Neo4j personal (4f61c985):
  total nodes:         439
  total relationships: 402
  :Unknown (mis-labelled transactions):  233
  :FinancialAccount:  134
  :UserProfile:        37
  :PersonaProfile:     35
```

---

## What changed in this sprint that makes reprocessing safe

### 1. The worker can read `entity_type='transaction'` now

Before commit `cef74ae`, the postgres trigger emitted `entity_type='transaction'` but the worker's `EntityType` enum only knew `'transaction_summary'`. Every transaction job deserialized to `EntityType::Unknown`, the `as_str()` mapping turned that into `'unknown'`, and Neo4j created `:Unknown` nodes.

`#[serde(alias = "transaction")]` on `EntityType::TransactionSummary` fixes this without changing the canonical wire name. Both strings now route to the same enum variant. After the worker redeploys, every newly-processed transaction job writes a `:TransactionSummary` node, not `:Unknown`.

### 2. Triggers exist for goals + risk

Migration `112_goals_risk_graphrag_triggers.sql` (in this sprint) installs the missing triggers on `public.goals` and `public.risk_assessments`. The migration also backfills currently-existing rows by emitting one-shot `enqueue_sync` calls for them in a `DO $$ ... $$` block. So when migration 112 is applied, you'll see ~N new pending jobs appear in the queue immediately (where N is the number of existing goals + risk rows on the project — likely small, single digits).

### 3. CENTRAL_CONTEXT empty-section spam is gone

Doesn't affect ingestion. Mentioned here for completeness.

---

## Expected progression after operator steps A → C land

Numbers below assume the worker key is fixed AND the reprocess SQL has been run.

### T+0 — immediately after the UPDATE

```
sync_queue:
  pending:    831    <-- 827 just-reset + ~4 already pending
  completed:  197
  failed:       0
```

### T+5 minutes (1-2 worker poll cycles)

Worker drains at ~25 jobs per 5-second batch = up to 300 jobs/min in best case. Realistic: 150-200 jobs/min once Gemini latency is in the loop (~200-400 ms per embed call).

```
sync_queue:
  pending:    ~500       (down by ~330)
  completed:  ~528
  failed:     0-10       (any transient Gemini 429s — auto-retried)
```

### T+10 minutes

```
sync_queue:
  pending:    ~100
  completed:  ~928

Qdrant life_navigator: growing — ~800 points
Neo4j personal:        growing — should see +600 to +700 nodes
```

### T+15 minutes — drained

```
sync_queue:
  pending:        0
  completed:  1,028
  failed:         0      (or a small handful of legitimate 429s
                          that the worker re-queued for backoff)

Qdrant life_navigator:    ~1,028 points (every successful job = 1 vector)

Neo4j personal:
  Total nodes:           ~1,028 + the original 197 = ~1,225
  by label:
    :TransactionSummary:    ~1,019   (786 reprocessed + 233 ex-:Unknown
                                       re-labeled if Cypher re-label run,
                                       or 786 fresh + the 233 stale ones
                                       still :Unknown if not)
    :FinancialAccount:        ~190    (from the queue + existing 134)
    :PersonaProfile:           ~52    (from the queue + existing 35)
    :UserProfile:               ~37    (unchanged — written elsewhere)
    :Unknown:                   233    (will remain until re-labelled
                                        — see "Optional cleanup" below)
```

---

## Watch commands

### Live queue drain

```bash
# Run in a loop; press Ctrl+C when pending == 0.
while true; do
  psql 'postgres://postgres.diwkyyahglnqmyledsey:<PW>@aws-1-us-east-1.pooler.supabase.com:6543/postgres' \
    -c "SELECT sync_status, count(*) FROM graphrag.sync_queue GROUP BY sync_status ORDER BY 2 DESC"
  sleep 30
done
```

### Worker logs in real time

```bash
~/.fly/bin/flyctl logs -a lifenavigator-ingestion-worker
# look for:
#   INFO claimed N jobs from sync_queue
#   INFO processed job <uuid> qdrant=true neo4j=true
# you should NOT see any more:
#   gemini request failed: 401 Unauthorized
```

### Qdrant point count growth

```bash
QDRANT_URL='...'
QDRANT_API_KEY='...'
while true; do
  curl -sS -H "api-key: $QDRANT_API_KEY" "$QDRANT_URL/collections/life_navigator" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["result"]["points_count"], "points")'
  sleep 30
done
# expect: 402 → ~1,028 over 10-15 min
```

### Neo4j node count

```python
from neo4j import GraphDatabase
d = GraphDatabase.driver("neo4j+s://4f61c985.databases.neo4j.io",
                          auth=("4f61c985", "<password>"))
with d.session() as s:
    r = s.run("MATCH (n) RETURN count(n) AS n").single()
    print(f"  total nodes: {r['n']}")
    for row in s.run("MATCH (n) WITH labels(n) AS l, count(*) AS c RETURN l, c ORDER BY c DESC LIMIT 8"):
        print(f"  {row['l']}: {row['c']}")
```

---

## Optional cleanup — re-label the 233 :Unknown nodes

The worker fix means new transaction jobs write `:TransactionSummary`. The 233 existing `:Unknown` nodes won't auto-relabel — they were created BEFORE the fix.

Two options:

### Option α — single Cypher pass (1 minute)

```cypher
MATCH (n:Unknown {entity_type: 'unknown', source_table: 'finance.transactions'})
SET n:TransactionSummary
REMOVE n:Unknown
RETURN count(n);
-- expect: 233
```

Pros: instant, free. Cons: keeps any stale data those nodes contain (they were created from old job payloads).

### Option β — re-process the underlying transactions (10 minutes)

```sql
-- Find the original transactions and re-enqueue them, marking the existing
-- :Unknown nodes for replacement.
INSERT INTO graphrag.sync_queue (user_id, entity_type, entity_id, source_table, operation, payload)
SELECT t.user_id, 'transaction', t.id, 'finance.transactions', 'upsert', to_jsonb(t)
FROM finance.transactions t
WHERE t.id IN (
  -- The 233 entity_ids that became :Unknown nodes — would need to be derived
  -- by joining Neo4j entity_id ↔ Postgres id. Easiest: just enqueue ALL
  -- of them again (idempotent on Qdrant upsert; would update the Neo4j node
  -- properties and the :Unknown label gets replaced because the worker now
  -- writes :TransactionSummary).
  SELECT id FROM finance.transactions
);
```

Pros: re-reads the source row, so the Neo4j node contents are exactly current. Cons: more queue churn.

**Recommend Option α** — the source rows aren't changing; the only thing wrong with the existing 233 nodes is the label.

---

## Failure scenarios + what to do

| Symptom after reprocess                                                       | Diagnosis                          | Fix                                                                                                                                                                   |
| ----------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Queue still has `failed > 0` after 15 min, errors still mention `gemini`      | New key isn't reaching the worker  | Verify with `flyctl secrets list -a lifenavigator-ingestion-worker` — digest should be DIFFERENT from `6b4d7e1d…`. If same, repeat operator step A then `fly deploy`. |
| Queue has `failed > 0` with errors mentioning `429 Resource exhausted`        | Gemini quota                       | Auto-retried by the worker; if rate persistent, raise the AI Studio quota or batch differently.                                                                       |
| Queue has `failed > 0` with errors mentioning `qdrant` or `neo4j`             | Network or schema                  | Inspect specific error; outside this sprint's scope but probably one-off.                                                                                             |
| Qdrant collection grows but Neo4j doesn't                                     | Worker has Neo4j auth wrong        | Verify NEO4J_USERNAME=`4f61c985` (NOT `neo4j`) on the worker secrets.                                                                                                 |
| `:Unknown` count rises despite the fix                                        | Worker didn't pick up the new code | Re-run `fly deploy --remote-only`; check `fly status` for the new image hash.                                                                                         |
| `:Goal` / `:RiskAssessment` count stays at 0                                  | Migration 112 didn't apply         | Re-run `supabase db push --linked --include-all`.                                                                                                                     |
| Cypher queries against `:Goal` still return empty rows even after nodes exist | Trigger didn't backfill            | The DO $$ block in migration 112 backfills. If the user has zero goals/risk rows, nothing was backfilled — which is correct. New writes will enqueue.                 |

---

## Acceptance — when do we say reprocessing is done

```
✓ sync_queue.failed == 0  (or single-digit transient retries)
✓ sync_queue.completed >= 1,028
✓ Qdrant life_navigator points: 1,000+
✓ Neo4j :TransactionSummary count: 700+
✓ Neo4j :Unknown count: 0  (after Option α) or 233 (acceptable; stale labels only)
✓ Worker logs show no further "gemini 401" messages
```

When all six are green: reprocessing is complete.

---

End of `GRAPHRAG_REPROCESSING_REPORT.md`.
