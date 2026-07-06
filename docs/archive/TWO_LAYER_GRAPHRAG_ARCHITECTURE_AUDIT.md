# TWO_LAYER_GRAPHRAG_ARCHITECTURE_AUDIT.md

**Date:** 2026-06-04
**Scope:** Audit + enforce the CENTRAL (policy/how) vs PERSONAL (facts/what) GraphRAG split.

---

## Verdict: the separation EXISTED in infra but the LIVE CHAT PATH ignored it. Now enforced.

The stores were already split central/personal. But the edge function that actually answers chat
(`supabase/functions/graphrag-query/index.ts`) used a single flat context, never read the finance system
of record, and had only an advisory "don't fabricate" line — which is why it hallucinated balances.

---

## 1. Current store separation (audited, file:line)

| Layer                 | CENTRAL (shared policy, no PII)                                          | PERSONAL (per-user facts)                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Qdrant**            | collection `ln_central` (`QDRANT_CENTRAL_COLLECTION`) — no tenant filter | collection `life_navigator` (`QDRANT_PERSONAL_COLLECTION`) — filter `tenant_id`+`user_id`+`access_scope='personal'` (`apps/api-gateway/app/services/qdrant.py:19-41`)                         |
| **Neo4j**             | database `central` (`NEO4J_CENTRAL_DATABASE`)                            | database `neo4j` (`NEO4J_PERSONAL_DATABASE`); every personal Cypher MUST reference `$tenant_id` or it's refused (`neo4j_client.py:57-63`)                                                     |
| **Supabase**          | `central.ontology_*` (seed-only)                                         | `finance.financial_accounts` etc., RLS `auth.uid() = user_id` (`migrations/031_finance_domain.sql`)                                                                                           |
| **Ingestion routing** | `access_scope='central'` → central clients                               | `access_scope='personal'` (default) → personal clients (`ingestion-worker/src/processor.rs:56-63`); `tenant_id=user_id` on every node/point (`entity_mapper.py:47`, `qdrant_client.rs:69-84`) |

Isolation primitives are **sound**: tenant_id==user_id on write, three-key Qdrant filter, mandatory
`$tenant_id` Cypher guard, RLS on finance tables, per-user cache key.

## 2. Does financial data land in the personal stores? (Task 2)

Yes by design: `finance.financial_accounts` INSERT/UPDATE/DELETE fires
`graphrag.trigger_financial_account_sync` (`migrations/050_graphrag.sql:187-216`) → `graphrag.sync_queue`
(`access_scope='personal'`) → Rust ingestion worker → personal Neo4j + `life_navigator` Qdrant.
**But it's async and best-effort** — if the queue lags/fails (or the deprecated Python pipeline runs and
drops `access_scope`, `entity_mapper.py:56-70`), a freshly-activated user's accounts are **not retrievable**,
and retrieval returns nothing.

## 3. Root cause of grounding=0 / hallucination

The **live chat path is the edge function**, and it (pre-fix):

- Read a **single** Qdrant collection (`QDRANT_COLLECTION`), no central/personal split, no `access_scope`.
- **Never queried `finance.financial_accounts`** — 100% reliant on the async graph/vector promotion.
- Built **one flat context blob** (`buildContext`, `index.ts:488`), no source labels.
- Used a weak prompt ("Never fabricate data" with no enforcement, `index.ts:96-110`).

So when async promotion hadn't populated the graph (the common case right after activation), retrieval was
empty and the model invented plausible accounts ("Bank of America $3,250.75").

## 4. What was enforced (the fix — see `PERSONAL_GRAPHRAG_GROUNDING_FIX_REPORT.md`)

- **Deterministic Supabase finance read** in the edge function → `AUTHORITATIVE_FINANCIAL_FACTS`,
  independent of async promotion (the "WHAT is true" source of record).
- **Four labeled context sections** (`CENTRAL_CONTEXT` / `AUTHORITATIVE_FINANCIAL_FACTS` /
  `PERSONAL_CONTEXT` / `MISSING_DATA`) + **central Qdrant retrieval** (`ln_central`) for "HOW to answer".
- **Hard prompt rules**: personal money facts ONLY from authoritative/personal context; refuse if missing;
  never infer from central/model priors.
- **Disabled the deprecated proxy** (`GRAPHRAG_PIPELINE_URL` unset) so the hardened inline path is
  authoritative and cannot be bypassed.

## Remaining (non-blocking) architecture follow-ups

- **Async promotion still lags** — the deterministic finance read makes it non-critical for _balances_, but
  goals/career still depend on it; harden the sync queue or read those directly too.
- **Deprecated Python `entity_mapper.py` drops `access_scope`** — remove it or add the field.
- **Query cache** (`graphrag.query_cache`) is keyed `(user_id, query)` with a TTL and is **not invalidated
  on data change** — can serve a stale balance. Reduce TTL or skip cache for financial queries.
