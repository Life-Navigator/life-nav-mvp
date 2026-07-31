# Implementation Backlog

**Date:** 2026-07-30. Ordered by **activation readiness**, not by value. An item high in value but
blocked is lower in this list than a trivial item that can start today — that is the point of the
ordering.

Legend: 🟢 may start now · 🟡 blocked on a decision · 🔴 blocked on evidence · ⚫ may never happen

---

## 🟢 Startable today — no ADR verdict required

| #        | Item                                                                           | WP     | Effort    | Owner          | Why unblocked                                                                                                         |
| -------- | ------------------------------------------------------------------------------ | ------ | --------- | -------------- | --------------------------------------------------------------------------------------------------------------------- |
| B-01     | **Assign owner+method+date+escalation to 9 blocking OQs**                      | —      | 1 session | Program Lead   | Gates everything. Currently 0 of 9. **Highest-leverage action in the programme**                                      |
| B-02     | Credential revocation with rejection proof                                     | WP-000 | 1–2d      | Security       | Containment authorized independently                                                                                  |
| B-03     | Revoke gateway service-role key (2→1 holders)                                  | WP-000 | hours     | Security       | Independent of ADR-009 retirement                                                                                     |
| ~~B-04~~ | ~~DA-1 single-writer + read-only client CI gate~~                              | WP-010 | —         | Graph Platform | ✅ **DONE 2026-07-30** — mutation-proven M-2, M-3                                                                     |
| ~~B-05~~ | ~~DA-2 both-endpoint tenant binding test (T-01)~~                              | WP-010 | —         | Graph Platform | ✅ **DONE 2026-07-30** — two-tenant fixture, mutation-proven M-1 (caught a real leak)                                 |
| ~~B-06~~ | ~~DA-3 raw-string relationship emission gate~~                                 | WP-010 | —         | Graph Platform | ✅ **DONE 2026-07-30** — manifest-vocabulary based, mutation-proven M-4                                               |
| B-07     | DA-4 family≠permission + provider-exclusion property tests                     | WP-010 | 1d        | Security       | ⚠️ **PARTIAL** — `RELATED_TO` non-traversability done; full principal × context matrix **blocked on ADR-003** (RES-6) |
| B-15     | RES-1: auto-discover Cypher builders so a new one cannot skip the static check | WP-010 | 1h        | Graph Platform | 🟢 startable — closes the one Medium gap in I-3 coverage                                                              |
| B-16     | RES-2: extend the single-writer scan to `apps/api-gateway`                     | WP-010 | 2h        | Graph Platform | 🟢 startable — a live Python tier holding a service-role key is currently unscanned                                   |
| B-17     | Add `Architectural Invariants` to branch-protection required checks            | —      | minutes   | repo admin     | 🟢 **required** — the job reports but does not block a merge until this is done                                       |
| B-08     | OQ-9 tenant divergence classification (read-only)                              | —      | 1–2d      | Data Platform  | Read-only; blocks integrity gates                                                                                     |
| B-09     | OQ-7 `central` Neo4j inventory (read-only)                                     | —      | 1d        | Platform Ops   | Read-only; hard gate on ADR-009                                                                                       |
| B-10     | OQ-1/2/5/6/11 source-reading investigations                                    | —      | 1d each   | various        | Repository reads; fully parallel                                                                                      |
| B-11     | OQ-4 persona coverage census                                                   | —      | 1d        | AI/Retrieval   | Read-only                                                                                                             |
| B-12     | OQ-12 auth-log review                                                          | —      | 1–2d      | Security       | Closes the largest residual risk                                                                                      |
| B-13     | Load test to establish capacity baseline                                       | —      | 2–3d      | Platform Ops   | No gate can reference an unmeasured baseline                                                                          |
| B-14     | Push branch; open PR for `120f301a` + `ac41b5e7`                               | —      | minutes   | Program Lead   | Work is committed but unpushed                                                                                        |

**B-01 through B-13 are all parallelizable and none touches production.**

---

## 🟡 Blocked on a decision (ADR acceptance or a ruling)

| #    | Item                                       | WP     | Blocked on                                                      |
| ---- | ------------------------------------------ | ------ | --------------------------------------------------------------- |
| B-20 | Manifest v3 export + loader                | WP-110 | ADR-003 **and** ADR-011 accepted (shared bump)                  |
| B-21 | Golden set construction                    | WP-100 | ADR-004 accepted + OQ-4                                         |
| B-22 | Identity declarations for 47 classes       | WP-120 | ADR-006 accepted + OQ-6 (may shrink to docs)                    |
| B-23 | CONF-A ruling on ADR-005 backfill ordering | WP-300 | **reviewer ruling required** — do not resolve in implementation |
| B-24 | Provenance schema + writer                 | WP-500 | ADR-002 accepted + OQ-2                                         |
| B-25 | Confidence fields                          | WP-510 | ADR-010 accepted; ships with B-24                               |

---

## 🔴 Blocked on evidence that does not yet exist

| #    | Item                            | WP     | Needs                                |
| ---- | ------------------------------- | ------ | ------------------------------------ |
| B-30 | Traversal Phase A verification  | WP-200 | manifest v3 (`evaluation` context)   |
| B-31 | Traversal Phase B shadow        | WP-200 | Phase A finding non-seed paths       |
| B-32 | Transaction emitter deprecation | WP-400 | OQ-11 inventory + golden baseline    |
| B-33 | Vector trust backfill           | WP-300 | CONF-A ruling + OQ-5                 |
| B-34 | Historical migrations           | WP-600 | WP-400 + WP-500 + rehearsed rollback |
| B-35 | Gateway retirement              | WP-700 | OQ-7 + 7-day traffic + `410` shim    |

---

## ⚫ May never happen — planned termination points

| #    | Item                            | Terminates if                                                               |
| ---- | ------------------------------- | --------------------------------------------------------------------------- |
| B-40 | Graph grounding enablement      | traversal shows no measured benefit; **requires a separate ADR regardless** |
| B-41 | Superclass expansion enablement | no cross-domain improvement measured                                        |
| B-42 | Gateway removal                 | `central` Neo4j has content or an active writer                             |
| B-43 | ADR-002 batch tier              | OQ-2 shows heterogeneous per-edge provenance                                |

Listing these prevents the backlog from implying inevitability. Three of four have a real chance of
terminating, and terminating is the correct outcome in each case.

---

## Deleted from the backlog (Phase 12)

| Item                           | Reason                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Gateway capability harvest     | `fusion.py:81` proves RRF already exists in the serving tier; `ln_central` empty. **Zero work remains** |
| In-graph assertion reification | Superseded by ADR-002                                                                                   |
| Seven-component confidence     | Superseded by ADR-010                                                                                   |
| Neo4j class-label migration    | Superseded by ADR-011 — **no graph migration at all**                                                   |
| Central/collective knowledge   | Removed from the roadmap; no business case                                                              |
| Partitioning / sharding        | Trigger-gated at >10M nodes; the graph is 2,506                                                         |
| Custom rules engine            | Reasoning falls out of catalog metadata                                                                 |
| Multi-model embedding routing  | Deferred; one model, no measured need                                                                   |

**Eight workstreams deleted or superseded.** The shortest correct implementation is the preferred one.
