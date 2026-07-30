# Enterprise Scalability Plan

**Status:** Designed · **Date:** 2026-07-30 · Parent: `SEMANTIC_PLATFORM_ARCHITECTURE.md`

Covers brief Phases 12 and 13.

---

## 1. The gap, stated honestly

| Dimension             | Today                               | Target        | Factor        |
| --------------------- | ----------------------------------- | ------------- | ------------- |
| Nodes                 | 2,506                               | 100,000,000   | **~40,000×**  |
| Relationships         | 3,208                               | 1,000,000,000 | **~312,000×** |
| Tenants               | 268                                 | millions      | ~4,000×       |
| Vectors               | 2,218                               | ~100M         | ~45,000×      |
| Concurrent retrievals | untested                            | thousands     | unknown       |
| Compute               | 1 × shared-CPU / 512 MB per service | —             | —             |

**Capacity is unknown, not merely insufficient.** No load test has been run. The single most valuable
scalability action available today is not an architecture change — it is measuring what one 512 MB
machine actually does, because every projection below is otherwise extrapolation from zero.

---

## 2. Design posture: scale-compatible, not scale-premature

Two failure modes, and this plan rejects both:

- **Scale-premature** — building sharding, partitioning, and multi-region for 2,506 nodes. Adds failure
  modes and operational burden that buy nothing, and delays the provenance and governance work that
  _does_ buy something.
- **Scale-foreclosing** — making choices that cannot survive growth: tenant-agnostic ids, unbounded
  traversal, full-graph aggregates on the request path, single-model embedding assumptions baked into
  storage.

**Every recommendation states a trigger threshold, not a build date.** Work begins when the trigger
fires, and the trigger is a measured metric.

| Capability                             | Trigger                                             |
| -------------------------------------- | --------------------------------------------------- |
| Load testing                           | **now** — capacity is unknown                       |
| Connection pooling                     | **now** — per-call client construction is on record |
| Read replicas                          | p95 retrieval > budget, or read QPS > 100           |
| Graph partitioning by tenant           | > 10M nodes, or single-tenant subgraph > 100k nodes |
| Vector sharding / collection-per-shard | > 10M points                                        |
| Incremental quality metrics            | > 1M nodes (full aggregates become infeasible)      |
| Assertion store externalization        | > 50M assertions                                    |
| Multi-region                           | latency SLO by geography                            |
| Memory consolidation / compression     | per-tenant node count > 10k                         |

---

## 3. What already scales

Worth stating, because it constrains what must change:

**Tenant-partitioned by nature.** Every node carries `tenant_id`; 268 tenants hold ~9 nodes each on
average. The graph is not one connected 100M-node structure — it is millions of small, disjoint
per-tenant subgraphs. **This is the single most favourable scalability property the system has.** It
means partitioning is nearly trivial when needed (partition key already exists, no cross-partition
edges — verified: 0 cross-tenant `RELATED_TO`), and traversal cost is bounded by _one tenant's_
subgraph, not by total size.

The implication is important: **100M nodes across millions of tenants is a much easier problem than
100M nodes in one graph.** The design should protect this property, not engineer around it.

**Catalog-driven policy** is static data — cacheable, negligible at any scale.
**Bounded traversal** (depth/breadth/node budget) means per-query cost is independent of graph size.

---

## 4. What breaks first

Ordered by when it bites, based on the measured baseline:

1. **Single 512 MB machine, no pooling.** Per-call `httpx.AsyncClient` construction pays a TLS
   handshake per store call. This breaks at tens of concurrent users, not millions. **First thing to
   fix, and it is cheap.**
2. **Full-graph aggregates.** The quality framework's `MATCH (n) RETURN count(n)` is fine at 2,506 and
   fatal at 100M. Must become incremental/sampled above ~1M (`SEMANTIC_QUALITY_FRAMEWORK.md` §7).
3. **Unindexed traversal predicates.** With 40 relationship types and no measured query plans, index
   coverage is unverified. Index-not-used is already an automatic stop condition; make it a standing
   check, not just a migration gate.
4. **Assertion 1:1 with edges.** 1B edges → 1B assertions. Trigger at 50M: keep `assertion_id` on the
   edge, move the assertion body to a columnar store; the parallel-graph design was chosen partly
   because it permits exactly this without touching the domain graph (`PROVENANCE_MODEL.md` §2.1).
