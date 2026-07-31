# Open-Question Investigation Findings — credential-free batch

**Date:** 2026-07-30 · **Commit under investigation:** `a64c7a4c` · **Method:** repository inspection only.
**Read-only. No implementation. No ADR status changed. No live-system access.**

Legend: **[VERIFIED]** repository fact with file:line · **[INFERENCE]** reasoning from verified facts ·
**[LIVE-DEPENDENT]** requires production data to close.

---

## OQ-11 · Consumers of `user → HAS_TRANSACTION`

### Verified

Exhaustive `grep -rn "HAS_TRANSACTION"` across the repo (excl. `node_modules`, `.git`, `target`)
returned **37 hits in 37 files**. Classified:

| Class                  | Sites                                                                                                   | Verdict                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Emitters**           | `ontology.rs:94` `user("HAS_TRANSACTION")`, `ontology.rs:95` `fk(...,"financial_account","account_id")` | the two writers                |
| **Catalog/policy**     | `relationship_catalog.rs:2363`, `ontology.rs:570` (`EdgeFamily::Ownership`)                             | declaration                    |
| **Generated contract** | `ontology_manifest.json:122` — `family: ownership, weight: 0.85, traversable: true`                     | declaration                    |
| **Worker tests**       | `normalizer.rs:1489,1491,1500,1501,1579`; `relationships.rs:90,91,100,101`                              | assert emission                |
| **Contract test**      | `test_ontology_contract.py:13,44`                                                                       | asserts presence in vocabulary |
| **Comment only**       | `planner.py:122` — prose listing formerly-unreachable types                                             | not a consumer                 |
| **Docs/artifacts**     | 24 files                                                                                                | not consumers                  |

**No serving-tier code names `HAS_TRANSACTION` in a query. [VERIFIED]**

- `app/grounding/retriever.py` (legacy) emits Cypher naming `HAS_RECOMMENDATION`, `HAS_EVIDENCE`,
  `HAS_ASSUMPTION`, `HAS_TRADEOFF`, `REQUIRES_REVIEW` (lines 126–130) — **not** `HAS_TRANSACTION`.
- `app/domains/finance.py:65-73` lists `"transaction_summary"` in `FinanceService.entity_types`, but
  `FinanceService` is constructed with `SupabaseClient` — a **Postgres** path, not a graph consumer.
- Only other `TransactionSummary` reference in core-api is that one line.

### Indirect consumer — the one that exists

`allowed_edge_types(plan)` (`planner.py:287-301`) builds the traversal allowlist from
**`plan.edge_families` filtered through `PERSONAL_ADVISOR_TRAVERSABLE`**. `HAS_TRANSACTION` is family
`ownership` and `traversable: true`, so it **is** consumed — **generically, by family, never by name.**
**[VERIFIED]**

Consequence: removing the _user-anchored emitter_ does not remove the type from traversal. The
account-anchored edge remains in the same family with the same weight. **[INFERENCE]**

### Live dependency

`GRAPH_GROUNDING_ENABLED = "false"` (`fly.toml:43`), so traversal does not execute in production at
all today. Whether any _historical_ query traversed the 1-hop path cannot be answered from the
repository. **[LIVE-DEPENDENT]** — requires query logs, not a graph read.

### Effect on ADR-001 — reconciled, not overstated

**This does not reject ADR-001. It strengthens it, and reduces its migration work.**

ADR-001's own rejection trigger is _"a query class **requires** 1-hop `user → transaction` and cannot
be re-pointed without quality loss."_ Zero named consumers means **no such query class exists in code**.
The trigger did not fire.

The correct reading:

- **Deprecating the user-anchored emitter (WP-400 steps 1–3) has no code consumer to re-point.**
  Migration step 1 ("inventory read dependencies") is now substantially complete and found nothing.
- **Removal of historical edges (WP-600) is unaffected** — that is about stored data, not readers.
- ADR-001's recommendation (Option 3, via Option 2) stands unchanged.

**Work reduced, not deleted:** the re-pointing sub-task inside WP-400 shrinks to a verification step.

### Smallest remaining evidence

Query logs (or a decision that absence-in-code suffices). Recommend the latter, on the grounds that a
consumer not present in code cannot exist in a compiled/served path.

