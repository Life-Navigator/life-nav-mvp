# Semantic Quality Framework

**Status:** Designed · **Date:** 2026-07-30 · Parent: `SEMANTIC_PLATFORM_ARCHITECTURE.md`

Covers brief Phases 5 and 11. Every metric below is defined as a **computable query**, with a live
baseline where one was measured on 2026-07-30.

---

## 1. Principle

A metric that is not computable from the stores is an opinion. A metric with no baseline cannot show
improvement. Every entry states its definition, its measured value, and whether it **gates** (blocks
release), **ratchets** (may not regress), or **tracks** (observed only).

Premature gating is its own failure: gating a metric before understanding its natural variance
produces flaky builds and teams that disable gates. Most metrics below start as _track_, become
_ratchet_ once a baseline stabilizes, and only a few ever _gate_.

---

## 2. Structural metrics — measured baseline

| Metric                 | Definition                          | Baseline 2026-07-30         | Mode     |
| ---------------------- | ----------------------------------- | --------------------------- | -------- |
| Node count             | `MATCH (n) RETURN count(n)`         | 2,506                       | track    |
| Relationship count     | `MATCH ()-[r]->() RETURN count(r)`  | 3,208                       | track    |
| Vector count           | Qdrant `points_count`               | 2,218                       | track    |
| Graph density          | `edges / (nodes × (nodes-1))`       | ~5.1e-4                     | track    |
| Average degree         | `2 × edges / nodes`                 | 2.56                        | ratchet  |
| Relationship diversity | distinct live types / catalog types | **40 / 147 = 27%**          | track    |
| Entity diversity       | distinct labels                     | 47                          | track    |
| Edge concentration     | share held by the top type          | **`HAS_TRANSACTION` = 61%** | track    |
| Connected components   | per tenant                          | expect 1/tenant             | **gate** |
| Graph fragmentation    | tenants with > 1 component          | expect 0                    | **gate** |

### 2.1 What the baseline says

**The graph is a shallow star with one dominant edge type.** 61% of all edges are
`HAS_TRANSACTION`; average degree is 2.56. Excluding transactions the graph is close to a depth-2 tree.

This has a direct architectural consequence: **multi-hop reasoning has little to traverse today.**
Investing in sophisticated path-ranking before graph richness improves would optimize a capability the
data cannot yet exercise. Richness is therefore a _precondition_ metric for brief Phase 7, and is why
the roadmap sequences enrichment before advanced reasoning.

**Relationship diversity at 27%** means 107 catalog types have no instances. This is expected for a
young corpus with a forward-looking catalog and is **not** a pruning signal (`SEMANTIC_DATA_MODEL.md`
§5, F-2). Track it; a _declining_ ratio as the graph grows would be the real signal.

---

## 3. Completeness metrics

| Metric                      | Definition                                        | Baseline         | Mode             |
| --------------------------- | ------------------------------------------------- | ---------------- | ---------------- |
| Provenance completeness     | assertions / edges                                | **0%** (0/3,208) | ratchet          |
| Tenant completeness — nodes | nodes with `tenant_id`                            | **100%**         | **gate**         |
| Tenant completeness — edges | edges with `tenant_id`                            | **0%**           | track (see note) |
| Payload completeness        | Qdrant points with `domain`/`user_id`/`tenant_id` | **100%**         | **gate**         |
| Confidence completeness     | assertions with a vector                          | 0%               | ratchet          |
| Temporal completeness       | assertions with a declared temporal class         | 0%               | ratchet          |
| Citation completeness       | citable assertions with a resolvable source       | 0%               | ratchet          |
| Title completeness          | nodes with a human-readable title                 | unmeasured       | ratchet          |
| Attribute completeness      | per class, populated / declared                   | unmeasured       | track            |
| Ontology coverage           | catalog types with ≥ 1 instance                   | 27%              | track            |

**Edge-level `tenant_id` at 0% is deliberately `track`, not `gate`.** Isolation is enforced at node
level (invariant I-5). Gating on edge tenancy would mandate a 3,208-edge migration that buys nothing
if node-level property tests hold. Revisit only if traversal ever originates from an edge rather than
a tenant-anchored node.

---

## 4. Integrity metrics

