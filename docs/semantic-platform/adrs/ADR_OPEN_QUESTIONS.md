# ADR Open Questions

**Date:** 2026-07-30. Unresolved assumptions that must be answered before the ADRs they affect can move
from `Proposed` to `Accepted`. Each states how to resolve it and what changes if the answer is negative.

> **2026-07-30 — credential-free investigation complete.** See
> `docs/semantic-platform/review/OQ_INVESTIGATION_FINDINGS.md`.
> **OQ-5 and IQ-3 fully answered. OQ-11 substantially answered. OQ-6 and OQ-1 partial.**
> No ADR status changed; remaining gaps are live-data only.

---

| ID        | Question                                                                                             | Affects                | Blocking?                          | How to resolve                                                                                 | If negative                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **OQ-1**  | What is the canonical `TransactionSummary` granularity (per account per month? per category?)        | ADR-001                | **Yes** for the reduction estimate | Read `normalizer.rs` summary construction; count distinct `(account_id, period)` in production | Finer granularity ⇒ reduction estimate is conservative and the case for ADR-001 strengthens                        |
| **OQ-2**  | Is a Plaid sync genuinely one homogeneous batch per tenant, or many?                                 | ADR-002                | **Yes** for the batch tier         | Inspect worker queue semantics and one live ingest trace                                       | If heterogeneous, the batch tier collapses and ADR-002 reduces to per-assertion (Option 3)                         |
| **OQ-3**  | Is Postgres sufficient for provenance beyond ~1B assertions, or is a columnar store required?        | ADR-002                | No — deferred                      | Model storage growth after Stage 5 measurement                                                 | Relational design does not foreclose columnar; migration is a later ADR                                            |
| **OQ-4**  | Do the 5 synthetic personas have enough domain coverage for ≥100 queries across 6 categories?        | ADR-004                | **Yes**                            | Count per-domain entities per persona                                                          | Seed additional synthetic personas; do **not** use real tenant data                                                |
| **OQ-5**  | Is `DocumentField` review state currently propagated to Qdrant at all?                               | ADR-005                | **Yes** for backfill design        | Inspect worker Qdrant payload construction                                                     | If absent, backfill must derive from Postgres rather than from existing payload                                    |
| **OQ-6**  | Is `entity_id` derived from a business key or opaque?                                                | ADR-006                | **Yes**                            | Read `normalizer.rs` entity id construction                                                    | If already business-derived, much of ADR-006 reduces to documenting existing behaviour — a cheaper, better outcome |
| **OQ-7**  | What does the `central` Neo4j database contain, and who writes to it?                                | ADR-009                | **Yes — hard gate**                | Read-only inventory before retirement                                                          | Any live content or writer halts retirement and re-opens the harvest option                                        |
| **OQ-8**  | Will entity resolution produce a numeric confidence or only a match/no-match decision?               | ADR-010                | No                                 | Determined during ADR-006 implementation                                                       | `resolution` becomes boolean; model reduces to two components plus a flag                                          |
| **OQ-9**  | ANOM-1: why do Neo4j (268) and Qdrant (251) disagree on tenant count by 17?                          | ADR-002, quality gates | **Yes** for integrity gates        | **Classify, do not repair** — see §OQ-9 below                                                  | **Never treat as deletable orphans.** If systematic ingest divergence, it becomes a Stage 0 blocker                |
| **OQ-10** | What predicate defines a "retrievable entity node" for the `:Entity` label (currently population 0)? | quality gates          | No                                 | Define or remove                                                                               | If no coherent predicate exists, remove `:Entity` from all designs rather than leaving it half-present             |
| **OQ-11** | Do any advisor queries traverse `user → HAS_TRANSACTION` in one hop today?                           | ADR-001                | **Yes**                            | grep + traversal trace + advisor query review                                                  | Each must be re-pointed to the 2-hop path before deprecation                                                       |
| **OQ-12** | Was any exposed credential actually **used** during its exposure window?                             | ADR-007                | **Yes** for incident closure       | Review Supabase/Fly/Qdrant auth logs                                                           | Unknown-use is the largest residual risk and cannot be closed by rotation alone (residual R-3)                     |

---

## OQ-9 — expanded method: classify, do not repair

**The first goal is not to fix the 17. It is to classify them.** A count is not a finding; a
classification is. Until every divergent tenant lands in a named bucket, none may be called an orphan
and none may be deleted.

Read-only method: enumerate distinct `tenant_id` in both stores, diff both directions (Neo4j-only and
Qdrant-only), then classify each tenant into exactly one bucket:

| #   | Bucket                                                   | Benign? | Implication                                                |
| --- | -------------------------------------------------------- | ------- | ---------------------------------------------------------- |
| 1   | Graph-only — no embeddable content ever existed          | ✅      | expected; adjust the metric definition                     |
| 2   | Graph-only — vector ingestion **failed**                 | ❌      | ingest defect; retrieval silently degraded for that tenant |
| 3   | Vector-only — different tenant representation/identifier | ❌      | identity defect; feeds ADR-006                             |
| 4   | Excluded by policy                                       | ✅      | document the exclusion                                     |
| 5   | Inactive or deleted in one store only                    | ❌      | **deletion incompleteness — feeds ADR-007 deletion proof** |
| 6   | Partially ingested (in flight or abandoned)              | ⚠️      | retry or reconcile                                         |
| 7   | Legacy identifier scheme                                 | ❌      | identity defect; feeds ADR-006                             |
| 8   | Test or synthetic tenant                                 | ✅      | exclude from production metrics explicitly                 |
| 9   | Genuinely inconsistent, unexplained                      | ❌      | **escalate; blocks integrity gates**                       |

**Escalation rules.** Any tenant in bucket 2, 3, 5, 7, or 9 makes OQ-9 a **Stage 0 blocker** rather than
a Stage 1 investigation. Bucket 5 is the most consequential: it would mean a prior deletion did not span
all stores, which is a live compliance finding and directly contradicts an assumption ADR-007 depends
on. Bucket 9 must never be closed by attrition — an unexplained tenant stays open.

_Output:_ `artifacts/graphrag-reconciliation/tenant_divergence_classification.json`, hashed tenant ids,
one bucket per tenant, zero unclassified.

## Questions this package deliberately does not answer

| Question                                              | Why deferred                                                                                                                                              | Owner              |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Provider-context retrieval design                     | Pre-existing open policy decision (`relationship_coverage.json: unresolved_policy_decisions`); ADR-003 only ensures the manifest _can express_ the answer | Security + Product |
| Should `GRAPH_GROUNDING_ENABLED` be enabled?          | Requires ADR-008 results and ADR-004 measurement first; explicitly a separate rollout ADR                                                                 | AI/Retrieval       |
| TTL/OWL disposition (generate vs delete)              | Not on the critical path; no runtime consumer                                                                                                             | Architecture       |
| Node privacy classification (`PHI`/`FINANCIAL`/…)     | Separate ADR; ADR-003 handles relationship-level policy only                                                                                              | Privacy/Governance |
| Cross-tenant / collective knowledge                   | `ln_central` empty; highest-risk feature; requires the policy plane to be live-store tested first                                                         | Product + Security |
| Whether `PersonaProfile` should exist as a node class | 1 per tenant, no consequential properties, only a fallback edge; revisit during SP-030                                                                    | Graph Platform     |