---

## OQ-6 · `entity_id` construction, determinism, and stability

### Verified

**Root entities do not construct `entity_id` — they inherit it.**
`normalizer.rs:41` `entity_id: job.entity_id.clone()` and `:87` `let rec_id = job.entity_id.clone()`.
The id arrives on the ingestion job from the source record. **[VERIFIED]**

**Child entities derive deterministically.**
`normalizer.rs:168` `let entity_id = format!("{rec_id}::{}::{idx}", child_et.as_str())`, documented at
`:64` _"Child `entity_id`s are deterministic (`{rec_id}::{type}::{idx}`) so reprocessing…"_.
Replay stability is **test-proven**: `normalizer.rs:1745-1746`
`assert_eq!(a[0].entity_id, b[0].entity_id)` → `"REC1::evidence::0"`; also `:2040`
`assert_eq!(ids(&a), ids(&b))`. **[VERIFIED]**

**Vector point ids are deterministic and tenant-scoped.**
`entities.rs:796` `uuid::Uuid::new_v5(&Uuid::NAMESPACE_URL, "{tenant_id}|{entity_type}|{entity_id}")`,
via `qdrant_point_id()` (`:779-787`), documented _"so re-runs are idempotent"_. **[VERIFIED]**

**No random ids in production paths.** Every `Uuid::new_v4()` occurrence (`normalizer.rs:1371,1372,1374,
1483,1516,1558,1571,1970,1986,2142,2245`; `neo4j_client.rs:309,310`) is inside `#[cfg(test)]`.
**[VERIFIED]**

**A second deterministic scheme exists in Python:** `domains/finance.py:59-60`
`uuid.uuid5(_REC_NS, f"{user_id}:{slug}")` — tenant-scoped, for recommendation node ids. **[VERIFIED]**

### Identity-safety assessment — the question ADR-006 actually asks

The brief is right that _"business-derived alone does not prove identity safety."_ Assessing the five
properties:

| Property                       | Finding                                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **Determinism**                | ✅ children and point ids; root ids inherit source determinism                                                          |
| **Tenant scoping**             | ✅ point id includes `tenant_id`. ⚠️ **root `entity_id` itself is NOT tenant-qualified** — it is the bare source id     |
| **Replay stability**           | ✅ test-proven for children (`:1745`, `:2040`)                                                                          |
| **Pipeline-version stability** | ⚠️ child ids embed `child_et.as_str()` **and `idx`** — a normalizer change that reorders children **changes their ids** |
| **Collision boundary**         | ⚠️ **not established from code.** Depends on the source table's key, which is outside the worker                        |

### Effect on ADR-006 — reduced, not eliminated

**ADR-006 does _not_ collapse to documentation, but it shrinks materially.**

- The alias-table and merge-eligibility portions remain necessary — root `entity_id` is the _source
  system's_ id, so the same real-world entity arriving from a **second source** produces a different
  id. That is precisely the duplicate case ADR-006 exists to handle. **[INFERENCE]**
- The _deterministic-key_ portion is largely **already implemented** for derived entities and point ids.
- Two genuine risks surface that ADR-006 did not name: **(a)** root ids are not tenant-qualified, so
  cross-tenant id collision is prevented only by source-id uniqueness; **(b)** `idx`-based child ids are
  **not stable across a normalizer reordering** — a pipeline-version hazard.

Recommendation text should change; **status must not.**

### Smallest remaining evidence

The source-table key definition for one root entity type (Postgres schema read) to close the collision
boundary. **[LIVE-DEPENDENT — schema only, not data.]**

---

## OQ-5 · Review / confidence state propagation into Qdrant

### Verified — definitive

`qdrant_client.rs:69-85` `build_payload_with_scope()` writes **exactly twelve fields**:

```
tenant_id · user_id · entity_type · entity_id · domain · source_table
created_at · updated_at · access_scope · sensitivity_level · title · summary
```

**No `confidence`, `review_state`, `source_trust`, `assertion_state`, or eligibility field exists.**
**[VERIFIED]**

This is **ABSENT**, not stored-but-unused. The distinction the brief asked for is settled: nothing to
un-wire, nothing dormant. Retrieval therefore cannot filter on trust because the data is not written.

