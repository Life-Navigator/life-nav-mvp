# Provenance Model

**Status:** Designed · **Date:** 2026-07-30 · Parent: `SEMANTIC_PLATFORM_ARCHITECTURE.md`

Covers brief Phase 2. This is **net-new construction**, not an enhancement — see §1.

---

## 1. Measured starting point

| Fact                                       | Value   |
| ------------------------------------------ | ------- |
| Relationships in production                | 3,208   |
| Relationships carrying **any** property    | **0**   |
| Relationships carrying `created_at`        | 0       |
| Relationships carrying source attribution  | 0       |
| Relationships carrying `tenant_id`         | 0       |
| Nodes carrying `created_at` / `updated_at` | present |
| `Evidence` nodes                           | 63      |
| `Document` / `DocumentField` nodes         | 22 / 53 |

The graph has **node-level timestamps and a partial evidence tier, and no edge-level provenance at
all.** The brief's requirement — _"No graph relationship should exist without attributable origin"_ —
is currently violated by 100% of relationships.

The document tier is the exception worth building on: `Document → HAS_EXTRACTED_FIELD → DocumentField`
(53 edges) already models extraction, and the Document Intelligence work added page/section/char-span
provenance with confidence bands and a human review loop. **That is the pattern to generalize**, not
replace.

---

## 2. The provenance chain

The brief specifies:

```
Document → Chunk → Extraction → Entity → Relationship → Inference → Recommendation → Advisor Response
```

Modelled as a **parallel graph**, not as properties on the domain graph. Rationale in §3.

```
(:Source {source_id, kind, uri_hash, content_hash, ingested_at, tenant_id})
   │ HAS_CHUNK
(:Chunk {chunk_id, ordinal, span_start, span_end, content_hash})
   │ YIELDED_EXTRACTION
(:Extraction {extraction_id, extractor, extractor_version, model_id,
              confidence, page, section, char_span, extracted_at})
   │ ASSERTS
(:Assertion {assertion_id, subject_id, predicate, object_id,
             inference_status, ontology_version, pipeline_id, pipeline_version,
             asserted_by, asserted_at, confidence, assertion_status})
   │ MATERIALIZES
   └──► the actual (a)-[:TYPED_EDGE]->(b) in the domain graph
   │ SUPPORTS
(:Inference {inference_id, strategy, inputs[], ontology_version, computed_at})
   │ INFORMS
(:Recommendation) ──► (:AdvisorResponse {response_id, trace_id, retrieval_version, prompt_version})
```

### 2.1 The `Assertion` node is the hinge

Every domain edge gets exactly one `Assertion` node describing it. The domain edge carries a single
property — `assertion_id` — and nothing else.

This is the key design decision. Alternatives considered and rejected:

| Option                                               | Verdict                                                                                                                                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Properties directly on domain edges                  | **Rejected.** Neo4j relationship properties are not indexable in Aura the way node properties are; provenance queries would require full edge scans. Also makes every provenance schema change a rewrite of 3,208+ live edges. |
| Reified edges (edge → node) replacing typed edges    | **Rejected.** Destroys traversal performance and readability; every 1-hop becomes 2-hop. The existing typed-edge traversal is the thing that works.                                                                            |
| **Parallel assertion graph keyed by `assertion_id`** | **Chosen.** Domain graph stays fast and readable; provenance is independently indexable, independently retained, and independently deletable.                                                                                  |

_Benefit:_ provenance completeness without degrading traversal.
_Complexity:_ Medium — new store, new writer, backfill.
_Risk:_ Medium — a second write path can drift from the first; mitigated by making assertion creation
the _only_ way the writer may create an edge (see §4).
_Scalability:_ the assertion graph is ~1:1 with edges — 1B edges implies 1B assertions. At that scale
assertions move to a columnar store keyed by `assertion_id` with the graph holding only the id. Design
is compatible; see `ENTERPRISE_SCALABILITY_PLAN.md` §5.
_Migration:_ §5 below.
_Rollback:_ stop writing assertions; domain graph unaffected — it never depended on them structurally.

---

## 3. Why parallel rather than inline

Three properties fall out that inline provenance cannot provide:

**Independent retention.** GDPR/CCPA deletion of a _source document_ must remove the evidence trail
while potentially preserving a user-confirmed fact that the document originally suggested. Inline
provenance forces deleting the fact or lying about its origin. A parallel graph lets the assertion be
retracted and re-attributed to `user_stated` with an audit record.

