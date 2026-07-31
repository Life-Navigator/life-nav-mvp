# Implementation Program — Executive Summary

**Date:** 2026-07-30 · **Role:** Technical Program Lead · **Commit:** `ac41b5e7`
**Nothing was implemented. No production change. GraphRAG remains disabled.**

---

## Phase 1 verdict: NO ADR MAY BEGIN IMPLEMENTATION

This is the package's primary finding, and it was produced by running Phase 1 as instructed rather than
assuming readiness.

| Readiness check                  | Required  | Measured                                     | Pass |
| -------------------------------- | --------- | -------------------------------------------- | ---- |
| ADRs `Accepted`                  | ≥ 1       | **0 of 11** (all `Proposed`)                 | ❌   |
| Approval records signed          | all       | **26 rows `_pending_`**                      | ❌   |
| ADRs free of unresolved blockers | —         | **8 of 11 blocked**                          | ❌   |
| Blocking open questions owned    | 9 of 9    | **0 owned, 0 dated**                         | ❌   |
| Stage 0 credential closure       | complete  | **not closed** (no rejected-old-token proof) | ❌   |
| Stage 0 domain contract          | committed | **`120f301a`, 963+85 tests, gates green**    | ✅   |

Command: `grep -h '^\*\*Status:\*\*' docs/semantic-platform/adrs/ADR-0*.md` → 11 × `Proposed`.
Metadata: `approval_state ∈ {pending, containment_authorized_independently}`.

**The brief instructs: _"Break every approved ADR into implementation work packages"_ and
_"every implementation task maps to an approved ADR."_ Zero ADRs are approved.** The review verdict on
record is explicitly _approved to enter review, **not** blanket approval_.

### Why this is not a technicality

`ADR_REVIEW_AGENDA.md` lists, as an **invalid review outcome**: _"Interprets a `Proposed` ADR as
implemented architecture."_ Producing detailed work packages, test matrices, and rollout plans for
unratified decisions would manufacture delivery momentum that pressures the review toward
rubber-stamping — which is the precise mechanism by which architecture drifts during implementation.

It would also be partly wasted. `ADR_REJECTION_EVIDENCE.md` records that **ADR-002's central storage
argument collapses if OQ-2 resolves negatively**, and that ADR-009 halts entirely if OQ-7 finds content
in `central` Neo4j. Writing full delivery plans for those today is speculative work.

---

## What this package therefore is

A **readiness-gated** program. Each work package carries an explicit activation condition, and none may
start before its ADR reaches `Accepted` with blockers owned.

Content depth is proportionate to certainty, deliberately:

| Tier                                                                                   | Depth                        | Rationale                                          |
| -------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------- |
| **Unconditional now** — Stage 0 closure, OQ ownership assignment, invariant automation | full detail                  | valid regardless of any ADR verdict                |
| **Conditional** — per-ADR work packages, tests, rollout                                | scaffolded, activation-gated | may be revised or deleted by review                |
| **Speculative** — detailed migration runbooks for blocked ADRs                         | **deliberately not written** | would be discarded if OQ-2/OQ-7 resolve negatively |

Per Phase 12 (_"delete unnecessary work… the shortest implementation that preserves every accepted
architectural decision is preferred"_), the third tier is an intentional omission, not a gap.

---

## The only work that may proceed today

Three items, none requiring an ADR verdict:

1. **Close Stage 0 credentials** — revoke, **prove rejection**, replace with least-privilege scope,
   verify consumers. Gates every write-enabled item in the programme. Owner: Security.
2. **Assign owner + method + date + escalation to all 9 blocking open questions.** This is the gating
   activity for the entire review, and it is currently 0% done. Owner: Program Lead.
3. **Build the invariant automation** (`IMPLEMENTATION_DECISION_AUDIT.md`) — 14 architectural
   invariants, of which **9 can be automatically enforced today** against the existing codebase without
   depending on any ADR outcome. This is the highest-value unconditional work in the package.

Item 3 deserves emphasis: several invariants the platform already relies on are currently protected by
**human memory alone** — including "Python clients remain read-only" and "no raw-string relationship
emission." Both are true today and nothing prevents a future commit from breaking them silently.

---

## Program shape once ADRs are accepted

Six stages, unchanged from `ADR_IMPLEMENTATION_SEQUENCE.md` (re-validated, not redesigned):

```
Stage 0 Containment ──► Stage 1 Measurement+Contract ──► Stage 2 Verification
                                                              │
Stage 3 Trust plumbing ──► Stage 4 Emission ──► Stage 5 Provenance ──► Stage 6 Migrations
                                                              │
                                                     Stage 7 Retirement + rollout decision
```

**Critical path:** Stage 0 → 1b (manifest v3) → 2 → 4 → 5 → 6. Stage 1a (golden set) runs parallel and
gates the acceptance criteria of Stages 2 and 4.

**Not every ADR reaches production.** ADR-008 may terminate at evaluation with a negative result;
ADR-009 may terminate at inventory; ADR-011 may terminate if cross-domain queries show no gain. The
rollout plan treats termination as a legitimate exit, not a failure.

---

## Conflicts found during program construction

Per the role constraint — _"If implementation reveals an architectural conflict, stop, document it, and
propose an ADR amendment rather than silently changing the design"_ — **one** was found:

**CONF-A (proposed ADR-005 amendment).** ADR-005 requires payload backfill of 2,218 Qdrant points, and
classifies this as an authorized "payload-only, no vector change" mutation. But Stage 3 precedes Stage 5
(provenance), so at backfill time **there is no authoritative Postgres assertion record to derive trust
from** — the ADR's own traceability requirement ("every payload state traceable to an authoritative
record") cannot be satisfied in the stage where it is scheduled.

_Not silently resolved._ Two options for reviewers: (a) backfill from `source_system` only, accepting
that traceability is deferred until Stage 5 and explicitly recording the interim state; or (b) move
ADR-005 backfill after Stage 5. Recommendation: **(a)**, because trust filtering has security value
before provenance exists, but the ADR must say so rather than imply full traceability from day one.

---

## Honest status

| Deliverable                         | Status                                             |
| ----------------------------------- | -------------------------------------------------- |
| Implementation program              | **Designed**                                       |
| Work packages                       | **Designed**, activation-gated                     |
| Verification gates                  | **Designed**; 9 of 14 invariants automatable today |
| Everything requiring an ADR verdict | **Blocked, correctly**                             |

The correct next action remains what it was: close Stage 0, assign owners and dates to blocking
triggers, and begin ADR review one decision group at a time. This package makes that work concrete; it
does not substitute for it.