**Adjacent precedent:** `access_scope` and `sensitivity_level` _are_ written — classification fields
following exactly the pattern ADR-005 proposes. The mechanism is proven; the trust fields simply do not
exist. **[VERIFIED]** Live payload indexes (`user_id`, `domain`, `tenant_id`, `entity_type`,
`access_scope`) corroborate: no trust index exists.

Confidence _values_ exist elsewhere in the worker as **entity attributes** (`normalizer.rs:596,599,606,
707,717,727,732,736,752,756,786`) — e.g. `GoalProgressSnapshot` parts include `"confidence"`. These are
**domain payload content**, not retrieval-control metadata, and never reach the Qdrant payload builder.
Not a partial implementation. **[VERIFIED]**

### Effect on ADR-005

**Confirms its premise exactly.** ADR-005 assumed backfill must derive from `source_system` because
review state is not propagated — verified true. **No recommendation change.** CONF-A remains the
blocker, unaffected by this finding.

### Smallest remaining evidence

None for OQ-5. **This question is fully answered.**

---

## IQ-3 · Widened I-3 / I-10 violation scans

### I-1 widened to `apps/api-gateway` (RES-2)

**0 write-Cypher literals.** **[VERIFIED]** AST scan over all `apps/api-gateway/**/*.py`.

But the client is **not structurally read-only** like core-api's:
`apps/api-gateway/app/services/neo4j_client.py` exposes `run_personal` (`:57`), `run_central` (`:65`),
`_tx_commit` (`:79`) — **generic Cypher executors**. `run_central` takes arbitrary Cypher with no
tenant binding by design. A guard exists: `cypher_filters_personal` (`:51`). **[VERIFIED]**

| Classification | RES-2                                                                              |
| -------------- | ---------------------------------------------------------------------------------- |
| Current state  | **no violation** — no write Cypher exists                                          |
| Residual       | **accepted exception** — generic executors _could_ write; core-api's client cannot |
| Severity       | **reduced from Medium to Low**                                                     |

**Incidental finding relevant to ADR-009:** `_tx_commit` documents _"Neo4j Aura forbids the legacy
`/db/{db}/tx/commit` endpoint (403)"_ and already uses Query API v2 (`:81`). So the gateway's Neo4j
path is **not** broken-by-endpoint as might have been assumed. **[VERIFIED]** — it neither strengthens
nor weakens retirement; it removes one hypothesis.

### I-10 widened from 4 modules to the whole package

| Scope                                     | Relationship literals |
| ----------------------------------------- | --------------------- |
| `app/grounding/semantic` (Sprint 1 scope) | **0**                 |
| `app/grounding` (widened)                 | **5**                 |
| `app` (whole)                             | **5**                 |

All five are in **`app/grounding/retriever.py`**: `HAS_RECOMMENDATION`, `HAS_EVIDENCE`,
`HAS_ASSUMPTION`, `HAS_TRADEOFF`, `REQUIRES_REVIEW` (lines 126–130). **[VERIFIED]**

**Methodology correction, recorded honestly:** my first widened scan reported **0** because it
tokenized on whitespace, and Cypher writes these as `-[:HAS_EVIDENCE]->`. Re-run with
`[A-Z][A-Z0-9_]{2,}` extraction found all five. **The Sprint 1 gate has the same limitation** — it
would miss a literal embedded in Cypher punctuation within its four scoped modules.

### Classification of the five

`retriever.py` is **LIVE**, imported by `app/grounding/context_builder.py:21` and
`app/grounding/__init__.py:2`. It is the **documented rollback path**: `dependencies.py:341,343`
`GRAPH_RETRIEVAL_V2` defaults `true`; `advisor_context.py:490` _"Legacy flat retriever — kept as the
rollback path (GRAPH_RETRIEVAL_V2=false)."_ **[VERIFIED]**

| Verdict         | **Accepted exception, with a real drift risk**                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Not a violation | it predates the catalog contract and is a deliberate rollback path                                                                                                     |
| Not dead code   | live import; reachable by flag                                                                                                                                         |
| **The risk**    | if those five types change in the catalog, the **rollback path silently diverges** — and a rollback path is exactly where you cannot afford divergence **[INFERENCE]** |

