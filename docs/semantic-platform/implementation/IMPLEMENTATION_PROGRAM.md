# Implementation Program

**Date:** 2026-07-30 · **Role:** Technical Program Lead · Binding inputs: the ADR package + final review.
**No redesign authority.** Conflicts are escalated as ADR amendments, never resolved silently.

---

## 1. Phase 1 — Readiness validation, per ADR

Activation condition for every work package: **its ADR is `Accepted` AND its blocking open questions are
owned with a method, date, and escalation path** (the binding status rule in `ADR_REJECTION_EVIDENCE.md`).

| ADR                  | Status   | Blocking deps | Blocking OQs                 | Prod evidence required                          | Rollback defined          | May begin?                |
| -------------------- | -------- | ------------- | ---------------------------- | ----------------------------------------------- | ------------------------- | ------------------------- |
| 001 Transactions     | Proposed | 002, 004, 008 | OQ-1, OQ-11                  | read-dependency inventory; golden no-regression | ✅ recomposable edge      | ❌                        |
| 002 Provenance       | Proposed | 001, 010      | OQ-2                         | batch homogeneity trace                         | ✅ stop writing           | ❌                        |
| 003 Authorization    | Proposed | none          | none                         | 119-type parity proof                           | ✅ revert loader          | ⚠️ **nearest to ready**   |
| 004 Evaluation       | Proposed | none          | OQ-4                         | persona census                                  | ✅ n/a read-only          | ⚠️ **nearest to ready**   |
| 005 Vector trust     | Proposed | 002, 010      | OQ-5, CONFLICT-1, **CONF-A** | drift telemetry                                 | ✅ disable flag           | ❌                        |
| 006 Identity         | Proposed | 002, 010      | OQ-6                         | duplicate detection report                      | ✅ read-only              | ❌                        |
| 007 Credentials      | Proposed | none          | OQ-12                        | **rejected-old-token proof**                    | ❌ irreversible by design | ⚠️ containment authorized |
| 008 Traversal verify | Proposed | 003, 004      | none                         | Phase A trace artifact                          | ✅ stop running           | ❌ (needs 003)            |
| 009 Gateway          | Proposed | 007           | OQ-7                         | 7-day traffic + central inventory               | ⚠️ 30-day image retention | ❌                        |
| 010 Confidence       | Proposed | 002           | OQ-8                         | calibration run                                 | ✅ disable flags          | ❌                        |
| 011 Superclass       | Proposed | 003           | none                         | cross-domain measurement                        | ✅ disable flag           | ❌ (needs 003)            |

**Nothing may begin.** ADR-003 and ADR-004 are nearest — both have zero blocking dependencies, and
ADR-003 has zero blocking open questions. They are the natural first review targets, which matches the
session plan already on record.

### Why each blocked ADR cannot safely start

- **001** — cannot define "no regression" without the golden set (004), and cannot inventory read
  dependencies without OQ-11. Deprecating an emitter whose readers are unknown is the failure mode.
- **002** — the storage argument rests entirely on OQ-2. Building the batch tier before confirming batch
  homogeneity risks constructing provenance that misrepresents shared origin, which is worse than none.
- **005** — see CONF-A below; also depends on 002's authoritative record existing.
- **006** — OQ-6 may collapse most of the ADR into documentation. Building first would be waste.
- **008** — requires the `evaluation` context, which only exists after 003.
- **009** — OQ-7 is a hard gate; `ln_central` empty proves nothing about `central` Neo4j.
- **010** — fields live on 002's assertion schema.
- **011** — shares the manifest v3 bump with 003 (CONFLICT-3); cannot ship independently.

---

## 2. Architectural conflict found — escalated, not resolved

### CONF-A — ADR-005 backfill precedes its own authoritative source

**Observed while sequencing.** ADR-005 requires _"every payload state traceable to an authoritative
Postgres record"_ and schedules payload backfill in Stage 3. ADR-002 (provenance, the source of those
authoritative records) lands in Stage 5. At backfill time the authoritative record does not exist.

**This is a genuine ordering conflict between two accepted-track decisions, not an implementation
detail.** Per role constraint it is escalated rather than papered over.

