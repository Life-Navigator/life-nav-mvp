# Implementation Open Questions

**Date:** 2026-07-30 · Phase 11. **0 of 9 blocking questions currently have an owner.** That is the
programme's actual critical path — not any engineering task.

> **2026-07-30 — credential-free investigation complete.** See
> `docs/semantic-platform/review/OQ_INVESTIGATION_FINDINGS.md`.
> **OQ-5 and IQ-3 fully answered. OQ-11 substantially answered. OQ-6 and OQ-1 partial.**
> No ADR status changed; remaining gaps are live-data only.

Classification per the brief: _Implementation blocker · Operational blocker · Architectural blocker ·
Research item · Deferred._

---

## 1. Blocking — owner required before the dependent ADR may be `Accepted`

| OQ                                                | Class                              | Blocks                              | Measurement                                                                  | Expected evidence                                       | Proposed owner        | Escalation                                                                |
| ------------------------------------------------- | ---------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------- |
| **OQ-12** credential used during exposure window? | **Operational + Security blocker** | ADR-007 closure, whole programme    | Review Supabase/Fly/Qdrant auth logs for the exposure window                 | Access log analysis, hashed                             | Security              | Engineering Lead → incident escalation if any use found                   |
| **OQ-9** 17-tenant Neo4j/Qdrant divergence        | **Architectural blocker**          | ADR-002, ADR-007, all quality gates | Enumerate tenants both stores, diff both directions, classify into 9 buckets | `tenant_divergence_classification.json`, 0 unclassified | Data Platform         | **Buckets 2/3/5/7/9 → Stage 0 blocker**; bucket 5 → compliance escalation |
| **OQ-7** `central` Neo4j contents/writers         | **Implementation blocker**         | ADR-009                             | Read-only inventory: node/edge counts, writers, freshness                    | Inventory artifact                                      | Platform Ops          | Any live content → halt retirement, re-open harvest                       |
| **OQ-2** Plaid batch homogeneity                  | **Architectural blocker**          | ADR-002                             | Inspect worker queue semantics + one live ingest trace                       | Trace showing shared vs per-edge origin                 | Graph Platform        | Negative → ADR-002 falls back to per-edge; storage argument weakens       |
| **OQ-11** 1-hop `user → HAS_TRANSACTION` readers  | **Implementation blocker**         | ADR-001                             | grep + traversal trace + advisor query review                                | Read-dependency inventory                               | Graph Platform        | Any unre-pointable reader → ADR-001 rejected                              |
| **OQ-1** `TransactionSummary` granularity         | **Implementation blocker**         | ADR-001 estimate                    | Read `normalizer.rs`; count distinct `(account_id, period)`                  | Granularity statement + live counts                     | Finance Domain        | Finer than monthly → estimate conservative, case strengthens              |
| **OQ-6** `entity_id` derivation                   | **Implementation blocker**         | ADR-006                             | Read `normalizer.rs` id construction                                         | Derivation statement                                    | Data Platform         | Already business-derived → ADR-006 shrinks to documentation               |
| **OQ-5** review-state propagation to Qdrant       | **Implementation blocker**         | ADR-005 backfill                    | Inspect worker payload construction                                          | Field inventory                                         | Document Intelligence | Absent → backfill derives from Postgres                                   |
| **OQ-4** persona coverage for ≥100 queries        | **Implementation blocker**         | ADR-004                             | Per-domain entity census across 5 personas                                   | Census table                                            | AI/Retrieval          | Insufficient → seed personas; **never** use real tenant data              |

**Owners above are proposals, not assignments.** A name in this column that nobody has agreed to is
exactly the decorative ownership the status rule forbids. Session 1 must convert these to real names
with dates.

---

## 2. Non-blocking

| OQ                                              | Class             | Note                                                                           |
| ----------------------------------------------- | ----------------- | ------------------------------------------------------------------------------ |
| OQ-3 Postgres sufficiency beyond ~1B assertions | **Research item** | Model after Stage 5 measurement; relational design does not foreclose columnar |
| OQ-8 resolution signal numeric or boolean       | **Research item** | Determined during ADR-006 build; ADR-010 degrades gracefully either way        |
| OQ-10 `:Entity` predicate (population 0)        | **Deferred**      | Define or remove. Leaving it half-present is the silent-empty failure class    |

---

## 3. New questions raised by program construction

| ID       | Question                                                                                           | Class                     | Blocks         | Owner                     |
| -------- | -------------------------------------------------------------------------------------------------- | ------------------------- | -------------- | ------------------------- |
| **IQ-1** | Does the ADR-005 Stage-3 backfill have an authoritative source before Stage 5?                     | **Architectural blocker** | ADR-005        | Security + Graph Platform |
| **IQ-2** | Which repository hosts the ADR-002 provenance schema — core-api migrations or a new one?           | Implementation            | ADR-002        | Data Platform             |
| **IQ-3** | Do the 4 unautomated invariants (I-1, I-2, I-3, I-10) have current violations already in the tree? | Implementation            | DA-1…DA-3      | Graph Platform            |
| **IQ-4** | Is `.venv` the sanctioned core-api test environment, or is CI's environment different?             | Operational               | all test gates | Platform Ops              |

**IQ-1 is CONF-A**, escalated as a proposed ADR-005 amendment (`IMPLEMENTATION_PROGRAM.md` §2).

**IQ-3 deserves attention:** the audit assumes I-1/I-2/I-3/I-10 currently hold. That was verified for
I-1/I-2 by inspection this session. **I-3 and I-10 were not exhaustively verified** — building the check
may reveal existing violations, which would convert a preventive gate into a remediation task.

---

## 4. Ownership status

| Category                         | Count          | Owned |
| -------------------------------- | -------------- | ----- |
| Blocking (ADR)                   | 9              | **0** |
| Blocking (implementation-raised) | 2 (IQ-1, IQ-3) | 0     |
| Non-blocking                     | 3              | 0     |
| **Total**                        | **14**         | **0** |

Per the binding status rule, **no ADR may reach `Accepted` while a rejection trigger it depends on lacks
owner, method, date, and escalation path.** With 0 of 11 blocking questions owned, **no ADR is currently
eligible for acceptance** — including ADR-003 and ADR-004, which have no blocking _dependencies_ but
whose acceptance still requires their triggers to be owned.

That is the single fact that gates the entire programme.
