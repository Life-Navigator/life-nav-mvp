# ADR Decision Log — Template and Session 1 Pre-Fill

**Date:** 2026-07-30 · Phase 5. This record is the permanent governance history. It outlives every
person in the room, so it is written for a reader five years from now with no context.

---

## Template

```markdown
## Decision Record: ADR-XXX

**Decision:** Accepted | Rejected | Needs Revision | Deferred
**Date:** YYYY-MM-DD
**Session:** N
**Participants:** name (role), … — record ATTENDEES, not the invite list
**Absent required reviewers:** name (role) — and whether the decision proceeded anyway

### Evidence reviewed

- claim → source (file:line, artifact, or command) → verified in session? Y/N
- Evidence NOT available at decision time: …

### Questions raised

| Question | Answer | Changed the outcome? |

### Rationale

Why this outcome, in terms a reader without context can evaluate.
Include what was traded away, not only what was gained.

### Conditions attached

| # | Condition | Owner | Due | Evidence of satisfaction |

### Dissenting opinions

Recorded verbatim, attributed. **A record with no dissent on a contested decision is a warning sign,
not a clean result.** If there was none, state "none offered" explicitly.

### Follow-up work

| Item | Owner | Due |

### Review date

When this decision is revisited regardless of outcome.

### Supersedes / superseded by
```

---

## Pre-filled: what Session 1 is expected to record

Facilitator fills the blanks live. Pre-filling the _structure_ keeps the session moving; the
**content must not be pre-filled** — a decision log written before the decision is theatre.

### ADR-007 — expected `Accepted`

**Evidence to record:** org-scoped Fly token + `manage` Qdrant key delivered via chat; 31 secrets
readable by that token incl. `SUPABASE_SERVICE_ROLE_KEY`; LN-SEC-2026-0729-01 rejection standard.
**Conditions expected:** OQ-12 owned; eight-step closure sequence adopted; gateway service-role key
revoked immediately and independently of ADR-009.
**Evidence NOT available:** whether any credential was used during exposure (OQ-12).
**Review date:** at incident closure.

### ADR-003 — expected `Accepted`

**Evidence to record:** 150 vs 0; `planner.py:169`; `personal_advisor: 119` with four contexts null;
`live_but_undeclared: 0`.
**Conditions expected:** 119-parity as a hard gate; dual-emit one release; provider permissions
explicitly out of scope; `evaluation` a distinct context.
**Evidence NOT available:** post-migration parity (producible only by doing the work).
**Anticipated dissent:** that the risk is latent and therefore not urgent. **Record it if voiced** —
it is a reasonable position and the future reader should see it was considered.

### ADR-011 — expected `Accepted (flag-off)`

**Evidence to record:** 127 nodes = 5.1%; rejected alternative required a graph-wide relabel.
**Conditions expected:** single parent; depth ≤ 2; ships flag-off; enablement gated on ADR-004.
**Evidence NOT available:** cross-domain improvement — the reason for flag-off.

### ADR-001, 002, 005, 006, 009 — expected `Needs Revision`

For each, record **only**: the missing evidence, its owner, its date, and the escalation path. **Do not
record merits discussion** — the merits were not reviewable, which is the point.

### ADR-004, 008, 010 — expected `Deferred`

Record the prerequisite and the session at which it returns.

---

## Recording rules

1. **Attendees, not invitees.** A decision taken without a required reviewer must say so.
2. **Evidence not available is as important as evidence reviewed.** A future reader must be able to see
   what was unknown, or they cannot judge whether the decision was reasonable at the time.
3. **Dissent is recorded verbatim and attributed.** Never summarized into agreement.
4. **Conditions have owners and dates**, or they are not conditions.
5. **"Needs Revision" must name the evidence**, never "revisit later."
6. **A decision is not accepted until the record is written.** Verbal consensus is not a decision.

---

## Governance metadata to update after the session

| Artifact                                                  | Update                                                    |
| --------------------------------------------------------- | --------------------------------------------------------- |
| `artifacts/semantic-platform/adrs/adr_metadata.json`      | `status`, `approval_state`, `unresolved_blockers` per ADR |
| `artifacts/semantic-platform/review/review_metadata.json` | session outcome, owner assignments                        |
| Each ADR file                                             | `**Status:**` header + Approval record table              |
| `IMPLEMENTATION_BACKLOG.md`                               | activate work packages whose ADR reached `Accepted`       |
| `ADR_REVIEW_DASHBOARD.md`                                 | statuses, blockers, next review dates                     |

**The ADR file header and the metadata must be updated in the same commit.** Two sources of truth for
decision status is the drift defect this programme exists to eliminate, reproduced in its own
governance.