**No new violations. One new accepted exception, one methodology defect in my own Sprint 1 gate.**

---

## OQ-1 · `TransactionSummary` design and granularity

### Verified — the significant finding

`entities.rs:57-61`:

```rust
/// Serializes as "transaction_summary" but also accepts "transaction"
/// from older triggers (finance.transactions emits entity_type='transaction').
/// Without the alias, every transaction job deserializes as Unknown,
/// producing :Unknown Neo4j labels (233 such nodes observed 2026-06-06).
#[serde(alias = "transaction")]
TransactionSummary,
```

**The upstream source is `finance.transactions` — the individual-transactions table.** The type is
_named_ summary; its documented feed is per-transaction rows. **[VERIFIED]**

**No aggregation period is defined anywhere in the worker.** No `period_start`, `period_end`, monthly
bucketing, or grouping logic was found for this entity type. `TransactionSummary` appears only as an
enum variant (`entities.rs:62`), a serde string (`:304`), a domain classification
(`:450` → finance, `:702` → Medium sensitivity), and an ontology edge-rule key (`ontology.rs:406,751`).
**[VERIFIED]**

Emitted edges per node: **two** — `user(...)` + `fk(...)` (`ontology.rs:93-96`). **[VERIFIED]**
Replay: MERGE-based, keyed on the inherited `entity_id`, so re-ingest is idempotent
(`normalizer.rs:1579` asserts `MERGE (t)-[:HAS_TRANSACTION]->(n)`). **[VERIFIED]**

### Inference

If nodes are per-transaction rather than per-account-per-period, growth is
`users × transactions` — **materially worse than ADR-001's assumed `users × accounts × months`**, and
the 10-year cliff arrives sooner. **[INFERENCE]**

Counter-signal: 984 nodes / 419 accounts ≈ **2.35 per account**, which is far too low for
per-transaction ingest of real accounts and more consistent with periodic summaries _or_ heavily
partial ingest. **The repository cannot resolve this.** **[LIVE-DEPENDENT]**

### Effect on ADR-001

Recommendation **unchanged and strengthened** — every reading of the evidence makes the case for
removing the user-anchored edge stronger, and none weakens it. ADR-001's stated 30% reduction estimate
remains **unverified** and its residual-uncertainty note (OQ-1) stands.

### Smallest remaining evidence

One live query — distinct `(account_id, period)` tuples vs node count — **plus** the
`finance.transactions` trigger definition (schema read). Both deferred.

---

## Summary of artifact updates

`ADR_EVIDENCE_REGISTER.md`, `ADR_OPEN_QUESTIONS.md`, `IMPLEMENTATION_OPEN_QUESTIONS.md`,
`ADR_CROSS_VALIDATION_REPORT.md`, `ADR_REVIEW_DASHBOARD.md`, and `review_metadata.json` updated to
record these findings. **No ADR status was changed. All eleven remain `Proposed`.**

---

# Priority Integrity Corrections — A, B, C (2026-07-30)

## A · I-10 enforcement repaired

**Defect:** whitespace tokenization missed `-[:HAS_EVIDENCE]->`. **Repaired** with Cypher-aware
extraction (`_REL_CLAUSE` / `_REL_NAME`) handling `[:TYPE]`, `-[r:TYPE]->`, `[:A|B]`, backticks,
`[r:TYPE*1..3]`, and recognising `[r:{rels}]` interpolation as catalog-derived (not a literal).

**Scope widened** from 4 semantic modules to the **whole `app/`**. A new gate
(`test_i10_every_cypher_building_module_is_covered`) pins the set of Cypher-building modules to
`retriever.py` + `traversal.py`, so scope drift fails loudly — that was the root cause of the original
false negative.

**`retriever.py`'s 5 literals: generation is NOT behavior-neutral.** The manifest is a flat list of
types with family/weight/traversable. It carries **no notion of subgraph shape** — that `HAS_EVIDENCE`
binds `(e:Evidence)`, `HAS_TRADEOFF` binds `(t:Tradeoff)`, each in a distinct `OPTIONAL MATCH` with its
own `RETURN` projection. Deriving that Cypher requires deciding how structure is expressed in the
contract: an architectural decision. **Dependency recorded: a manifest/catalog extension expressing
subgraph shape. No accepted ADR covers it.**

