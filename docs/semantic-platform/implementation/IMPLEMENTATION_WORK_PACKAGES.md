# Implementation Work Packages

**Date:** 2026-07-30 · Phase 3. **Every package carries an activation condition. None is active.**

Package rule: independently reviewable, independently reversible, mapped to exactly one ADR (or to no
ADR only where the work is unconditional platform hygiene, marked ⚡).

Detail depth is proportionate to certainty. Packages whose ADR could be overturned by an unresolved
open question are **scaffolded, not specified** — writing their migration runbooks now would be work
discarded on a negative OQ (Phase 12: _delete unnecessary work_).

---

## ⚡ WP-010 · Architectural invariant automation — **NO ADR DEPENDENCY, may start today**

**Purpose.** Move four invariants from human memory to CI. Protects properties the platform already
relies on, including an assumption ADR-002 will depend on.
**Activation:** none required.
**Scope.** DA-1 (single writer + read-only Python client), DA-2 (both-endpoint tenant binding),
DA-3 (no raw-string relationship emission), DA-4 (family ≠ permission; provider exclusion).
**Deliverables.** 4 CI checks + fixtures that prove each fails on a deliberately bad input.
**Repos/files.** `.github/workflows/`, `apps/ingestion-worker/tests/`,
`apps/lifenavigator-core-api/tests/`.
**Tests.** Each gate demonstrated **failing** on a bad fixture — an undemonstrated gate is decoration.
**Migration/rollback.** None; additive CI. Rollback = remove the check.
**Ownership.** Graph Platform. **Effort:** 3–4 days. **Risk:** Low (may surface existing violations —
see IQ-3, which converts prevention into remediation).
**Completion evidence.** 4 gates green; 4 bad-fixture runs red; violation count at baseline recorded.

---

## WP-000 · Stage 0 credential closure ⚡

**Purpose.** Close the exposure that gates every write-enabled item.
**Activation:** authorized independently of ADR-007 approval (containment must not wait).
**Scope.** Per ADR-007 §Detailed design, the eight-step sequence per credential: Fly org token, Qdrant
`manage` key, Supabase DB password, Management PAT, gateway service-role key.
**Deliverables.** Revocation confirmations; **rejected-old-credential proof per credential**;
least-privilege replacements; consumer inventory; consumer verification; closure record.
**Verification.** Step 3 (rejection confirmed) and step 6 (consumers verified) are both mandatory.
**Rollback.** None — revocation is intentionally irreversible. Mitigation is the consumer inventory
(step 4) executed **before** revocation.
**Ownership.** Security. **Effort:** 1–2 days + log review. **Risk:** Medium (consumer breakage).
**Completion evidence.** Closure record with rejection proof per credential; service-role holders = 1.

---

## WP-100 · Retrieval golden set — ADR-004

**Activation:** ADR-004 `Accepted`; OQ-4 resolved.
**Scope.** Extend `build_golden.py` with negative and adversarial generators; six categories
(known-present 40, known-absent 20, unanswerable 10, contradictory 8, temporal traps 12, cross-tenant 10).
**Deliverables.** `evals/retrieval/golden.json` (versioned: seed, generator version, ontology version,
graph state hash); baseline report for the current retriever; CI job report-only.
**Tests.** Metric correctness vs hand-computed fixtures; a test that **fails if the runner bypasses
auth/tenant/flags**.
**Migration/rollback.** None — additive, read-only, no production path modified.
**Ownership.** AI/Retrieval. **Effort:** 2–2.5 weeks (labelling dominates). **Risk:** Low.
**Completion evidence.** ≥100 queries committed; baseline recorded; production-path test passing.

---

## WP-110 · Manifest v3 — ADR-003 + ADR-011 (single schema change)

**Activation:** **both** ADRs `Accepted`. Neither ships alone (CONFLICT-3).
**Scope.** Export `permitted_contexts`, `permitted_principals`, `sensitivity`, `node_classes[].superclass`;
dual-emit derived `traversable` for one release; Python loader reads the matrix and rejects unknown
versions; principal + context registries; CI fidelity gate.
**Deliverables.** Generator change (`relationship_catalog.rs`, node class specs), regenerated manifest,
loader change (`planner.py`), fidelity gate, audit logging of policy decisions.
**Tests.** **Personal advisor resolves to exactly 119 relationship types — zero behavioural change.**
Full principal × context × relationship property matrix. Expansion ⊆ individually-permitted results.
Unknown principal/context/version → deny.
**Migration.** Dual-emit → cutover → drop boolean. **Rollback.** Revert loader; manifest superset stays valid.
**Ownership.** Security (003) + Graph Platform (011). **Effort:** 1–1.5 weeks. **Risk:** Low–Medium.
**Completion evidence.** Fidelity gate green; 119-parity test green; 0 wildcard grants.

---

## WP-120 · Identity declarations — ADR-006

**Activation:** ADR-006 `Accepted`; OQ-6 resolved (may shrink this package to documentation).
**Scope.** Declare `business_identity`, `identity_scope`, merge/split eligibility for all 47 live node
classes; alias table; duplicate detection **report-only**.
**Deliverables.** Class specs; alias schema; detection job + report.
**Migration/rollback.** No mutation — detection only. Rollback = stop running.
**Ownership.** Data Platform. **Effort:** 1–2 weeks (judgement, not code). **Risk:** Low.
**Completion evidence.** 47/47 classes declare a key or `None`; 0 collisions; detection in CI.

---

## WP-200 · Traversal verification — ADR-008

