# ADR Review — Session 1 Executive Summary

**Date:** 2026-07-30 · **Role:** independent Technical Review Facilitator
**Read time: 4 minutes. This is the only pre-read required of every attendee.**

---

## Headline recommendation

**Do not attempt all eleven ADRs. Session 1 should decide three.**

Preparing eleven packets for a session that can responsibly resolve three would produce eight
decisions made on absent evidence — the exact failure the rejection-evidence discipline exists to
prevent. As facilitator I am recommending against breadth.

| Session 1 scope | ADR                       | Recommended outcome  | Why decidable now                                                                   |
| --------------- | ------------------------- | -------------------- | ----------------------------------------------------------------------------------- |
| Block B         | **ADR-007** Credentials   | **Accept**           | No blocking dependencies; the operating model stands on existing evidence           |
| Block C         | **ADR-003** Authorization | **Accept**           | **Zero dependencies, zero blocking open questions** — the only ADR in that position |
| Block D         | **ADR-011** Superclass    | **Accept, flag-off** | Rides ADR-003's manifest v3; no migration; enablement separately gated              |

**Five ADRs cannot be decided today and I recommend `Needs Revision` for each**, with the minimum
missing evidence named: ADR-001, ADR-002, ADR-005, ADR-006, ADR-009.

**Three are deferred** pending their prerequisites: ADR-004 (cheap unblock), ADR-008, ADR-010.

---

## The gating fact

**Zero of eleven blocking open questions have an owner.** The binding status rule states:

> No ADR may move from `Proposed` to `Accepted` while any material rejection trigger lacks an
> accountable owner, a measurement method, a review date, and an escalation path.

Read literally, **no ADR can be accepted today** — including the three above.

**Resolution:** Session 1 opens with a 15-minute administrative block assigning owners and dates. That
is not a debate; it is a prerequisite. Once assigned, the three ADRs above become eligible within the
same session. **If that block is skipped, Session 1 produces no valid acceptances**, and reviewers
should be told so at the start rather than discovering it at the vote.

---

## Why these three, and not others

**ADR-003 is the highest-leverage decision available.** It has zero dependencies and zero blocking open
questions — unique in the set. It unblocks ADR-008, ADR-011, and all multi-agent work. Its evidence is
measured and reproducible: 150 policy declarations in Rust, 0 in the exported manifest,
`personal_advisor: 119` with four contexts `null`.

**ADR-007 unblocks every write-enabled item in the programme** and is the cheapest thing on the list.
Note the scope distinction reviewers will otherwise conflate: accepting the _operating model_ does not
require OQ-12 (was a credential used?). OQ-12 gates **incident closure**, not the decision.

**ADR-011 rides ADR-003.** Both change the manifest schema; shipping them as separate version bumps
would force two loader migrations for one contract boundary. Deciding them apart re-creates the coupling
the consistency matrix already flagged (CONFLICT-3).

---

## Why the other five cannot be decided

| ADR                      | Missing evidence                                          | Consequence of deciding anyway                                                                                                                |
| ------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **ADR-002** Provenance   | **OQ-2** — is a Plaid sync one homogeneous batch?         | The central storage argument _collapses_ if negative. Accepting now means possibly building batch provenance that misrepresents shared origin |
| **ADR-001** Transactions | **OQ-11** — does any query use the 1-hop path?            | A single unre-pointable reader rejects the ADR. Accepting first risks deprecating an emitter whose readers are unknown                        |
| **ADR-005** Vector trust | **CONF-A** — an escalated architectural conflict, unruled | Its backfill is scheduled two stages before the authoritative source it requires exists                                                       |
| **ADR-006** Identity     | **OQ-6** — is `entity_id` already business-derived?       | If yes, most of the ADR reduces to documentation. Accepting first commissions work that may be unnecessary                                    |
| **ADR-009** Gateway      | **OQ-7** — `central` Neo4j contents/writers               | `ln_central` being empty proves nothing about `central` Neo4j. These are different stores                                                     |

Each is `Needs Revision` in the precise sense the brief defines: **not wrong, not rejected — undecidable
on today's evidence, with the missing evidence named and cheap to obtain.** Seven of the nine open
questions are read-only investigations of 1–2 days each, and all nine are fully parallel.

---

## What Session 1 must not do

| Anti-outcome                                                       | Why                                                                                                                         |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Vote on all eleven                                                 | Removes per-decision accountability; a blanket vote cannot express per-ADR rejection evidence                               |
| Accept ADR-002 "in principle, pending OQ-2"                        | Its core argument is what OQ-2 tests. Conditional acceptance here is acceptance                                             |
| Resolve CONF-A in the room                                         | It is an architectural conflict between two decisions; it needs a recorded ruling from both track owners, not a hallway fix |
| Treat Sprint 1's invariant work as evidence that ADRs are accepted | Sprint 1 implemented only **unconditional** invariants. It deliberately touched nothing ADR-dependent                       |
| Skip the owner-assignment block                                    | Without it, no acceptance is valid under the standing rule                                                                  |

---

## What has changed since the ADRs were written

Sprint 1 shipped enforcement for four invariants that were previously protected by human memory
(I-1, I-2, I-3, I-4, I-10) — 14 tests, all mutation-proven, plus an unconditional CI job.

**Two consequences for this review:**

1. **ADR-002's provenance guarantee is now better supported.** It depends on Rust being the sole graph
   writer; that is now automatically enforced rather than assumed. This strengthens ADR-002 — but does
   not resolve OQ-2.
2. **A new residual affects ADR-009.** The single-writer scan covers core-api but **not
   `apps/api-gateway`** — a live, internet-reachable Python tier holding a service-role key. This
   _increases_ the case for retirement while OQ-7 still blocks it.

---

## Expected Session 1 outputs

- 11 blocking open questions with named owners and dates
- 3 ADRs `Accepted` with recorded approvals and conditions
- 5 ADRs `Needs Revision` with the minimum missing evidence stated per ADR
- 3 ADRs `Deferred` with their prerequisite named
- CONF-A assigned to a named ruling owner with a date
- Session 2 scheduled against resolved open questions, not against a calendar

**Success is not the number accepted.** A session that accepts three well-evidenced decisions and
correctly refuses eight is a better outcome than one that accepts eleven.
