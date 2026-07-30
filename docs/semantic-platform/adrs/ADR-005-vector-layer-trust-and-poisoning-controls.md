# ADR-005 — Vector-Layer Trust, Review State, and Poisoning Controls

**Status:** Proposed · **Date:** 2026-07-30 · **Decision deadline:** before document ingestion scales
**Owners:** Security · **Reviewers:** AI/Retrieval, Document Intelligence, Privacy
**Related findings:** REVIEW R-6 (High), debt D-9 · Depends on ADR-010; feeds ADR-004

---

## Context

User-uploaded documents are extracted, embedded, and stored in Qdrant. Retrieval selects by semantic
similarity. Prompt-layer injection defenses are designed but unbuilt; the contamination vector is at
ingestion, and the vector persists long after the upload context is gone.

## Measured evidence

_Measured facts._ Production Qdrant, 2026-07-30, read-only REST:

- `life_navigator`: 2,218 points, 3072-dim, status green
- Payload indexes: `user_id`, `domain`, `tenant_id`, `entity_type`, `access_scope`
- `access_scope` distribution: `personal` = 2,218 (100%) — **no provider/B2B content in the personal
  collection**
- `domain=documents`: 75 points
- `ln_central`: **0 points**

Commands: `GET /collections/life_navigator`; `POST /collections/life_navigator/facet` on
`access_scope` and `domain`. Artifact: `artifacts/graphrag-reconciliation/production_baseline.json`.

_Design inference._ No payload field encodes **trust or review state**. Retrieval therefore cannot
distinguish a reviewed institutional statement from an unreviewed user-uploaded PDF; both are selected
purely by cosine similarity.

_Unresolved assumption._ Whether `DocumentField` review state is currently propagated to Qdrant at all
(OQ-5). Evidence suggests not, since no such payload index exists.

## Problem statement

Unreviewed or adversarial document content can enter a privileged reasoning or mutation path solely
because it is semantically similar to the query.

## Forces and constraints

Filtering must occur **during** vector search, not after — post-filtering means the poisoned point
consumed a top-k slot and displaced legitimate evidence · payload indexes already exist for the pattern ·
must not require re-embedding.

## Decision drivers

Preventing privileged-path contamination · minimal new infrastructure · reversible reclassification.

## Options considered

1. Retrieve all, filter downstream.
2. **Filter by payload during vector search.**
3. Separate trusted/untrusted collections.
4. Separate vector namespaces.
5. Do not embed unreviewed documents at all.

## Comparative decision matrix

| Criterion            | 1 Post-filter | 2 Payload filter | 3 Two collections | 4 Namespaces | 5 Don't embed |
| -------------------- | ------------- | ---------------- | ----------------- | ------------ | ------------- |
| Correctness          | **2 HB**      | 5                | 4                 | 4            | 3             |
| Security             | 2             | 5                | 5                 | 4            | 5             |
| Privacy              | 3             | 5                | 4                 | 4            | 5             |
| Tenant safety        | 4             | 5                | 4                 | 4            | 4             |
| Semantic fidelity    | 4             | 5                | 3                 | 3            | **2 HB**      |
| Impl. complexity     | 5             | 4                | 2                 | 3            | 5             |
| Migration complexity | 5             | 4                | 2                 | 3            | 4             |
| Ops complexity       | 5             | 4                | 2                 | 3            | 5             |
| Scalability          | 3             | 5                | 3                 | 4            | 5             |
| Reversibility        | 5             | 5                | 2                 | 3            | 2             |
| Observability        | 3             | 5                | 4                 | 4            | 3             |
| Cost                 | 3             | 5                | 3                 | 4            | 5             |
| Maintainability      | 3             | 5                | 2                 | 3            | 4             |

**Hard blockers.** Option 1: post-filtering lets untrusted points consume top-k slots, silently
starving legitimate evidence — the failure is invisible. Option 5: never embedding unreviewed documents
makes the review loop unusable (a user cannot find the document they just uploaded to review it) and
destroys the product's document-intelligence value.

Option 3 was seriously considered and rejected on reversibility: reclassifying a document's trust level
would require moving points between collections, which is a write migration for what should be a field
update.

## Decision

**Adopt Option 2 — trust and review state as indexed Qdrant payload fields, applied as search filters.**

## Detailed design

New payload fields (all `keyword`, all indexed):

| Field                | Values                                                                                  | Meaning                        |
| -------------------- | --------------------------------------------------------------------------------------- | ------------------------------ |
| `source_trust`       | `verified_db｜user_stated｜document_reviewed｜document_unreviewed｜inferred｜synthetic` | origin trust tier              |
| `review_state`       | `unreviewed｜confirmed｜edited｜rejected`                                               | human review outcome           |
| `assertion_state`    | `active｜disputed｜retracted｜superseded`                                               | mirrors ADR-002                |
| `citation_eligible`  | bool                                                                                    | may be quoted                  |
| `reasoning_eligible` | bool                                                                                    | may influence a recommendation |
| `action_eligible`    | bool                                                                                    | may justify a mutation         |

**Filter composition** (all conjunctive with existing `tenant_id` + `domain`):

| Path                             | Required filter                                                        |
| -------------------------------- | ---------------------------------------------------------------------- |
| Advisor context (read)           | `assertion_state=active`                                               |
| Citation                         | `+ citation_eligible=true`                                             |
| Recommendation reasoning         | `+ reasoning_eligible=true`                                            |
| **Autonomous action / mutation** | `+ action_eligible=true AND source_trust ∈ {verified_db, user_stated}` |

**Required invariant.** _Unreviewed or disallowed knowledge cannot enter a privileged reasoning or
mutation path merely because it is semantically similar._ The mutation filter enforces the existing
privileged-sink rule at the vector layer, where it can actually be applied.

