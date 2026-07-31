# ADR Session 1 — Facilitator Guide

**Date:** 2026-07-30 · **Duration:** 2 hours · **Scope:** 3 decisions, 11 owner assignments
**Facilitator role:** keep the room on evidence. You are not defending the ADRs.

---

## Attendees

| Role                | Required for                                         | Must be present            |
| ------------------- | ---------------------------------------------------- | -------------------------- |
| Security lead       | ADR-007 (owner), ADR-003 (owner), ADR-011 (reviewer) | **yes — all three blocks** |
| Graph Platform lead | ADR-011 (owner), ADR-003 (reviewer)                  | **yes**                    |
| Platform Ops        | ADR-007 (reviewer)                                   | Block B                    |
| AI/Retrieval        | ADR-003, ADR-011 (reviewer)                          | Blocks C, D                |
| Privacy/Governance  | ADR-003, ADR-007 (reviewer)                          | Blocks B, C                |
| Engineering Lead    | escalation authority                                 | **yes**                    |

**If the Security lead cannot attend, cancel.** Security owns or reviews all three ADRs in scope;
proceeding without them produces decisions that must be re-taken.

---

## Block A · Owner assignment (15 min) — **administrative, not a debate**

**Opening statement (read verbatim):**

> "Before any vote, we assign owners. The standing rule is that no ADR reaches Accepted while a
> rejection trigger lacks an owner, a method, a date, and an escalation path. Right now zero of eleven
> blocking questions have one. Until this block is done, nothing we decide today is valid. This is
> assignment, not discussion — if a question needs discussion, it gets an owner and a date, and the
> discussion happens there."

Work the table in `ADR_EVIDENCE_REGISTER.md` §1. Target: **11 questions, 11 names, 11 dates.**

**Facilitator note:** resist debating the _answers_ here. The single most common failure of this block
is a 40-minute discussion of OQ-2 that produces no owner. If that starts, stop it: _"That's exactly
what OQ-2 is for. Who owns it, and by when?"_

---

## Block B · ADR-007 Credentials (25 min)

**Opening statement:**

> "This decides the permanent secret-management operating model. It does not close the incident.
> Containment is already authorized and underway independently of this vote."

**Key evidence (2 min):** an org-scoped Fly token and a `manage`-scoped Qdrant key were delivered
through chat; `flyctl secrets list` shows 31 secrets the Fly token can read, including
`SUPABASE_SERVICE_ROLE_KEY`. Prior incident LN-SEC-2026-0729-01 established the rejection-proof
standard (`REJECTED (400)` ×5).

**Decision points:**

1. Adopt rotate-all + least-privilege scoping + secret-store-only delivery? (recommended: yes)
2. Confirm git-history rewrite remains rejected. (recommended: yes — rotation renders values inert)
3. Assign the OQ-12 auth-log review owner.

**Questions that matter:**

- Can any legitimate consumer _not_ function under per-app deploy-scoped tokens?
- Does anyone dispute that revocation is unproven until an old credential is observed **rejected**?

**Questions to avoid:**

- Re-litigating whether the exposure was serious. It happened; containment is authorized.
- Debating git-history rewrite mechanics. The recommendation is not to, and no new evidence contradicts it.

**Expected outcome:** **Accept.** Conditions: OQ-12 owned; the eight-step closure sequence adopted as
the standard; gateway service-role key revoked immediately, independent of ADR-009.

---

## Block C · ADR-003 Authorization (45 min) — **the session's most important decision**

**Opening statement:**

> "This is the only ADR with zero dependencies and zero blocking open questions. It restores an
> authorization model the Rust catalog already declares but the exported manifest discards. It is
> mostly serialization work, not new design."

**Key evidence (5 min):**

- `grep -c permitted_contexts relationship_catalog.rs` → **150**
- `grep -c permitted_ ontology_manifest.json` → **0**
- `planner.py:169` → `if row.get("traversable") is True`
- `relationship_coverage.json`: `personal_advisor: 119`; `provider_advisor`, `organization_administrator`,
  `internal_audit`, `central_knowledge` all **null**; `live_but_undeclared: 0`
- `unresolved_policy_decisions`: provider-context retrieval already recorded **open**

**Decision points:**

