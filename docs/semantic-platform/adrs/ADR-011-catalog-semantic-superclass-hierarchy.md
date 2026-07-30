# ADR-011 — Catalog-Based Semantic Superclass Hierarchy

**Status:** Proposed · **Date:** 2026-07-30 · **Decision deadline:** before cross-domain reasoning work
**Owners:** Graph Platform · **Reviewers:** AI/Retrieval, Security, Domain owners
**Related findings:** REVIEW §1.4 (self-correction) · Depends on ADR-003; enables cross-domain reasoning

---

## Context

`SEMANTIC_DATA_MODEL.md` §4 proposed an 8-branch node class hierarchy realized as additional Neo4j
labels. The final review rejected it on proportionality. This ADR replaces it.

## Measured evidence

_Measured facts._ Production 2026-07-30, 47 node labels, 2,506 nodes. Goal-like classes:
`CareerGoal` 79, `HealthGoal` 31, `EducationGoal` 13, `Goal` 4 — **127 nodes total**, 5.1% of the graph.
Source: `production_baseline.json` label counts.

_Measured fact._ The manifest already carries a per-relationship `family` field (7 families across 147
rows) and the planner already derives behaviour from it (`planner.py:141` — _"Read the generated
contract into (families, weights, personal-advisor-traversable)"_). **A catalog-driven classification
mechanism already exists and is consumed.**

_Design inference._ A graph-wide label migration to serve 127 nodes fails the complexity test, and dual
labels introduce a consistency obligation (label and class must never disagree) that catalog metadata
does not.

## Problem statement

Cross-domain reasoning ("what am I working toward?") requires knowing that four differently-named
classes are all objectives, without hardcoding the list in retrieval code.

## Forces and constraints

Must not require graph migration · must not add a runtime consistency obligation · must respect ADR-003
authorization (expansion must not widen access) · must be drift-gated like every other contract.

## Decision drivers

Equivalent reasoning capability at minimum cost · no backfill · reviewability.

## Options considered

1. Multiple Neo4j labels (prior design).
2. **Catalog `superclass` field.**
3. Separate ontology graph.
4. Runtime hardcoded class families.
5. OWL class hierarchy (`ontology/*.ttl`).

## Comparative decision matrix

| Criterion            | 1 Labels | 2 Catalog field | 3 Ontology graph | 4 Hardcoded | 5 OWL |
| -------------------- | -------- | --------------- | ---------------- | ----------- | ----- |
| Correctness          | 4        | 5               | 4                | 3           | 4     |
| Security             | 4        | 5               | 3                | 3           | 3     |
| Privacy              | 4        | 4               | 4                | 4           | 4     |
| Tenant safety        | 4        | 5               | 4                | 4           | 4     |
| Semantic fidelity    | 4        | 5               | 5                | 2           | 5     |
| Impl. complexity     | 3        | 5               | 2                | 5           | 2     |
| Migration complexity | **2 HB** | 5               | 2                | 5           | 3     |
| Ops complexity       | 3        | 5               | 2                | 4           | 2     |
| Scalability          | 3        | 5               | 3                | 4           | 3     |
| Reversibility        | 2        | 5               | 3                | 4           | 4     |
| Observability        | 3        | 5               | 3                | 2           | 3     |
| Cost                 | 3        | 5               | 2                | 5           | 3     |
| Maintainability      | 3        | 5               | 3                | **1 HB**    | 3     |

**Hard blockers.** Option 4: hardcoded class families are exactly the defect class this programme
exists to eliminate (`EDGE_FAMILY` dict, `"finance"` literal) — policy as code cannot be enumerated,
diffed, or drift-gated. Option 1: a graph-wide migration plus a permanent dual-source consistency
obligation, for 5.1% of nodes. Option 5 is deferred to the TTL disposition question, where OWL is
either generated from the catalog or deleted — it must not become a fifth authority here.

## Decision

**Adopt Option 2 — `superclass` declared in the node class spec, exported in the manifest, expanded by
the planner at query construction.**

## Detailed design

```rust
pub struct NodeClassSpec {
    class:      &'static str,          // "CareerGoal"
    superclass: Option<&'static str>,  // "Objective"
    // ...
}
```

**Initial superclasses** (max depth **2** — `Thing` is implicit and not modelled, because a universal
root that every class belongs to carries no information):

| Superclass    | Members (live counts)                                                            |
| ------------- | -------------------------------------------------------------------------------- |
| `Actor`       | UserProfile 268, SpouseProfile 1, Dependent 6                                    |
| `Asset`       | FinancialAccount 419, InvestmentHolding 22                                       |
| `Obligation`  | InsuranceProfile 1, GuardianshipPlan 1, EstatePlan 1                             |
| `Objective`   | CareerGoal 79, HealthGoal 31, EducationGoal 13, Goal 4                           |
| `Observation` | TransactionSummary 984, BodyMetric 32, SleepLog 3, ActivityLog 2, NutritionLog 2 |
| `Artifact`    | Document 22, DocumentField 53                                                    |
| `Judgement`   | Evidence 63, Assumption 46, Tradeoff 21, AdviceBoundary 21, \*Recommendation 17  |
| `Episode`     | LifeDecision 4, DecisionScenario 12, ProgramComparison 1                         |

**Multiple inheritance: prohibited.** A class has at most one superclass. Multiple inheritance
introduces resolution-order questions with no current use case, and every one of the 47 live classes
fits a single parent.

**Cycle prevention:** depth capped at 2 and single-parent, so cycles are structurally impossible; a
build-time assertion enforces it regardless.

**Expansion semantics:** the planner expands `Objective` → `{CareerGoal, HealthGoal, EducationGoal,
Goal}` when constructing Cypher label filters. Expansion is **purely additive over classes the
principal is already permitted to see** — it never widens authorization.

**ADR-003 interaction (critical):** authorization is evaluated **after** expansion, per concrete class
and per relationship. Expanding to a superclass must never grant access to a member class the principal
could not otherwise traverse. Property-tested: for every principal, the expanded result set must be a
subset of the union of individually-permitted class results.

**Versioning:** superclass changes are manifest changes, drift-gated. Adding a superclass is additive;
re-parenting a class is a **behavioural** change requiring golden-set measurement.

**Justification rule:** each superclass must enable a query that flat classes cannot answer, or it does
not ship. `Objective` → cross-domain goals; `Observation` → uniform temporal decay (ADR pending);
`Judgement` → "show me what the system concluded, not what it was told."

## Security implications

None beyond the expansion/authorization ordering, which is explicitly tested.

## Privacy implications

None. Expansion cannot cross privacy classes because authorization is applied post-expansion.

## Tenant-isolation implications

None — expansion affects label filters, not tenant predicates, which remain on both endpoints.

## Data-model implications

One optional field per node class spec. **No graph change, no backfill, no migration.**

## Scalability implications

Expansion is a compile-time-sized set lookup; negligible. Slightly larger label filters in Cypher.

## Operational implications

None.

## Cost implications

None.

## Developer-experience implications

Class taxonomy becomes reviewable in one file rather than inferred from labels across a live graph.

## Migration plan

1. Add `superclass` to node class specs.
2. Export in the manifest (with the ADR-003 v3 bump, same change).
3. Planner expansion behind `SUPERCLASS_EXPANSION`.
4. Measure on the golden set.

## Backfill plan

**None required** — this is the ADR's principal advantage over the superseded design.

## Compatibility strategy

Additive; consumers ignoring `superclass` behave exactly as today.

## Rollback strategy

Disable the flag. No data was changed, so rollback is total.

## Observability requirements

Expansion hit counts per superclass · query latency with/without expansion.

## Evaluation plan

ADR-004 cross-domain query category must improve with expansion enabled; no regression elsewhere.

## Falsification criteria

If cross-domain queries do not improve, the hierarchy provides no measured value and should not ship —
the justification rule applied honestly.

## Acceptance criteria

47/47 classes declare `superclass` or `None` · depth ≤ 2 · no multiple inheritance · expansion ⊆
individually-permitted results for every principal (property test) · measured improvement on
cross-domain queries.

## Non-goals

Not modelling `Thing`. Not multiple inheritance. Not OWL reconciliation. Not graph labels.

## Risks accepted

A single-parent taxonomy will eventually encounter a class that legitimately belongs to two parents.
Accepted: revisit with evidence rather than pre-building for it.

## Residual uncertainty

Whether `Observation` is the right grouping for `TransactionSummary` given ADR-001 may reduce its role.

## Consequences

Delivers the reasoning capability of the superseded design at a fraction of the cost and with no
migration risk.

## Follow-up work

Temporal decay by superclass; TTL/OWL disposition.

## Superseded documents

**Supersedes `SEMANTIC_DATA_MODEL.md` §4 and backlog item SP-032** (Neo4j label hierarchy).

## Approval record

| Reviewer  | Role           | Verdict | Date |
| --------- | -------------- | ------- | ---- |
| _pending_ | Graph Platform | —       | —    |
| _pending_ | AI/Retrieval   | —       | —    |