| Option                                                                      | Effect                                                | Trade                                                                                 |
| --------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **(a) Backfill from `source_system` only; record interim state explicitly** | trust filtering gains security value 2 stages earlier | traceability deferred; ADR-005 must state this rather than imply day-one traceability |
| (b) Move ADR-005 backfill after Stage 5                                     | full traceability from the start                      | leaves the poisoning vector unmitigated for 2 stages                                  |

**Recommendation: (a)**, with an ADR-005 amendment adding an explicit interim clause and a
`traceability_pending` payload state that the Stage 5 work must clear. Owner: Security + Graph Platform.
**No work proceeds on ADR-005 until reviewers rule.**

---

## 3. Governance model

**Work package rule.** Independently reviewable, independently reversible, mapped to exactly one ADR.
A package spanning two ADRs is split; a package with no ADR is rejected as unsanctioned work.

**Drift control.** Three mechanisms, in descending reliability:

1. **Automated invariant checks** (`IMPLEMENTATION_DECISION_AUDIT.md`) — 9 of 14 automatable today
2. **Reviewer checklists** — for invariants automation cannot yet cover
3. **Escalation** — any implementation finding that contradicts an ADR stops work and becomes an
   amendment proposal, as CONF-A did

**The ordering matters.** Anything protected only by (2) is protected by human memory and will
eventually fail. The programme's standing goal is to migrate invariants from (2) to (1).

**Track separation (inherited, still binding).** Security and retrieval changes ship as separate PRs and
separate rollback units. ADR-003/007 are security-track; 001/004/008/010/011 retrieval-track;
002/005/006 span both and need both track leads.

---

## 4. Stage model

Unchanged from `ADR_IMPLEMENTATION_SEQUENCE.md` — re-validated, not redesigned.

| Stage                    | Content                                                  | Production writes               | Terminable                         |
| ------------------------ | -------------------------------------------------------- | ------------------------------- | ---------------------------------- |
| 0 Containment            | credentials, domain contract _(committed)_               | none                            | no                                 |
| 1 Measurement + contract | golden set; manifest v3 (003+011); identity declarations | none                            | no                                 |
| 2 Verification           | traversal Phase A → Phase B                              | none (read-only)                | **yes — negative result is valid** |
| 3 Trust plumbing         | ADR-005 payload + flags                                  | payload only                    | no                                 |
| 4 Emission correction    | deprecate user-anchored edge                             | none (deprecation stops writes) | no                                 |
| 5 Provenance             | schema, writer, type gate                                | forward writes                  | no                                 |
| 6 Historical migrations  | edge removal, backfill, `HAS_PERSONA`                    | **first true mutations**        | no                                 |
| 7 Retirement + rollout   | gateway; grounding decision                              | service removal                 | **yes — both**                     |

**Blast radius is monotonically increasing by design.** No stage writes more than the one before it
without an explicit gate.

---

## 5. What this program does not authorize

Restated so no reader infers permission from planning detail:

- no implementation, no production mutation, no data migration
- `GRAPH_GROUNDING_ENABLED` stays unset; enablement needs a separate ADR not in this package
- no service retirement
- no ADR treated as accepted by virtue of appearing in this plan
- no architectural change — conflicts escalate (CONF-A is the worked example)

---

## 6. Success criteria mapping

| Brief criterion                                       | Where satisfied                    | Currently met?        |
| ----------------------------------------------------- | ---------------------------------- | --------------------- |
| Every task maps to an approved ADR                    | work-package `adr` field           | **N/A — 0 approved**  |
| Every ADR maps to measurable work                     | `IMPLEMENTATION_WORK_PACKAGES.md`  | ✅ (conditional)      |
| Every production change has rollback                  | package `rollback` field           | ✅                    |
| Invariants automatically verified where practical     | `IMPLEMENTATION_DECISION_AUDIT.md` | ✅ 9 of 14            |
| Every blocker has owner, evidence, review date        | `IMPLEMENTATION_OPEN_QUESTIONS.md` | ❌ **0 of 9 owned**   |
| No work begins without its dependency graph satisfied | activation conditions              | ✅ enforced by gating |

Two criteria are unmet and both are unmeetable by me: ADR acceptance and owner assignment are human
decisions. They are the programme's actual critical path.
