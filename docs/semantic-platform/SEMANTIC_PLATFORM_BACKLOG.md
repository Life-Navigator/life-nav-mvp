# Semantic Platform Backlog

**Status:** Designed · **Date:** 2026-07-30 · Parent: `SEMANTIC_PLATFORM_ARCHITECTURE.md`

Every item carries the nine required fields: architectural benefit · complexity · operational risk ·
scalability impact · evaluation strategy · migration plan · rollback plan · enterprise value · future
extensibility.

Ordered by **dependency then leverage**, not by phase number. IDs are stable.

---

## Tier 0 — Unblocks everything else

### SP-001 · Manifest policy fidelity (closes C-2)

Export `permitted_contexts` and `permitted_principals` (150 declared in Rust, 0 in the manifest).
Planner reads `is_traversable_in(rel, context, principal)` instead of a boolean.

- **Benefit** Restores the authorization model the catalog already declares; unblocks all governance and multi-agent work.
- **Complexity** Low — generator + schema + one read path.
- **Risk** Low — additive; the boolean is derivable for one release.
- **Scalability** Neutral (static data, cached).
- **Evaluation** CI gate: exported fields == catalog-declared fields. Zero behavioural change for the personal advisor, test-proven.
- **Migration** Dual-emit both shapes → planner cutover → drop boolean.
- **Rollback** Revert planner read; manifest superset stays valid.
- **Enterprise value** Per-principal access control is table stakes in any enterprise security review.
- **Extensibility** New principals and contexts become data rows.

### SP-002 · Retrieval golden set (`golden.json`)

The builder exists; the artifact does not. ≥75 labelled queries across canonical domains.

- **Benefit** Makes every retrieval/reasoning claim falsifiable. Currently none are.
- **Complexity** Medium — labelling dominates.
- **Risk** Low — read-only.
- **Scalability** Neutral.
- **Evaluation** Metric correctness against hand-computed fixtures; a test that fails if the runner bypasses auth/tenant/flags.
- **Migration** Additive; no production path modified.
- **Rollback** N/A.
- **Enterprise value** "How do you know retrieval works?" has no current answer.
- **Extensibility** Same harness measures every future strategy.
- **Note** Must exercise the **production path**, not library functions directly.

### SP-003 · Load test + connection pooling

Capacity is unknown. Per-call client construction pays a TLS handshake per store call.

- **Benefit** Known capacity; removes per-request handshake tax.
- **Complexity** Low.
- **Risk** Low.
- **Scalability** High — first thing that breaks, at tens of users.
- **Evaluation** p50/p95 on ≥3 endpoints before/after; documented capacity at defined concurrency.
- **Migration** Pooled clients at startup, closed at shutdown.
- **Rollback** Revert to per-call construction.
- **Enterprise value** Procurement asks for capacity numbers.
- **Extensibility** Baseline for every future performance claim.

---

## Tier 1 — Trust foundation

### SP-010 · Assertion node + provenance graph

Parallel provenance graph; domain edges carry only `assertion_id`.

- **Benefit** Makes 12 of 14 currently-unanswerable Guiding Principle questions answerable.
- **Complexity** Medium-High — new store, writer, backfill.
- **Risk** Medium — a second write path can drift; mitigated by SP-011.
- **Scalability** 1:1 with edges; externalize the body above 50M assertions (design permits this).
- **Evaluation** Provenance completeness (from 0%), 0 orphan assertions, 0 dangling edges, cascade correctness.
- **Migration** Forward-only → replay-recoverable subset → `unknown_legacy` for the remainder. **Never infer origin.**
- **Rollback** Stop writing assertions; the domain graph never depended on them.
- **Enterprise value** Audit, compliance, and reproducibility all reduce to this.
- **Extensibility** Confidence, temporal, and governance all attach here.

### SP-011 · Provenance-or-nothing writer

Edge creation requires an `AssertionId` obtainable only by constructing an `Assertion`.

- **Benefit** Makes provenance-free edges unrepresentable rather than discouraged.
- **Complexity** Low — type signature change.
- **Risk** Low — compile-time.
- **Scalability** Neutral.
- **Evaluation** No code path can emit a bare edge — compile-time + test.
- **Migration** Land with SP-010.
- **Rollback** Revert signature.
- **Enterprise value** "Can an untracked assertion enter the graph?" → provably no.
- **Extensibility** Same pattern for every future write path.