**Independent confidence revision.** When an extractor version is found defective, every assertion it
produced must be re-scored. With a parallel graph that is one indexed query on `extractor_version`.
Inline, it is a full-graph scan.

**Reproducibility without freezing the graph.** An `AdvisorResponse` pins `trace_id` +
`ontology_version` + `retrieval_version`. The assertion graph is append-mostly with
`assertion_status` transitions, so a past answer can be reconstructed exactly (invariant I-7, I-10)
even though the domain graph has moved on.

---

## 4. The enforcement rule

> **The ingestion writer may not create a domain edge except by creating its `Assertion` first.**

Structurally enforced, not conventionally. The Rust writer's edge-creation function takes an
`AssertionId` parameter that can only be obtained by constructing an `Assertion` — making a
provenance-free edge **unrepresentable in the type system** rather than merely discouraged.

This is the same lesson as the relationship catalog: the defects that produced this workstream were all
cases where the correct behaviour was _available_ but not _required_. A `match` that could be bypassed,
a dict that could drift, a domain string that could be misspelled. Make the wrong thing impossible to
express.

**Synthetic exemption (invariant I-4).** Assertions with `inference_status = derived` and
`source_kind = synthetic` are permitted without an upstream `Source`. They must still have an
`Assertion` node stating _who computed them, when, with which strategy and ontology version_. Synthetic
means "no external evidence", never "no accountability".

---

## 5. Migration plan

The 3,208 existing edges have no provenance and it **cannot be invented**. Attempting to backfill
plausible origins would manufacture false audit trails — worse than an honest gap.

**Phase A — forward-only.** New writes create assertions. Existing edges remain bare. Measured metric:
`provenance_completeness = assertions / total_edges`, starting at 0 and rising with new ingest.

**Phase B — reconstructible subset.** Edges whose source records still exist in Postgres/object storage
are re-derived by replay, producing genuine assertions. The document tier (75 nodes) and Plaid-derived
financial tier are candidates — both have durable upstream records. Expected recoverable: the financial
and document tiers, ~1,500–2,000 edges.

**Phase C — explicit classification of the remainder.** Every edge still lacking provenance is stamped
`inference_status = unknown_legacy` with an `Assertion` recording _"origin not recoverable; predates
provenance layer."_ This is not cosmetic: it converts an invisible gap into a queryable, auditable,
reportable one, and lets governance policy treat legacy assertions differently (e.g. non-citable until
confirmed).

**Never:** infer origin from edge shape. The `RELATED_TO` inventory is the precedent — 148 edges with a
perfectly uniform shape whose origin was still only establishable by reading the normalizer source.

---

## 6. Reproducibility contract

An `AdvisorResponse` is reproducible when replaying its trace yields the identical evidence set.

Pinned per response: `trace_id`, `ontology_version`, `retrieval_version`, `prompt_version`,
`policy_version`, `as_of` timestamp, ordered assertion ids, per-assertion confidence at answer time.

**Determinism boundary.** The retrieval and evidence-selection path must be fully deterministic given
these pins. The _language model's_ generation is not, and the platform must not claim it is — invariant
I-7 covers the evidence chain, not the prose. The brief's instruction _"Never expose hidden model
reasoning"_ is honoured by tracing **what the model was given and what policy allowed**, never by
reconstructing why it wrote a sentence.

This distinction is what makes the trace defensible in an audit: we assert reproducible _inputs and
authorization_, not reproducible _language_.

---

## 7. Evaluation

| Metric                  | Definition                                         | Gate                            |
| ----------------------- | -------------------------------------------------- | ------------------------------- |
| Provenance completeness | assertions / edges                                 | ratchets upward; never declines |
| Attribution depth       | mean chain length assertion→source                 | ≥ 3 for document-derived        |
| Replay fidelity         | identical evidence set on trace replay             | 100%, CI-gated                  |
| Orphan assertions       | assertions with no materialized edge               | 0                               |
| Dangling edges          | edges with `assertion_id` that resolves to nothing | 0                               |
| Cascade correctness     | source deletion removes all derived assertions     | 100%, tested                    |

Gates are enforced in CI against a fixture graph and re-verified in production reconciliation.
