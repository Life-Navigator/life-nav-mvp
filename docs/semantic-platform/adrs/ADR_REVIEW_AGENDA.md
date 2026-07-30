# ADR Review Agenda

**Date:** 2026-07-30 · Purpose: move eleven `Proposed` records to `Accepted`, `Rejected`, or
`Under Review` with recorded approvals.

---

## Required approvers by record

| ADR                  | Security  | Graph Platform | Data Platform | AI/Retrieval | Privacy | Platform Ops | Domain      |
| -------------------- | --------- | -------------- | ------------- | ------------ | ------- | ------------ | ----------- |
| 001 Transactions     | ✓         | **owner**      | ✓             | ✓            | —       | —            | Finance     |
| 002 Provenance       | ✓         | **owner**      | ✓             | —            | ✓       | —            | —           |
| 003 Authorization    | **owner** | ✓              | —             | ✓            | ✓       | —            | —           |
| 004 Evaluation       | ✓         | —              | —             | **owner**    | ✓       | —            | —           |
| 005 Vector trust     | **owner** | —              | ✓             | ✓            | ✓       | —            | DocIntel    |
| 006 Identity         | —         | ✓              | **owner**     | —            | ✓       | —            | All domains |
| 007 Credentials      | **owner** | —              | —             | —            | ✓       | ✓            | —           |
| 008 Traversal verify | ✓         | ✓              | —             | **owner**    | ✓       | —            | —           |
| 009 Gateway          | ✓         | —              | —             | ✓            | —       | **owner**    | —           |
| 010 Confidence       | ✓         | ✓              | ✓             | **owner**    | —       | —            | —           |
| 011 Superclass       | ✓         | **owner**      | —             | ✓            | —       | —            | —           |

**Two-track rule (standing):** security and retrieval decisions are reviewed and shipped as separate
units. ADR-003 and ADR-007 are security-track; ADR-001/004/008/010/011 are retrieval/architecture-track.
ADR-002/005/006 span both and require sign-off from **both** track leads.

---

## Session plan

### Session 1 — Containment (30 min, immediate, no prerequisites)

**ADR-007 only.** Not a design debate; a confirmation that containment is underway and that closure
criteria are agreed.
_Decide:_ who revokes what, by when; who reviews auth logs for OQ-12/R-3.
_Output:_ ADR-007 → `Accepted`; Stage 0 owner assigned.

### Session 2 — The two overturned designs (90 min)

**ADR-002 and ADR-010.** Both supersede documents written eight days earlier. The review must satisfy
itself the corrections are right, not merely newer.
_Decide:_ OQ-2 (batch homogeneity) resolution owner; whether three confidence components suffice.
_Challenge:_ ADR-002's storage argument collapses if OQ-2 is negative — is the design still preferred?
_Output:_ `Accepted` or `Under Review` pending OQ-2.

### Session 3 — Authorization and contract (60 min)

**ADR-003 + ADR-011** — reviewed together because they are one manifest v3 change (CONFLICT-3).
_Decide:_ principal taxonomy; whether `evaluation` is a distinct context (recommended: yes).
_Challenge:_ is the personal-advisor set provably still exactly 119 after migration?
_Output:_ combined v3 schema approved or revised.

### Session 4 — Measurement and verification (60 min)

**ADR-004 + ADR-008.**
_Decide:_ category minimum counts; tenant approval process for Phase B.
_Challenge (the important one):_ **are we prepared to accept "traversal adds nothing" as a result?**
If the answer is no, ADR-004 is theatre and should not be built.
_Output:_ falsification criteria explicitly agreed and recorded.

### Session 5 — Data plane (60 min)

**ADR-001 + ADR-005 + ADR-006.**
_Decide:_ CONFLICT-1 resolution (is a reconciliation job sufficient for denormalized trust state?);
OQ-1, OQ-11 owners.
_Output:_ accepted or deferred pending OQ resolution.

### Session 6 — Retirement (30 min)

**ADR-009.** Gated on OQ-7.
_Decide:_ who inventories `central` Neo4j; 7-day log collection start date.
_Output:_ `Accepted` conditional on OQ-7, or deferred.

---

## Decision order (dependency-forced)

```
S1 (007) ──► unblocks all write-enabled work
S2 (002,010) ─┐
S3 (003,011) ─┼──► S4 (004,008) ──► S5 (001,005,006) ──► S6 (009)
              └──► manifest v3 must be settled before 008 can run
```

ADR-007 first, always. ADR-003 before ADR-008 (the `evaluation` context must exist).
ADR-004 before ADR-001 acceptance (its no-regression gate needs the golden set).

---

## Pre-read

All reviewers: `ADR_DECISION_SUMMARY.md` (1 page) and the "What a reviewer should challenge hardest"
section. Session owners: their full ADR plus `ADR_CONSISTENCY_MATRIX.md` §3.

## Standing approval conditions (recorded 2026-07-30)

The package is approved **to enter review** under these conditions:

- all ADRs remain `Proposed`; **no blanket approval — one vote per record**
- D-1 containment proceeds immediately, independent of any ADR verdict
- OQ-7 and OQ-9 remain **hard blockers** where specified
- ADR-003 does **not** decide provider permissions
- ADR-004 is **allowed to reject graph traversal**
- no production mutation follows from ADR approval alone
- every accepted ADR produces a **separate** implementation and verification gate

## Review outcomes that must be rejected

A session outcome is invalid if it does any of the following:

| Rejected outcome                                               | Why                                                                                                |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Approves all eleven ADRs in one vote                           | Removes per-decision accountability; a blanket vote cannot express the per-ADR rejection evidence  |
| Treats the 17-tenant divergence as cleanup                     | It is unclassified; classification precedes any repair, and bucket 5 would be a compliance finding |
| Enables GraphRAG because traversal executed successfully       | Execution is not benefit. Enablement requires measured value and a separate rollout ADR            |
| Uses only positive golden queries                              | Cannot measure abstention; the eval becomes unable to disprove the preferred result                |
| Permits Qdrant trust payloads without reconciliation           | The projection is a security control; unreconciled, its unsafe direction is undetectable           |
| Retires the gateway before central Neo4j and traffic inventory | `ln_central` empty proves nothing about central Neo4j                                              |
| Claims credential closure without rejected-old-token proof     | Assumed revocation is not revocation                                                               |
| Interprets a `Proposed` ADR as implemented architecture        | A written decision is not an accepted one, and an accepted one is not a built one                  |

## Exit criteria for the programme review

- Every ADR has a recorded verdict and named approvers
- All 8 blocking open questions have assigned owners and dates
- CONFLICT-1 resolved or explicitly accepted with mitigation
- Stage 0 (containment) is complete and evidenced, independent of the above
- No record moves to `Accepted` while a blocking OQ it depends on is unowned
