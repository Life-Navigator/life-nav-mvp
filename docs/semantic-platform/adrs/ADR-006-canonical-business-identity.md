# ADR-006 — Canonical Business Identity and Entity Resolution

**Status:** Proposed · **Date:** 2026-07-30 · **Decision deadline:** before any consolidation work
**Owners:** Data Platform · **Reviewers:** Graph Platform, Domain owners, Privacy
**Related findings:** REVIEW R-8 (High) · Depends on ADR-002, ADR-010

---

## Context

No node class declares a natural key. Duplicate detection, merge, and consolidation are therefore
undecidable, and `SEMANTIC_QUALITY_FRAMEWORK.md` lists duplicate-entity and duplicate-relationship
gates that cannot currently be computed.

## Measured evidence

_Measured facts._ Production 2026-07-30: 47 node labels, 2,506 nodes, 268 tenants. Node properties
observed on `PersonaProfile`: `user_id, entity_id, tenant_id, id, metadata, created_at, entity_type,
updated_at` (from `RELATED_TO` sample query). `FinancialAccount` 419, `TransactionSummary` 984,
`Document` 22, `DocumentField` 53, `UserProfile` 268, `PersonaProfile` 148.

_Measured fact._ `PersonaProfile` = 148 nodes across 148 distinct tenants = **exactly 1 per tenant**
(`related_to_inventory.json`, class RT-C1) — an empirically singleton class.

_Design inference._ `entity_id` exists on nodes and is used as the traversal key
(`traversal.py:108,125`), but it is a _system_ identifier. Whether it is derived from a business key or
is opaque is **unverified** (OQ-6). If opaque, re-ingesting the same real-world entity from a second
source produces a duplicate node with no way to detect it.

## Problem statement

Without declared business identity, the platform cannot detect duplicates, cannot merge safely, and
cannot guarantee that one real-world thing is one node.

## Forces and constraints

Merges are destructive and must be reversible (ADR-002 supersession) · tenant boundaries must not be
crossed · entity-resolution confidence must never be read as factual confidence.

## Decision drivers

Decidability of duplication · reversibility · tenant safety · avoiding premature probabilistic matching.

## Options considered

1. Source-record identity only (status quo).
2. **Deterministic composite keys, tenant-local.**
3. Global canonical identity (cross-tenant).
4. Tenant-local canonical identity with alias table.
5. Probabilistic resolution.
6. Human-reviewed resolution for sensitive classes.

## Comparative decision matrix

| Criterion            | 1 Source-only | 2 Deterministic | 3 Global | 4 Tenant-local+alias | 5 Probabilistic | 6 Human-reviewed |
| -------------------- | ------------- | --------------- | -------- | -------------------- | --------------- | ---------------- |
| Correctness          | 2             | 5               | 4        | 5                    | 3               | 5                |
| Security             | 4             | 5               | **1 HB** | 5                    | 3               | 5                |
| Privacy              | 4             | 5               | **1 HB** | 5                    | 3               | 5                |
| Tenant safety        | 4             | 5               | **1 HB** | 5                    | 3               | 5                |
| Semantic fidelity    | 2             | 4               | 4        | 5                    | 4               | 5                |
| Impl. complexity     | 5             | 4               | 2        | 3                    | 2               | 2                |
| Migration complexity | 5             | 4               | 1        | 3                    | 2               | 2                |
| Ops complexity       | 5             | 4               | 2        | 4                    | 2               | **2**            |
| Scalability          | 3             | 5               | 3        | 4                    | 3               | 1                |
| Reversibility        | 5             | 4               | 2        | 4                    | 2               | 4                |
| Observability        | 2             | 4               | 3        | 5                    | 3               | 5                |
| Cost                 | 5             | 4               | 2        | 4                    | 2               | 1                |
| Maintainability      | 2             | 5               | 2        | 4                    | 2               | 3                |

**Hard blockers.** Option 3: a cross-tenant canonical identity creates a join path between tenants —
the single most severe failure mode in the platform. Disqualified on tenant safety, security, and
privacy simultaneously, regardless of utility.

## Decision

**Adopt Option 2 as the baseline, composed with Option 4 (alias table) and Option 6 for sensitive
classes.** Identity is **tenant-local by default**; broader scope requires a proven business case and a
separate ADR.

## Detailed design

Each node class spec declares:

```rust
business_identity: BusinessKey,   // composite of stable fields, or None
identity_scope:    Scope,         // TenantLocal (default) | Platform (requires ADR)
merge_eligible:    bool,
split_eligible:    bool,
merge_confidence_threshold: Option<f32>,
human_review_required: bool,
```

Initial declarations for the highest-volume live classes:

