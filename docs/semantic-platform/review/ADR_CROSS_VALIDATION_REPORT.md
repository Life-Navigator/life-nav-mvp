# ADR Cross-Validation Report

**Date:** 2026-07-30 · Phase 6. **Can accepting one ADR silently invalidate another?**

Scope: the three Session-1 candidates against all eleven, plus re-validation of the prior consistency
matrix in light of Sprint 1.

---

## 1. Session-1 acceptances — invalidation check

| If we accept… | Could it invalidate…   | Verdict                                                                                                                                                                                     |
| ------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ADR-003**   | ADR-008                | **No — enables it.** ADR-008 requires the `evaluation` context that ADR-003 creates                                                                                                         |
| **ADR-003**   | ADR-011                | **No — required by it.** Shared manifest v3 (CONFLICT-3)                                                                                                                                    |
| **ADR-003**   | ADR-005/006/010        | **No.** Disjoint concerns (authorization vs trust/identity/confidence)                                                                                                                      |
| **ADR-003**   | ADR-009                | **No.** Gateway retirement is independent of the manifest schema                                                                                                                            |
| **ADR-007**   | ADR-009                | **No — advances it.** Gateway service-role revocation is inside ADR-007 and independent of retirement                                                                                       |
| **ADR-007**   | all write-enabled ADRs | **No — unblocks them.** ADR-007 is a prerequisite, not a constraint                                                                                                                         |
| **ADR-011**   | ADR-001                | ⚠️ **Weak coupling.** ADR-001 may reduce `TransactionSummary`'s role, thinning the `Observation` superclass (CONFLICT-2). Low impact — membership is catalog data, revisable without an ADR |
| **ADR-011**   | ADR-003                | **No.** Expansion is applied _before_ authorization; property test asserts expanded ⊆ ∪ individually-permitted                                                                              |

**No Session-1 acceptance invalidates another ADR.** The one coupling (CONFLICT-2) is cosmetic and
already recorded.

---

## 2. Shared assumptions across ADRs

| Assumption                                   | Relied on by                   | Status                                                                                               |
| -------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Rust is the only graph writer                | ADR-002 (provenance guarantee) | ✅ **Now automatically enforced** (Sprint 1, I-1/I-2, mutation-proven). Was assumed; is now verified |
| Traversal binds both endpoints by tenant     | ADR-003, ADR-008               | ✅ **Now automatically enforced** (Sprint 1, I-3, two-tenant fixture)                                |
| Catalog is the single relationship authority | ADR-003, ADR-011, ADR-002      | ✅ Enforced by drift gates + Sprint 1 I-10                                                           |
| The manifest is the only cross-tier contract | ADR-003, ADR-011               | ✅                                                                                                   |
| Postgres is available for new schemas        | ADR-002, ADR-006, ADR-010      | ⚠️ Unverified — IQ-2 (which repo hosts the migration)                                                |
| `GRAPH_GROUNDING_ENABLED` stays unset        | ADR-008 + all                  | ✅ `fly.toml:43`                                                                                     |

**Sprint 1 converted two load-bearing assumptions into enforced invariants.** That materially
strengthens ADR-002 and ADR-003 without changing either decision — and it is the reason ADR-002's
"provenance-free edges are unrepresentable" claim is now credible rather than aspirational.

---

## 3. Contradictions found

**One, previously escalated, still unresolved.**

### CONF-A · ADR-005 backfill precedes its authoritative source

ADR-005 requires _"every payload state traceable to an authoritative Postgres record"_ and schedules
backfill in Stage 3. ADR-002 creates those records in Stage 5.

**Recommendation: `Needs Revision` for ADR-005** until ruled. This is exactly the case the brief
describes — an ADR that cannot be decided on available evidence because the missing input is a _policy
ruling_, not a measurement.

**No other contradictions were found** between any pair of the eleven.

---

## 4. Sequence problems