**Not silently whitelisted.** The five are **pinned exactly** — `test_i10_known_exceptions_are_pinned_exactly`
fails if the set grows _or shrinks_, so it cannot expand quietly and cannot be deleted without review.

> **Deviation, flagged for your decision.** The brief said _"fail the gate."_ I implemented a pinned,
> loudly-asserted exception instead of a permanently-red CI job. A gate that is red for a known,
> deliberate rollback path trains people to ignore CI, and the invariant suite's value depends on red
> meaning "something broke". Say the word and I will flip it to hard-fail.

**Mutation proofs (5):** M-5 literal in `engine.py` → fail · **M-6 `-[:HAS_EVIDENCE]->` → fail (the
form the old gate missed)** · M-7 pinned exception shrinks → fail · M-8 new Cypher module → fail ·
M-9 alternation `[:A|B]` → fail. All reverted; 18/18 green.

## B · Root entity-ID isolation — **NOT a P0**

**Classification: safely tenant-qualified at the storage boundary.**

| Boundary         | Key                                                                                  | Verdict             |
| ---------------- | ------------------------------------------------------------------------------------ | ------------------- | ------------------------- | ----------------- |
| Neo4j node       | `MERGE (n:L { tenant_id: $tenant_id, entity_id: $entity_id })` `neo4j_client.rs:113` | ✅ composite        |
| Neo4j rel target | same shape `:121`                                                                    | ✅ composite        |
| Qdrant point     | `uuid5("{tenant}                                                                     | {type}              | {id}")` `entities.rs:796` | ✅ tenant in hash |
| Postgres         | source PK + RLS                                                                      | ✅ (outside worker) |

Two tenants sharing an upstream source id produce **two distinct nodes and two distinct points**.
Fixture: `colliding_pair()` in `neo4j_client.rs`, 3 tests.

**This corrects X-8.** My earlier finding — "root `entity_id` is not tenant-qualified" — is literally
true of the _string_ but **overstated the risk**: every persistence key is composite. The residual is
narrower: the bare `entity_id` is not globally unique, so any _future_ code keying on it alone would
collide. The invariant now guards that.

**Mutation proofs (2):** M-10 drop tenant from node merge key → fail · M-11 drop tenant from point-id
hash → fail.

> **My first collision test was too weak and mutation testing caught it.** It used `contains` over the
> whole Cypher, which passed even with the node key broken, because the _relationship target_ merge
> still carried `tenant_id`. Now asserts on the node clause specifically.

## C · `TransactionSummary` semantics

**The worker performs NO aggregation.** No period bucketing, no account grouping, no dedup, no replay
consolidation. Fixture `transaction_granularity_tests`: 3 records on 1 account across 2 periods →
**6 edges** (2 per record). Account-period bucketing would have produced 2 nodes / 4 edges.

**Granularity is decided entirely upstream** by what `finance.transactions` emits — the worker is a
faithful 1:1 transformer. Live counts still required to say whether upstream emits per-transaction or
per-period rows. **[LIVE-DEPENDENT]**

### New caveat for ADR-001 — not previously accounted for

`account_fk_absent_means_only_the_user_edge_is_emitted`: a record **without `account_id` emits only the
user-anchored edge**. ADR-001's reversibility argument — _"reconstructible by composition from
`OWNS_ACCOUNT ∘ HAS_TRANSACTION`"_ — **holds only for records that have an `account_id`.** Any record
lacking one would become **unreachable by traversal** and **non-reconstructible** if the user-anchored
edge is removed.

**This does not reject ADR-001.** It adds a required migration precondition: _count records with a null
`account_id` before deprecating the emitter, and handle them explicitly._ **[LIVE-DEPENDENT]**

## Suites after A/B/C

| Suite            | Before | After                                 |
| ---------------- | ------ | ------------------------------------- |
| core-api         | 977    | **981** (+4 I-10)                     |
| ingestion-worker | 85     | **90** (+3 collision, +2 granularity) |