**Reclassification** is a payload update — no re-embedding, no point movement.
**Poisoning incident response:** set `assertion_state=retracted` on affected points (immediate removal
from all paths), then investigate, then delete under ADR-007 cascade if warranted.
**Stale vectors:** points whose source document is deleted are removed by the ADR-007 cascade; a
reconciliation job detects survivors.

## Projection integrity — the denormalization is security-relevant, not "eventually consistent"

Qdrant payload trust state is a **derived projection** of authoritative Postgres assertion state
(CONFLICT-1). Duplication is forced: filtering must occur during search, and Qdrant cannot join to
Postgres. It must therefore be governed as a security control with measurable integrity requirements,
**not** waved through as eventual consistency.

**Drift is asymmetric and the two directions must never share a severity.**

| Direction                             | Meaning                                             | Class                           | Response                                           |
| ------------------------------------- | --------------------------------------------------- | ------------------------------- | -------------------------------------------------- |
| Postgres **allow** → Qdrant **block** | legitimate evidence withheld                        | **Availability defect**         | alert, repair on next reconciliation               |
| Postgres **block** → Qdrant **allow** | disallowed knowledge reachable by a privileged path | **Security/integrity incident** | **immediate**: quarantine tenant or halt retrieval |

Treating these as one metric would let an incident be triaged as a blip. They are separate metrics,
separate alerts, separate runbooks.

**Required properties:**

1. Every point carries `trust_policy_version`.
2. Every payload trust state is traceable to an authoritative Postgres assertion or batch record.
3. **No authoritative disallow may ever be represented as allow in Qdrant** — the invariant.
4. Reconciliation classifies drift as _conservative_ (safe) or _dangerous_ (unsafe) and never reports a
   single undifferentiated count.
5. Dangerous drift triggers retrieval shutdown or tenant-level quarantine, automatically.
6. Trust changes propagate within a defined maximum interval (**propagation SLO**, initially 60s;
   breach is an alert, not a silent lag).
7. Deletion and revocation are verified in **both** systems before either is reported complete.

**Fail-safe ordering.** On a trust _downgrade_, write Qdrant first, then Postgres — a transient
conservative drift is acceptable. On a trust _upgrade_, write Postgres first, then Qdrant. Ordering is
chosen so the transient state is always the safe one.

## Security implications

Primary benefit. Converts a latent contamination path into a filtered one. The projection itself
becomes a governed control with an explicit unsafe-direction invariant (above).

## Privacy implications

`access_scope` already segregates B2B content (measured 100% personal); these fields extend the same
pattern to trust.

## Tenant-isolation implications

Unchanged — `tenant_id` filter is independent and remains mandatory.

## Data-model implications

Six payload fields; mirrors ADR-002 assertion state so the two cannot disagree.

## Scalability implications

Indexed keyword filters are cheap; filtering during search reduces work.

## Operational implications

Backfill of existing 2,218 points required (payload-only, no vector change) — explicitly within the
authorized "correct Qdrant payload metadata without changing valid vectors" class.

## Cost implications

Negligible; slightly reduced retrieval cost.

## Developer-experience implications

Trust becomes queryable rather than implicit.

## Migration plan

1. Add fields + payload indexes.
2. Writer populates for new points.
3. Backfill existing points from source system (dry-run first): `verified_db` for Plaid-derived,
   `document_*` per review state, `user_stated` for chat-captured.
4. Apply filters behind `VECTOR_TRUST_FILTERING`, read paths first, mutation path last.

## Backfill plan

Deterministic from `source_system`; **no inference**. Points whose source cannot be determined get
`source_trust=inferred` and `citation_eligible=false` — fail closed.

## Compatibility strategy

Filters default to permissive until the flag enables them, so backfill and enforcement are separable.

## Rollback strategy

Disable the flag; payload fields are inert. Fully reversible.

## Observability requirements

Retrieval counts by `source_trust` · rejected-by-filter counts · reclassification events ·
disputed/retracted point counts · **dangerous drift count (target 0, paging alert)** ·
**conservative drift count (non-paging)** · propagation latency p95 against the 60s SLO ·
`trust_policy_version` distribution.

## Evaluation plan

ADR-004 poisoned-document category: a crafted document must never reach a citation or mutation path.
Measured, gated at zero.

## Falsification criteria

If filtering measurably degrades legitimate retrieval (golden-set regression on known-present), the
eligibility defaults are too strict and must be retuned before enforcement.

## Acceptance criteria

All 2,218 points classified · 0 unclassified in a privileged path · poisoned-document scenarios blocked
at 100% · no known-present regression · **every point carries `trust_policy_version`** · **every payload
state traceable to an authoritative record** · **dangerous drift = 0, demonstrated by an injected-drift
test that proves the quarantine fires** · conservative drift within budget · propagation SLO met ·
deletion and revocation verified in both stores.

## Non-goals

Not building prompt-layer injection defense (separate, still required). Not separate collections.

## Risks accepted

Backfill accuracy depends on source-system attribution being correct today. Mitigated by failing closed
on unknown.

## Residual uncertainty

OQ-5 (current review-state propagation).

## Consequences

The privileged-sink rule becomes enforceable at the retrieval layer rather than only at the prompt.

## Follow-up work

Prompt-layer injection defense; ADR-007 cascade includes vector deletion.

## Superseded documents

Extends `SEMANTIC_GOVERNANCE.md`; supersedes the assumption in `CONFIDENCE_MODEL.md` §6 that citation
gating is sufficient at the assertion layer alone.

## Approval record

| Reviewer  | Role         | Verdict | Date |
| --------- | ------------ | ------- | ---- |
| _pending_ | Security     | —       | —    |
| _pending_ | AI/Retrieval | —       | —    |
