# ADR-002 — Provenance Substrate and Granularity

**Status:** Proposed · **Date:** 2026-07-30 · **Decision deadline:** before any provenance write path
**Owners:** Graph Platform · **Reviewers:** Security, Privacy/Governance, Data Platform
**Related findings:** REVIEW R-2 (Critical), debt D-3 · Depends on ADR-001, ADR-010; enables ADR-007

---

## Context

The graph carries no edge-level provenance. `PROVENANCE_MODEL.md` (2026-07-30) proposed a parallel
in-graph assertion node per edge. The final review overturned that design. This ADR replaces it.

## Measured evidence

_Measured facts._ Production, 2026-07-30, read-only Cypher (`flyctl ssh console`), artifact
`artifacts/graphrag-reconciliation/production_baseline.json`.

| Fact                                    | Value         |
| --------------------------------------- | ------------- |
| Relationships                           | 3,208         |
| Relationships carrying **any** property | **0**         |
| Relationships carrying `tenant_id`      | 0             |
| `HAS_TRANSACTION` share                 | 1,951 (60.8%) |
| `Document` / `DocumentField` nodes      | 22 / 53       |
| `HAS_EXTRACTED_FIELD` edges             | 53            |

Query: `MATCH ()-[r]->() WHERE r.tenant_id IS NOT NULL RETURN count(r)` → 0.

_Measured code._ `apps/lifenavigator-core-api/app/clients/neo4j.py` exposes only `query_personal`,
`query_personal_dicts`, `_post_personal`, `ready` — **no write method** (command:
`grep -n "async def \|    def " .../clients/neo4j.py`). Confirms single-writer (Rust).

_Design inference._ One Plaid sync emits ~1,951 edges sharing identical origin metadata (same source,
extractor, version, timestamp). Per-edge provenance would store that metadata ~1,951 times.

_Unresolved assumption._ Whether Plaid sync is genuinely one batch or many per tenant is unverified
(OQ-2).

## Problem statement

Provenance must exist for governance, deletion proof, citation, and reproducibility. The previously
proposed 1:1 in-graph assertion model (a) roughly doubles graph size, (b) duplicates identical metadata
across bulk-ingested edges, and (c) requires a rebuild ("externalize above 50M") — deferring a
migration rather than avoiding one.

## Forces and constraints

Single writer must be preserved · no second graph writer may be introduced · deletion must be provable
across four stores · legacy edges cannot be assigned fabricated origins · traversal performance must
not degrade.

## Decision drivers

Storage efficiency at scale · deletion/retention operations · query performance · avoiding a known
future rebuild.

## Options considered

1. Inline edge properties.
2. Full in-graph assertion reification (edge → node).
3. Per-edge relational assertions (one row per edge).
4. **Hybrid batch/per-assertion relational provenance.**
5. Event-log-only provenance.
6. Object-store provenance documents.

## Comparative decision matrix

| Criterion            | 1 Inline | 2 In-graph | 3 Per-edge rel. | 4 Hybrid rel. | 5 Event log | 6 Object store |
| -------------------- | -------- | ---------- | --------------- | ------------- | ----------- | -------------- |
| Correctness          | 3        | 4          | 5               | 5             | 2           | 3              |
| Security             | 4        | 4          | 4               | 4             | 3           | 3              |
| Privacy/deletion     | 2        | 3          | 5               | 5             | **1 HB**    | 2              |
| Tenant safety        | 4        | 4          | 5               | 5             | 3           | 3              |
| Semantic fidelity    | 3        | 5          | 5               | 5             | 3           | 4              |
| Impl. complexity     | 4        | 3          | 3               | 3             | 3           | 3              |
| Migration complexity | 3        | 2          | 3               | 3             | 4           | 3              |
| Ops complexity       | 4        | 3          | 4               | 4             | 3           | 2              |
| Scalability          | 2        | **1 HB**   | 2               | **5**         | 4           | 3              |
| Reversibility        | 2        | 3          | 5               | 5             | 4           | 4              |
| Observability        | 2        | 4          | 5               | 5             | 4           | 2              |
| Cost                 | 3        | 1          | 2               | 5             | 4           | 4              |
| Maintainability      | 2        | 3          | 4               | 5             | 2           | 2              |

**Hard blockers.** Option 2: doubles the graph and mandates a future rebuild. Option 5: an append-only
event log cannot satisfy point-in-time deletion proof — you cannot delete from an immutable log, so
GDPR erasure becomes unprovable. Option 1 also degrades badly (Neo4j relationship properties are poorly
indexable and every schema change rewrites live edges) but is not formally blocking.

## Decision

**Adopt Option 4 — hybrid relational provenance, stored outside Neo4j.**

- **Postgres holds provenance.** Two tables: `assertion_batch` and `assertion`.
- **Graph edges carry a reference only** — `batch_id`, or `assertion_id`, or both.
- **Granularity by ingestion class:**

| Ingestion class                     | Granularity              | Rationale                                                          |
| ----------------------------------- | ------------------------ | ------------------------------------------------------------------ |
| Bulk API sync (Plaid, institutions) | `batch_id` only          | provenance genuinely identical across the batch                    |
| Document extraction                 | `assertion_id` (+ batch) | page/section/char-span differ per field — granularity is the value |
| User-stated                         | `assertion_id`           | each statement is a distinct act                                   |
| Inferred / derived                  | `assertion_id`           | must record strategy, inputs, ontology version                     |