### SP-012 · Confidence vector

Seven components, stored separately, never collapsed. Null ≠ zero.

- **Benefit** Enables calibrated trust and explains _why_ uncertain.
- **Complexity** Medium.
- **Risk** Medium — miscalibration misleads; mitigated by Brier tracking.
- **Scalability** Neutral.
- **Evaluation** Calibration per source class; monotonicity property test; **0 self-reinforcing pairs**.
- **Migration** New writes → backfill document/financial tiers → legacy null.
- **Rollback** Disable confidence ranking flag.
- **Enterprise value** Defensible uncertainty is a regulated-advice requirement.
- **Extensibility** Per-component revision without touching consumers.

### SP-013 · Bitemporal model

Valid time vs transaction time; five temporal classes; `as_of` retrieval.

- **Benefit** Point-in-time reasoning, defensible past recommendations, no future-fact leakage.
- **Complexity** Medium-High.
- **Risk** Medium — changes result sets; must ship flag-off and be measured.
- **Scalability** Requires temporal indexes; bounded per tenant.
- **Evaluation** **0 future-fact leakage, 0 expired-fact leakage (hard gates)**; replay fidelity 100%.
- **Migration** Additive fields; `effective_from` left **null, not defaulted to `created_at`**.
- **Rollback** Disable `TEMPORAL_FILTERING`.
- **Enterprise value** "What did you advise, on what basis, in March?" becomes answerable.
- **Extensibility** Counterfactual and simulation build directly on `as_of`.

---

## Tier 2 — Governance

### SP-020 · Automatic privacy classification

`privacy_class` per node class, catalog-declared, drift-gated. Missing = build failure.

- **Benefit** Every object governed by default rather than by review.
- **Complexity** Low-Medium. **Risk** Low (additive metadata). **Scalability** Neutral.
- **Evaluation** 100% class coverage — build gate.
- **Migration** Declare, regenerate, gate. **Rollback** Remove gate.
- **Enterprise value** Prerequisite for SOC2/HIPAA conversations.
- **Extensibility** New classes are rows.

### SP-021 · Policy decision point

One evaluator: `decide(principal, context, action, assertion, as_of)`. Five distinct actions.

- **Benefit** Single authorization authority; five permissions that are genuinely independent.
- **Complexity** Medium. **Risk** Medium-High — bugs are outages or leaks.
- **Scalability** Cacheable static policy.
- **Evaluation** Determinism 100%; **0 cross-tenant, 0 provider→personal** (property tests); shadow-mode disagreement triaged.
- **Migration** Shadow mode first — **mandatory**, never skipped.
- **Rollback** Disable `POLICY_ENFORCEMENT`.
- **Enterprise value** The artifact a security reviewer asks for.
- **Extensibility** New actions/principals without touching call sites.

### SP-022 · Four-store deletion cascade

Neo4j + Qdrant + Postgres + object storage, with a machine-readable completion artifact.

- **Benefit** Deletion that is actually complete.
- **Complexity** Medium. **Risk** High — irreversible; dry-run mandatory.
- **Scalability** Batched.
- **Evaluation** 0 residue in all four stores, reconciled.
- **Migration** Dry-run → bounded batches → reconcile.
- **Rollback** None after execution — hence the dry-run gate.
- **Enterprise value** GDPR/CCPA compliance is unprovable without it.
- **Extensibility** New stores register as cascade targets.

---

## Tier 3 — Capability

### SP-030 · `RELATED_TO` → `HAS_PERSONA` remediation

148 edges, one shape. Catalog addition → normalizer fix → replay → verify → retire.

- **Benefit** Eliminates the last fallback-edge class; 148 edges become typed and traversable.
- **Complexity** Low-Medium. **Risk** Low — reversible, 1 edge/tenant, 0 cross-tenant.
- **Scalability** Neutral.
- **Evaluation** Expected exactly 148 edges / 148 tenants / 1 per tenant; `HAS_PERSONA`=148, `RELATED_TO`=0, total edges unchanged at 3,208.
- **Migration** `RELATED_TO_REMEDIATION.md` §4. **Never remap from endpoint types alone.**
- **Rollback** Re-emit from the same source records; replacement verified before retirement, so no state lacks both.
- **Enterprise value** Demonstrates the catalog-first migration discipline end to end.
- **Extensibility** Template for every future retype.