| Problem                                           | Affected | Resolution                                                                                                                     |
| ------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| ADR-003 and ADR-011 both bump the manifest schema | 003, 011 | **Combine into one v3.** Deciding them in separate sessions re-creates the coupling                                            |
| ADR-005 backfill before ADR-002 schema            | 005, 002 | CONF-A — needs ruling                                                                                                          |
| ADR-001 ↔ ADR-002 appear circular                 | 001, 002 | **Not a cycle.** 001→002 is acceptance-sequencing; 002→001 is cost estimation. Neither depends on the other's _implementation_ |
| ADR-010 fields live on ADR-002's schema           | 010, 002 | Ship together; deciding 010 first is safe, building it first is not                                                            |
| ADR-008 needs ADR-003's `evaluation` context      | 008, 003 | Natural ordering; no conflict                                                                                                  |

---

## 5. Hidden coupling — deliberate search

| Candidate coupling                                         | Real?               | Note                                                                                                     |
| ---------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------- |
| ADR-003 permissions ↔ ADR-011 expansion                    | **Yes, handled**    | Expansion must not widen access; property-tested. **Reviewers should confirm this explicitly**           |
| ADR-005 payload state ↔ ADR-002/010 authoritative state    | **Yes**             | CONFLICT-1: forced denormalization. Resolved with asymmetric severity + reconciliation, pending sign-off |
| ADR-006 resolution confidence ↔ ADR-010 factual confidence | **Yes, firewalled** | Both records explicitly prohibit `resolution` entering a truth projection                                |
| ADR-009 retirement ↔ ADR-002 provenance                    | No                  | Gateway holds no provenance                                                                              |
| ADR-007 rotation ↔ any retrieval ADR                       | No                  | Credentials gate _timing_, not design                                                                    |
| Sprint 1 invariants ↔ any ADR                              | **Yes, positive**   | I-1 enforcement strengthens ADR-002; RES-2 (api-gateway unscanned) strengthens ADR-009's case            |

---

## 6. New findings since the ADRs were drafted

| #   | Finding                                                            | Effect                                                                                                                             |
| --- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| X-1 | Sprint 1 enforces single-writer automatically                      | **Strengthens ADR-002.** Its guarantee no longer rests on convention                                                               |
| X-2 | Single-writer scan excludes `apps/api-gateway` (RES-2)             | **Strengthens ADR-009.** A live Python tier holding a service-role key is outside the enforced boundary. Does **not** unblock OQ-7 |
| X-3 | Sprint 1 test-authoring defects fixed by tightening, not loosening | Raises confidence in the invariant layer generally                                                                                 |
| X-4 | CI gate reports but does not block until branch protection updated | **No ADR depends on it**, but Session 1 should note the gap — an advisory gate is not enforcement                                  |

---

## 6b. Findings from credential-free investigation (2026-07-30)

| #   | Finding                                                                               | Effect                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| X-5 | `retriever.py` (legacy rollback path) hardcodes 5 relationship literals               | **New accepted exception.** If the catalog changes those types the rollback path silently diverges — the one place divergence is least affordable |
| X-6 | api-gateway has 0 write-Cypher; RES-2 severity **Medium → Low**                       | Weakens urgency for ADR-009; the retirement case rests on attack surface + service-role holder, not write risk                                    |
| X-7 | Qdrant payload carries **no** trust/review field                                      | **Confirms ADR-005's premise.** Backfill must derive from `source_system` as designed                                                             |
| X-8 | Root `entity_id` inherited from source, **not tenant-qualified**                      | **New input to ADR-006.** Cross-tenant id collision prevented only by source-id uniqueness — a property outside the worker                        |
| X-9 | No aggregation period defined for `TransactionSummary`; fed by `finance.transactions` | **Strengthens ADR-001.** Growth may be per-transaction, worse than assumed                                                                        |

## 7. Recommendation

**Cross-validation raises no objection to accepting ADR-003, ADR-007, or ADR-011 in Session 1**, subject
to:

1. ADR-003 and ADR-011 are accepted **together** as one manifest v3 change, or neither.
2. Reviewers explicitly confirm superclass expansion cannot widen access.
3. ADR-011 ships **flag-off** — its falsification criterion requires ADR-004, which does not exist.
4. ADR-005 is recorded `Needs Revision` pending the CONF-A ruling, with a named ruling owner.

**No ADR in Session-1 scope silently invalidates another.**
