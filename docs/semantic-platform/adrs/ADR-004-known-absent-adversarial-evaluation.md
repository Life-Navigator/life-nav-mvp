# ADR-004 — Known-Absent and Adversarial Retrieval Evaluation

**Status:** Proposed · **Date:** 2026-07-30 · **Decision deadline:** before any retrieval change ships
**Owners:** AI/Retrieval · **Reviewers:** Graph Platform, Security, Privacy
**Related findings:** REVIEW R-4 (High), debt D-5/D-8 · Blocks ADR-001, ADR-008 outcome measurement

---

## Context

`evals/retrieval/build_golden.py` exists; `golden.json` does not. No retrieval baseline exists.

## Measured evidence

_Measured facts._ `ls apps/lifenavigator-core-api/evals/retrieval/golden.json` → **absent** (2026-07-30).
`build_golden.py:75-80` defines `SEED = 20260729` and `DOMAINS`; the header documents that queries are
templates with `{e}` _"filled with a real entity title from the tenant's own graph, so every generated
query is answerable from that tenant's data."_ Candidate pool unions v2 hits + v1 hits + entities
neither returned.

_Design inference._ Every generated query is **answerable by construction**. The third pool source
makes _recall_ measurable rather than trivially 1.0, which is a genuine strength — but nothing in the
design can produce a query whose correct answer is "I have no evidence."

_Unresolved assumption._ Whether the 5 synthetic personas have sufficient domain coverage for ≥75
queries across all domains (OQ-4).

## Problem statement

The evaluation measures **ranking** and is structurally blind to **coverage**. A system optimized
against it can look excellent while fabricating answers for facts it does not hold — the dominant
real-world failure.

## Forces and constraints

Must exercise the production path (auth + tenant + flags), not library functions · must be tenant-safe ·
must be repeatable · must be permitted to return a negative verdict on graph traversal.

## Decision drivers

Measuring abstention · fabrication gating · contamination prevention · repeatability.

## Options considered

1. Template queries from existing entities only (status quo).
2. Human-authored golden set.
3. Synthetic positive + negative generation.
4. **Hybrid: synthetic generation + human review, with a known-absent negative set.**
5. Production trace sampling.

## Comparative decision matrix

| Criterion            | 1 Templates | 2 Human | 3 Synthetic ± | 4 Hybrid | 5 Prod traces |
| -------------------- | ----------- | ------- | ------------- | -------- | ------------- |
| Correctness          | **2 HB**    | 5       | 4             | 5        | 4             |
| Security             | 4           | 4       | 4             | 4        | 2             |
| Privacy              | 4           | 4       | 4             | 4        | **1 HB**      |
| Tenant safety        | 4           | 4       | 4             | 4        | 2             |
| Semantic fidelity    | 2           | 5       | 3             | 5        | 4             |
| Impl. complexity     | 5           | 2       | 4             | 3        | 3             |
| Migration complexity | 5           | 4       | 4             | 4        | 3             |
| Ops complexity       | 5           | 3       | 4             | 4        | 2             |
| Scalability          | 5           | 2       | 5             | 4        | 4             |
| Reversibility        | 5           | 5       | 5             | 5        | 5             |
| Observability        | 3           | 4       | 4             | 5        | 4             |
| Cost                 | 5           | 2       | 4             | 4        | 3             |
| Maintainability      | 3           | 2       | 4             | 4        | 3             |

**Hard blockers.** Option 1: cannot measure abstention — the finding itself. Option 5: sampling real
user traces for an eval corpus moves production personal data into a test artifact; privacy-disqualified
without a separate consent and de-identification design.

## Decision

**Adopt Option 4.** Synthetic generation over the 5 synthetic personas, human-reviewed, with six
mandatory categories.

## Detailed design

| Category                                          | Min count | Expected behaviour                            |
| ------------------------------------------------- | --------- | --------------------------------------------- |
| Known-present                                     | 40        | correct entity retrieved, ranked              |
| **Known-absent**                                  | 20        | **abstention**; zero fabricated substitute    |
| Unanswerable / underspecified                     | 10        | clarifying question, no invented fact         |
| Contradictory evidence                            | 8         | surfaces conflict, does not silently pick     |
| Temporal traps (future/expired stated as present) | 12        | no future or expired fact asserted as current |
| Cross-tenant probes                               | 10        | zero foreign-tenant evidence, always          |

**Construction.** Known-absent queries name entity classes the persona provably lacks, verified by a
live count query at build time (a class becomes ineligible the moment data appears).
**Contamination prevention:** the generator records, per query, the graph state hash it was built
against; a query whose absence assumption is violated is auto-retired rather than silently wrong.
**Tenant-safe fixtures:** synthetic personas only; no real tenant data.
**Versioning:** `golden.json` carries `SEED`, generator version, ontology version, graph state hash.
**Scoring:** unsupported answers score **negative**, not zero — a confident wrong answer is worse than
no answer, and a zero-score would rank it equal to abstention.

## Security implications

Cross-tenant probes become a standing regression test rather than a one-off property test.

## Privacy implications

Synthetic personas only; no production data enters the corpus.

## Tenant-isolation implications

The cross-tenant category directly measures the platform's most severe failure mode.

## Data-model implications

None.

## Scalability implications

Corpus grows with domains, not with users. Negligible.

## Operational implications

Runs in CI report-only, then gating. Cost per run must be measured and budgeted.

## Cost implications

Embedding + retrieval per query per run; bounded by corpus size.

## Developer-experience implications

Gives every retrieval change a falsifiable verdict for the first time.

## Migration plan

1. Extend `build_golden.py` with negative/adversarial generators.
2. Generate; human-review; commit `golden.json`.
3. Baseline the current retriever (vector-only, flag-off).
4. CI report-only; then gate fabrication at 0.

## Backfill plan

N/A.

## Compatibility strategy

Additive; no production path modified.

## Rollback strategy

N/A — read-only artifact.

## Observability requirements

Per-category metrics; per-release deltas; fabrication count by category.

## Evaluation plan

The framework tests itself against hand-computed fixtures — a wrong metric turns a real problem into a
green light.

## Falsification criteria

If graph traversal shows no measurable benefit on any category, **that is a valid result** and ADR-008
and downstream reasoning work must be reconsidered. The eval must be allowed to say no.

## Acceptance criteria

≥100 queries across all six categories · committed and versioned · runner provably exercises the
production path (test-enforced) · fabrication = 0 on known-absent · cross-tenant leakage = 0.

## Non-goals

Not measuring advisor language quality. Not replacing the advisor eval harness.

## Risks accepted

Synthetic personas may not represent real query distribution. Accepted for now; revisit if production
telemetry (aggregate, not content) shows divergence.

## Residual uncertainty

OQ-4 (persona coverage sufficiency).

## Consequences

Every subsequent retrieval claim becomes measurable. This is the precondition for ADR-001 and ADR-008
acceptance criteria.

## Follow-up work

Injection/poisoning scenarios shared with ADR-005.

## Superseded documents

Supersedes `SEMANTIC_QUALITY_FRAMEWORK.md` §5's implicit assumption that the existing builder suffices.

## Approval record

| Reviewer  | Role         | Verdict | Date |
| --------- | ------------ | ------- | ---- |
| _pending_ | AI/Retrieval | —       | —    |
| _pending_ | Security     | —       | —    |