### SP-031 · Catalog metadata extension

`causal_meaning`, `citation_policy`, `reasoning_policy`, `evidence_requirement`, `temporal_behavior`, `merge_policy`, `conflict_resolution`, `retirement_policy`.

- **Benefit** **Unlocks ~9 of 13 reasoning strategies** — they are blocked on vocabulary, not algorithms.
- **Complexity** Medium — 147 rows to specify; the work is judgement, not code.
- **Risk** Low — additive, drift-gated.
- **Scalability** Neutral.
- **Evaluation** 100% row coverage — build gate; each strategy measured separately on the golden set.
- **Migration** Declare → regenerate → consume. **Rollback** Consumers ignore new fields.
- **Enterprise value** Reasoning capability grows without engine work.
- **Extensibility** This is the extensibility mechanism.

### SP-032 · Node class hierarchy (3 levels max)

`Thing → {Actor, Asset, Obligation, Objective, Observation, Artifact, Judgement, Episode}`.

- **Benefit** Cross-domain generalization ("what am I working toward?") without hardcoded lists.
- **Complexity** Medium. **Risk** Low — additive labels.
- **Evaluation** Each level must enable a query flat classes cannot answer; else it does not ship.
- **Migration** Add labels by class; backfill deterministic. **Rollback** Drop labels.
- **Extensibility** New domains inherit reasoning by placement.

### SP-033 · Reasoning strategies (13, individually gated)

- **Benefit** The advisor's differentiating capability.
- **Complexity** High overall; each strategy Low-Medium given SP-031.
- **Risk** Medium — unmeasured strategies degrade answers silently.
- **Evaluation** **Each measured independently; no measured improvement, no ship.**
- **Migration** One flag per strategy. **Rollback** Per-strategy flag.
- **Blocked on** SP-002, SP-031.

---

## Tier 4 — Platform

### SP-040 · Agent principal model — blocked on SP-001, SP-021

Empty-by-default grants; no wildcards; no self-approval.

- **Evaluation** 0 wildcard grants, 0 self-approved mutations, 0 ungranted cross-domain inference (hard gates).
- **Migration** Personal advisor = principal #1 with exactly today's permissions; prove zero change; then add agents.
- **Enterprise value** Unblocks A2A and every Phase 14 capability.

### SP-041 · Knowledge quality dashboard — 6 panels

- **Evaluation** Framework correctness tested against a fixture graph with known values — a wrong metric is worse than none.
- **Enterprise value** The artifact buyers, auditors, and acquirers ask for.

### SP-042 · Explain ANOM-1 (17-tenant Neo4j/Qdrant divergence)

- **Risk** Low (investigation). **Explicitly not a deletion task** — unexplained divergence is never treated as deletable orphans.
- **Gate** Currently red; stays red until explained.

### SP-043 · Resolve `:Entity` (population 0)

Define the retrievability predicate and populate, **or** remove it from all designs. Leaving it
half-present is the `domain=finance` silent-empty failure class.

### SP-044 · TTL/OWL disposition

Generate from the catalog as an export target, or delete. **Never hand-maintain a fourth vocabulary.**

### SP-045 · Move `_DOMAIN_TERMS` into the generated domain manifest

The one remaining place a new domain requires editing retrieval code — the evolution-rule violation.

- **Complexity** Low. **Benefit** Domain onboarding becomes pure data.

### SP-046 · Harvest api-gateway before retirement

RRF fusion + central retrieval exist nowhere else. Retirement requires 0 traffic over 7 days, a
`410 Gone` shim for one release, and the replacement live in core-api.

---

## Explicitly deferred

| Item                                | Re-entry trigger                     |
| ----------------------------------- | ------------------------------------ |
| Graph partitioning                  | > 10M nodes                          |
| Vector sharding                     | > 10M points                         |
| Multi-model embedding routing       | second model with a measured win     |
| Streaming ingestion                 | sub-minute freshness requirement     |
| Custom rules engine                 | proven need after SP-033 measurement |
| Collective / cross-tenant knowledge | policy plane Live-store tested       |
| Multi-region                        | latency SLO by geography             |