1. Adopt context × principal matrix in manifest v3? (recommended: yes)
2. Confirm `evaluation` as a **distinct** context so diagnostics cannot borrow advisor rights. (yes)
3. Confirm ADR-003 does **not** decide provider permissions. (yes — out of scope by design)
4. Accept the 119-parity test as the migration's falsification criterion. (yes)

**Questions that matter:**

- _What would make us reject this?_ → the personal-advisor set resolving to anything other than 119.
- Is an external policy engine (OPA/Cedar) genuinely disproportionate here? (facilitator: this is the
  one alternative a reviewer may legitimately want to revive — hear it)
- Does anyone object to `traversable` being retained as a derived field for one release?

**Questions to avoid:**

- **Provider retrieval design.** It is a pre-existing open policy decision, deliberately out of scope.
  If raised: _"ADR-003 only makes the manifest able to express that answer. Deciding it is a separate
  ADR."_
- Agent roster design. That is ADR-040 territory, not written.

**Expected outcome:** **Accept.** Conditions: 119-parity test is a hard gate; dual-emit for one release;
provider permissions explicitly excluded.

---

## Block D · ADR-011 Superclass (20 min)

**Opening statement:**

> "This ships in the same manifest v3 change as ADR-003. It replaces a proposed graph-wide label
> migration with a catalog field — same reasoning capability, zero migration."

**Key evidence:** the motivating query covers `CareerGoal` 79 + `HealthGoal` 31 + `EducationGoal` 13 +
`Goal` 4 = **127 nodes, 5.1% of the graph**. The rejected alternative required relabelling the graph.

**Decision points:**

1. Adopt `superclass` as catalog metadata? (recommended: yes)
2. Confirm single-parent, depth ≤ 2, no multiple inheritance. (yes)
3. Confirm expansion ships **flag-off** until measured. (yes — its falsification criterion needs
   ADR-004's golden set, which does not exist)

**Questions that matter:**

- Can expansion widen access? (Answer must be no: authorization is applied **after** expansion, and the
  property test asserts expanded ⊆ ∪ individually-permitted.)

**Questions to avoid:** the taxonomy's exact membership. It is catalog data, revisable without an ADR.

**Expected outcome:** **Accept, flag-off.**

---

## Block E · Disposition of the remaining eight (10 min) — **no debate**

Read the recommendations; record; do not discuss the merits.

| ADR     | Outcome            | Minimum missing evidence                          |
| ------- | ------------------ | ------------------------------------------------- |
| ADR-001 | Needs Revision     | OQ-11 read-dependency inventory; OQ-1 granularity |
| ADR-002 | Needs Revision     | OQ-2 batch homogeneity                            |
| ADR-005 | Needs Revision     | **CONF-A ruling** + OQ-5                          |
| ADR-006 | Needs Revision     | OQ-6 `entity_id` derivation                       |
| ADR-009 | Needs Revision     | OQ-7 `central` Neo4j inventory                    |
| ADR-004 | Defer to Session 2 | OQ-4 persona census (cheap)                       |
| ADR-008 | Defer              | requires ADR-003 shipped                          |
| ADR-010 | Defer              | requires ADR-002 decided                          |

**Assign CONF-A a ruling owner and date here.** It is the only escalated architectural conflict.

---

## Block F · Close (5 min)

- Confirm 11 owners recorded
- Confirm 3 decisions logged with conditions in `ADR_DECISION_LOG_TEMPLATE.md`
- Schedule Session 2 **against resolved open questions, not a calendar date**

---

## Facilitator escalation path

| Situation                               | Action                                                       |
| --------------------------------------- | ------------------------------------------------------------ |
| Block A produces < 11 owners            | **Stop.** No votes today. Reconvene when owners exist        |
| A reviewer disputes measured evidence   | Verify live in the room — every figure has a command         |
| Debate exceeds its block                | Convert to an open question with an owner; move on           |
| CONF-A relitigated as a design question | Out of scope; it needs a ruling, not a redesign              |
| Security lead absent                    | Cancel                                                       |
| Pressure to accept a Needs-Revision ADR | Name the missing evidence and the consequence of being wrong |

## Time budget

| Block         | Min | Cumulative |
| ------------- | --- | ---------- |
| A owners      | 15  | 15         |
| B ADR-007     | 25  | 40         |
| C ADR-003     | 45  | 85         |
| D ADR-011     | 20  | 105        |
| E disposition | 10  | 115        |
| F close       | 5   | **120**    |