| Metric                     | Definition                                  | Expected                          | Mode                         |
| -------------------------- | ------------------------------------------- | --------------------------------- | ---------------------------- |
| Cross-tenant edges         | edges whose endpoints differ in `tenant_id` | **0** (verified for `RELATED_TO`) | **gate**                     |
| Orphaned nodes             | nodes with no edge and no tenant anchor     | 0                                 | gate                         |
| Dangling assertions        | `assertion_id` resolving to nothing         | 0                                 | gate                         |
| Duplicate entities         | same `business_identity`, different node    | 0                                 | gate                         |
| Duplicate relationships    | same (subject, predicate, object) active    | 0                                 | gate                         |
| Contradictory facts        | mutually exclusive active assertions        | 0 unresolved                      | gate                         |
| Store divergence — tenants | Neo4j vs Qdrant distinct tenants            | **268 vs 251 (Δ17)**              | **gate — currently failing** |
| Store divergence — objects | node/vector correspondence                  | 2,506 vs 2,218                    | track                        |
| Embedding dimension        | Qdrant vector size                          | **3072, uniform**                 | **gate**                     |
| Unlabelled entities        | `:Entity` population                        | **0**                             | see note                     |

### 4.1 Open anomalies from the live baseline

**ANOM-1 — 17-tenant divergence (Neo4j 268 vs Qdrant 251).** Unexplained. Per operating rule,
unexplained store differences are **never** treated as deletable orphans. Plausible benign
explanations (tenants with graph nodes but no embeddable content; ingest ordering) must be _confirmed_,
not assumed. This gate is currently red and should stay red until explained.

**ANOM-2 — `:Entity` population is 0.** Any migration or query predicated on `:Entity` matches nothing
and reports success — the identical silent-empty class as `domain=finance`. Either define the
retrievability predicate and populate, or remove `:Entity` from all designs.

**ANOM-4 — 512 unindexed vectors** (1,706 indexed of 2,218). Consistent with Qdrant's small-collection
indexing threshold; recorded so a future delta is interpretable rather than alarming.

---

## 5. Retrieval and reasoning metrics

**Blocked: `golden.json` does not exist.** Until it does, every metric here is undefined, and every
claim about retrieval or reasoning improvement is unfalsifiable. This is the cheapest unblock in the
program and gates the most (`SEMANTIC_PLATFORM_ROADMAP.md`).

| Metric                                                    | Mode             |
| --------------------------------------------------------- | ---------------- |
| recall@k, precision@k, MRR, nDCG@10                       | ratchet          |
| Per-channel attribution (vector / graph / central)        | track            |
| Ablation delta — graph channel contribution               | track            |
| Traversal strategy comparison (per strategy in Ph7)       | track            |
| Path-ranking quality                                      | ratchet          |
| Answer confidence calibration (Brier, per source class)   | track            |
| Citation correctness — cited assertion supports the claim | **gate**         |
| Fabrication rate                                          | **gate at 0**    |
| Temporal correctness — no future/expired fact as present  | **gate at 0**    |
| Reproducibility — trace replay yields identical evidence  | **gate at 100%** |

---

## 6. The Enterprise Knowledge Quality dashboard

Six panels, ordered by decision value rather than by data availability:

1. **Trust** — provenance, confidence, citation completeness; calibration curve
2. **Integrity** — the §4 gates, with the two currently-red anomalies surfaced first
3. **Coverage** — ontology coverage, richness, per-domain completeness
4. **Retrieval** — golden-set metrics with per-release deltas and ablations
5. **Governance** — classification completeness, denial rates per agent, deletion completeness
6. **Operations** — latency p50/p95 per stage, cost per query, store divergence

**Design rule: every panel shows a baseline, a current value, and a delta.** A dashboard of absolute
numbers with no reference point produces no decisions. The panels that would currently be mostly zeros
(Trust) still ship at zero — an honest zero is the measurement that motivates the work, and hiding it
until it looks good is how capability claims outrun implementation.

---

## 7. Implementation

_Benefit:_ converts every downstream claim from assertion to measurement.
_Complexity:_ Medium — mostly Cypher/Qdrant aggregation plus a reporting job.
_Risk:_ Low — read-only.
_Scalability:_ full-graph aggregates are O(n) and become infeasible at 100M nodes; from ~10M, switch to
incremental maintenance and sampled estimation for the `track` metrics, keeping exact computation only
for the `gate` metrics.
_Evaluation:_ the framework's own correctness is tested against a fixture graph with known values —
**a wrong metric is worse than no metric**, because it converts a real problem into a green light.
_Migration:_ additive, read-only; runs first as a scheduled job, then in CI.
_Rollback:_ stop the job.
_Enterprise value:_ this is the artifact an enterprise buyer, auditor, or acquirer asks for. "We
measure our knowledge quality along these axes and here are the trends" is a materially different
conversation from a feature list.