| Class                            | Business key                                | Scope                            | Merge  | Human review |
| -------------------------------- | ------------------------------------------- | -------------------------------- | ------ | ------------ |
| `UserProfile`                    | `{tenant_id}`                               | TenantLocal                      | no     | —            |
| `PersonaProfile`                 | `{tenant_id}` (singleton)                   | TenantLocal                      | no     | —            |
| `FinancialAccount`               | `{tenant_id, institution_id, account_mask}` | TenantLocal                      | yes    | no           |
| `TransactionSummary`             | `{account_id, period_start, period_end}`    | TenantLocal                      | yes    | no           |
| `Document`                       | `{tenant_id, content_hash}`                 | TenantLocal                      | yes    | no           |
| `DocumentField`                  | `{document_id, field_path}`                 | TenantLocal                      | yes    | no           |
| `Dependent`, `SpouseProfile`     | `BusinessKey::None`                         | TenantLocal                      | **no** | **yes**      |
| `EstatePlan`, `GuardianshipPlan` | `BusinessKey::None`                         | TenantLocal                      | **no** | **yes**      |
| `School`, `Program`              | `{external_ref}`                            | Platform (public reference data) | yes    | no           |

**`BusinessKey::None` means the class is excluded from automatic merging** — absence of a key is a hard
block, never a low score. This is how the standing rule _"never auto-merge below confidence — queue for
review"_ becomes enforceable rather than aspirational.

**Aliases.** An alias table maps source identifiers → canonical `entity_id`, so re-ingestion from a
second source resolves to the existing node instead of creating a duplicate. Aliases are additive;
removing one is a migration.

**Collision behaviour:** same business key, different `entity_id` → duplicate detected → merge proposal
(never automatic for classes requiring review). Different business key, same `entity_id` → **integrity
error**, alert, halt ingestion for that class.

**Merge** = supersession chain (ADR-002), never deletion — which is what makes reversal demonstrable.
**Split** = create new canonical entities, supersede the merged one, re-point assertions by evidence.

**Critical rule: entity-resolution confidence is stored as `resolution` (ADR-010) and must never be
combined into, or read as, factual confidence.** Being 0.95 sure _which account this is_ says nothing
about whether the balance is correct. Enforced by keeping the components separate and by prohibiting
any projection that multiplies `resolution` into a truth score.

## Security implications

Tenant-local default eliminates the cross-tenant join risk of global identity.

## Privacy implications

Third-party classes (`Dependent`, `SpouseProfile`) are merge-ineligible and human-review-gated — these
describe people who never consented to the platform.

## Tenant-isolation implications

Every business key includes `tenant_id` except public reference data, which carries no personal content.

## Data-model implications

Class specs gain six fields; an alias table is added (relational, alongside ADR-002 provenance).

## Scalability implications

Deterministic keys are indexable; duplicate detection becomes a query rather than a scan.

## Operational implications

Duplicate and collision metrics become computable, enabling the quality gates.

## Cost implications

Low.

## Developer-experience implications

"Is this the same thing?" becomes answerable from the spec instead of from tribal knowledge.

## Migration plan

1. Declare keys for all 47 live classes (judgement work, not code).
2. Build alias table; populate from existing source identifiers.
3. Run duplicate **detection** in report-only mode.
4. Review findings; merge only where eligible, dry-run first.

## Backfill plan

Compute business keys for existing nodes where fields permit; classes lacking source fields are marked
`key_underivable` — explicit, not silently absent.

## Compatibility strategy

`entity_id` remains the traversal key throughout; business identity is additive metadata.

## Rollback strategy

Detection is read-only. Merges are supersessions and reversible by restoring status.

## Observability requirements

Duplicate count by class · collision count (target 0) · merge proposals pending review · alias growth.

## Evaluation plan

ER precision/recall on labelled fixtures; merge reversibility demonstrated before any production merge.

## Falsification criteria

If `entity_id` proves already business-derived (OQ-6 resolves positively), much of this reduces to
documenting existing behaviour — a cheaper and better outcome.

## Acceptance criteria

47/47 classes declare identity or `None` · 0 collisions · duplicate detection runs in CI · no automatic
merge of a review-required class.

## Non-goals

Not implementing probabilistic matching. Not cross-tenant identity. Not merging anything in this ADR.

## Risks accepted

Deterministic keys will miss genuine duplicates that differ in their key fields. Accepted: false
negatives are safe, false merges are not.

## Residual uncertainty

OQ-6 (`entity_id` derivation).

## Consequences

Duplicate/consolidation quality gates become computable; ADR-002 gains a stable subject identifier.

## Follow-up work

Probabilistic resolution ADR if detection shows material residual duplication.

## Superseded documents

Refines `SEMANTIC_DATA_MODEL.md` §2.1 (adds scope, alias, collision, split).

## Approval record

| Reviewer  | Role          | Verdict | Date |
| --------- | ------------- | ------- | ---- |
| _pending_ | Data Platform | —       | —    |
| _pending_ | Privacy       | —       | —    |