**Activation:** ADR-008 `Accepted`; WP-110 complete (`evaluation` context exists); WP-100 available.
**Scope.** Phase A out-of-band read-only diagnostic in-service; Phase B shadow only if A succeeds.
**Deliverables.** `artifacts/graphrag-reconciliation/traversal_verification.json` (hashed tenants,
per-hop counts, paths, timings, classified errors).
**Bounds.** depth ≤ 3, breadth ≤ 25/hop, node budget 500, timeout 5s, `evaluation` context only.
**Tests.** Advisor context packet byte-identical with shadow on and off.
**Migration/rollback.** None; read-only. Rollback = stop.
**Ownership.** AI/Retrieval. **Effort:** 3–5 days. **Risk:** Low.
**Completion evidence.** ≥1 **non-seed** path on ≥3 tenants; 0 cross-tenant nodes; 0 unclassified errors.
**May terminate the ADR:** zero non-seed paths is a valid, publishable outcome.

---

## WP-300 · Vector trust plumbing — ADR-005 ⚠ **BLOCKED ON CONF-A**

**Activation:** ADR-005 `Accepted` **and CONF-A ruled on by reviewers**; OQ-5 resolved; WP-510 complete.
**Scope (scaffold only — not specified pending CONF-A).** Six payload fields + indexes; backfill of
2,218 points (payload-only, no vector change); filter composition; reconciliation job with **asymmetric**
drift classification; fail-safe write ordering.
**Why scaffolded:** CONF-A may move the backfill after Stage 5 or add a `traceability_pending` state.
Specifying the runbook before that ruling would produce a document to be rewritten.
**Ownership.** Security. **Effort:** TBD post-ruling. **Risk:** Medium.

---

## WP-400 · Transaction emission correction — ADR-001

**Activation:** ADR-001 `Accepted`; OQ-1 + OQ-11 resolved; WP-100 baseline exists.
**Scope (steps 1–3 only).** Inventory read dependencies; **deprecate** the user-anchored
`HAS_TRANSACTION` emitter (stops new writes, existing reads unaffected); observe one release.
**Explicitly excluded:** historical edge removal — that is WP-600.
**Deliverables.** Read-dependency inventory; lifecycle keyed by (relationship, emitter); deprecation.
**Tests.** Golden-set financial categories show **no regression at depth 2**.
**Rollback.** Re-enable the emitter. Nothing is deleted at this step.
**Ownership.** Graph Platform. **Effort:** 1 week. **Risk:** Low (deprecation only).

---

## WP-500 · Provenance schema and forward writes — ADR-002

**Activation:** ADR-002 `Accepted`; **OQ-2 resolved** (design changes materially if negative);
WP-010 DA-1 landed (single-writer assumption protected).
**Scope (scaffold — full spec deferred to post-OQ-2).** `assertion` + `assertion_batch` tables in
Postgres; worker writes provenance before the edge; edge carries reference; type-system gate.
**Tests.** A bare edge write must not compile; 0 dangling references; cascade correctness.
**Rollback.** Stop writing; drop tables. The graph never depended on them structurally.
**Ownership.** Graph Platform + Data Platform. **Effort:** 3–4 weeks. **Risk:** Medium.

---

## WP-510 · Confidence fields — ADR-010

**Activation:** ADR-010 `Accepted`; ships **with** WP-500 (fields have no home otherwise).
**Scope.** Three nullable components on the assertion row; catalog source priors; projections computed
per request; monotonicity + self-reinforcement property tests.
**Rollback.** Disable ranking/citation flags; fields inert.
**Ownership.** AI/Retrieval. **Effort:** 1 week on top of WP-500. **Risk:** Low.

---

## WP-600 · Historical migrations — ADR-001 step 4, ADR-002 backfill, `HAS_PERSONA`

**Activation:** WP-000 closed; WP-400 + WP-500 complete; every migration idempotent on a second dry run.
**Scope (scaffold).** Remove historical user-anchored edges in bounded batches; replay-recoverable
provenance backfill; `unknown_legacy` classification; `RELATED_TO` → `HAS_PERSONA` (148 edges, 148
tenants, 1 each).
**These are the first true production mutations in the programme.** Each carries the full safety
envelope: preflight artifact, expected counts, invariants, bounded batches, reconciliation, stop
conditions.
**Rollback.** Per migration, defined in its ADR. `HAS_PERSONA`: re-emit from source; replacement
verified before retirement so no state lacks both edges.
**Ownership.** Graph Platform. **Effort:** 2–3 weeks. **Risk:** **High — highest in the programme.**

---

## WP-700 · Gateway retirement — ADR-009

**Activation:** ADR-009 `Accepted`; **OQ-7 resolved**; 7-day zero-traffic evidence; route inventory;
`410` shim shipped one release.
**Scope.** Revoke gateway service-role key (**already in WP-000, independent**); inventory; shim; removal.
**Rollback.** Redeploy from git; image + config retained 30 days.
**Ownership.** Platform Ops. **Effort:** 1 week + 7-day observation. **Risk:** Low.
**May terminate:** live content or an active writer in `central` Neo4j halts retirement.

---

## Deliberately not written

| Would-be package                              | Why omitted                                 |
| --------------------------------------------- | ------------------------------------------- |
| Detailed migration runbooks for WP-500/WP-600 | Discarded if OQ-2 negative                  |
| ADR-005 backfill runbook                      | Discarded or rewritten by the CONF-A ruling |
| Grounding rollout package                     | Requires a separate ADR that does not exist |
| Partitioning / sharding                       | Trigger-gated at >10M nodes; graph is 2,506 |
| Collective knowledge                          | Deleted from the roadmap; no business case  |