5. **Embedding cost.** 100M vectors at 3072 dims ≈ 1.2 TB raw. Requires quantization and tiered
   storage. Note the tension with `SEMANTIC_PLATFORM_ARCHITECTURE.md` §6: multi-model routing is
   deferred, but quantization of a _single_ model is a storage decision, not a semantic one, and is
   safe.

---

## 5. Multi-version coexistence

The brief requires multiple ontology versions, multiple embedding models, multiple AI providers
concurrently.

**Ontology versions** — already supported in principle: every assertion pins its version, and past
traces are immutable (I-10). What is missing is _serving_ two versions simultaneously; the manifest
loader must become version-aware rather than loading one file.

**Embedding models** — the hard one. Vectors from different models are **not comparable**, so a mixed
collection silently degrades retrieval with no error. Rules: one model per collection, never mixed;
model id recorded per point; migration is re-embed-then-swap, never in-place; dimension mismatch is
already an automatic stop condition. The retired-768-dim default that persists in config is a live
instance of this hazard.

**AI providers** — already abstracted behind a model routing layer; provider choice is recorded per
response for reproducibility.

---

## 6. Long-term memory (brief Phase 13)

Memory types map onto existing structures rather than requiring new stores:

| Memory type    | Realization                                              | Exists                        |
| -------------- | -------------------------------------------------------- | ----------------------------- |
| Semantic       | the graph itself                                         | ✓                             |
| Episodic       | `LifeDecision`, `DecisionScenario`, advisor turn history | partial                       |
| Procedural     | workflow definitions, playbooks                          | partial                       |
| Working        | request-scoped context packet                            | ✓                             |
| Organizational | tenant-level aggregates                                  | ✓                             |
| Collective     | cross-tenant patterns                                    | **✗ — `ln_central` is empty** |

**Decay, reinforcement, importance** are already defined as retrieval weighting in
`TEMPORAL_MODEL.md` §5 — they modulate _retrievability_, never truth. A decayed fact is not forgotten;
it is deprioritized. This distinction is what keeps memory management from becoming silent data loss.

**Consolidation and compression** — above ~10k nodes per tenant, summarize dense repetitive regions
(the 1,951 `HAS_TRANSACTION` edges are the obvious candidate) into higher-level assertions with
provenance pointing at the summarized set. The details remain; retrieval prefers the summary. This is
the only way per-tenant traversal stays bounded as history accumulates over a decade.

**Forgetting is governance, not optimization.** Actual deletion happens under retention policy
(`SEMANTIC_GOVERNANCE.md` §5), with cascade across all four stores. Never as a performance measure.

**Collective memory is deliberately last.** Cross-tenant knowledge is the highest-risk feature in the
platform, and `ln_central` being empty means there is no sunk cost arguing for it. It ships only after
the policy plane is Live-store tested — never before.

---

## 7. Per-recommendation assessment

**Load testing and connection pooling (immediate)**
_Benefit:_ converts unknown capacity to known; removes per-request handshake tax.
_Complexity:_ Low.
_Risk:_ Low. _Scalability impact:_ High — everything else is guesswork without it.
_Evaluation:_ p50/p95 per endpoint before/after; documented capacity at defined concurrency.
_Migration:_ pooled clients at startup, closed at shutdown. _Rollback:_ revert to per-call.
_Enterprise value:_ "what is your capacity" is a procurement question with no current answer.

**Tenant partitioning (trigger: 10M nodes)**
_Benefit:_ linear scaling on the existing natural boundary.
_Complexity:_ Medium — key exists, no cross-partition edges to untangle.
_Risk:_ Medium — routing bugs become isolation bugs, the most severe class.
_Evaluation:_ cross-partition traversal count must be 0; existing property tests extend directly.
_Migration:_ route by `tenant_id`, backfill by copy, verify counts, cut over. _Rollback:_ route back.
_Extensibility:_ partition key is also the residency key when data-locality requirements arrive.

**Memory consolidation (trigger: 10k nodes/tenant)**
_Benefit:_ bounded traversal cost as history grows; better retrieval precision.
_Complexity:_ Medium-High — summarization must carry provenance to the summarized set.
_Risk:_ Medium — a summary that misrepresents its details is a fabrication vector; summaries are
`inference_status = derived` and separately confidence-scored.
_Evaluation:_ answer quality with vs without consolidation on the golden set; **no regression** is the
gate, not "improvement".
_Migration:_ additive; summaries added, details retained. _Rollback:_ stop preferring summaries.