**Both are allowed** when a batch-ingested edge later acquires per-assertion detail (e.g. a synced
record is subsequently user-confirmed): the edge keeps `batch_id` and gains `assertion_id`.

## Detailed design

**Immutable fields** (never updated; corrections create a new assertion + supersession):
`assertion_id`, `batch_id`, `source_system`, `actor`, `pipeline_version`, `ontology_version`,
`extractor_version`, `observed_at`, `created_at`.

**Mutable fields:** `assertion_status` (`active｜disputed｜retracted｜superseded`), `superseded_by`,
`effective_to`, confidence components (revisable when an extractor is found defective).

**Other fields:** `tenant_id`, `subject_id`, `predicate`, `object_id`, `evidence_refs[]`,
`effective_from`, confidence per ADR-010 (`source`, `extractor`, `resolution`).

**Challenge workflow.** A user or agent disputes an assertion → `assertion_status = disputed` →
excluded from citation, retained for audit → resolution creates a superseding assertion or restores
`active`. Never a silent overwrite.

**Deletion.** Source deletion cascades to derived assertions. Batch deletion cascades to all edges
carrying that `batch_id`. Deletion emits a machine-readable artifact with per-store counts (ADR-007).

**Dangling-reference prevention.** The worker writes provenance **before** the edge, in that order, and
a reconciliation job asserts every edge reference resolves. Foreign keys cannot span Postgres→Neo4j, so
this is an enforced invariant plus a detector, not a database constraint.

**Required invariant.** After the migration gate activates: _no new traversable domain relationship may
be written without a valid provenance reference._ Enforced in the Rust type system — edge creation
requires a `ProvenanceRef` obtainable only by writing provenance first. Sufficient because there is
exactly one writer (measured above).

**Legacy classification.** Existing 3,208 edges are classified explicitly as `unknown_legacy`, never
assigned fabricated origins.

## Security implications

Provenance leaves the graph, reducing what a graph-level compromise exposes. Postgres RLS applies.

## Privacy and governance implications

Enables deletion proof and per-extractor revocation. `DERIVED` knowledge becomes deletable because it
is reconstructible.

## Tenant-isolation implications

`tenant_id` on every provenance row; RLS enforced. Graph isolation unchanged.

## Data-model implications

Edges gain 1–2 scalar reference properties — the first properties they will carry.

## Scalability implications

Bulk edges cost **one shared row per batch** instead of one row per edge. At 1B edges dominated by bulk
sync, this is orders of magnitude less provenance storage than Option 2/3, and no rebuild is required.

## Operational implications

One new schema in an existing store. No new datastore. Reconciliation job added.

## Cost implications

Materially lower than any per-edge option; no graph growth.

## Developer-experience implications

Provenance queries become SQL — familiar, indexable, joinable. Cross-store joins are the cost.

## Migration plan

1. Schema + writer support, flag-off.
2. Forward-only writes; measure provenance completeness from 0%.
3. Activate the type-system gate (no edge without a reference).
4. Replay-recoverable backfill (document tier, Plaid tier).
5. Classify remainder `unknown_legacy`.

## Backfill plan

Only where a durable source record exists. **Never infer origin from edge shape** — the `RELATED_TO`
inventory is the precedent (uniform shape, origin only establishable from normalizer source).

## Compatibility strategy

Additive. Edges without references remain readable and traversable, subject to citation policy.

## Rollback strategy

Stop writing provenance; the graph never depended on it structurally. Tables can be dropped.

## Observability requirements

Provenance completeness ratio · dangling references (target 0) · orphan provenance rows (target 0) ·
per-batch edge counts.

## Evaluation plan

Cascade correctness test; replay fidelity 100%; storage per 1M edges measured against projection.

## Falsification criteria

If bulk-sync provenance proves genuinely heterogeneous per edge (OQ-2 resolves negatively), the batch
tier collapses to per-assertion and Option 3 becomes correct.

## Acceptance criteria

0 dangling references · 0 orphan rows · provenance completeness ratcheting · deletion cascade proven in
dry-run · type-system gate demonstrably rejects a bare edge write.

## Non-goals

Not building an event-sourcing system. Not making provenance traversable in the graph. Not backfilling
inferred origins.

## Risks accepted

Cross-store referential integrity is an invariant plus detector, not a foreign key. Accepted: the
single-writer property makes the invariant enforceable at the only place edges are created.

## Residual uncertainty

OQ-2 (batch homogeneity). OQ-3: whether Postgres or a columnar store is right beyond ~1B assertions —
deferred; the relational design does not foreclose it.

## Consequences

Provenance becomes affordable, deletion becomes provable, and the graph stays a graph.

## Follow-up work

ADR-007 deletion proof; ADR-010 confidence fields; challenge-workflow UX.

## Superseded documents

**Supersedes `PROVENANCE_MODEL.md` §2, §2.1, §5** (in-graph parallel assertion graph, 1:1 granularity,
"externalize above 50M"). Retains §3 rationale (independent retention/revision/reproducibility), §4
enforcement, §6 reproducibility contract, §7 metrics.

## Approval record

| Reviewer  | Role               | Verdict | Date |
| --------- | ------------------ | ------- | ---- |
| _pending_ | Graph Platform     | —       | —    |
| _pending_ | Security           | —       | —    |
| _pending_ | Privacy/Governance | —       | —    |
