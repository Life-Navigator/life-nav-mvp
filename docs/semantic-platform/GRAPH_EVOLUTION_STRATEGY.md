# Graph Evolution Strategy

**Status:** Designed · **Date:** 2026-07-30 · Parent: `SEMANTIC_PLATFORM_ARCHITECTURE.md`

Covers brief Phase 8. Also resolves the standing OWL/TTL question (§6).

---

## 1. The governing constraint

> _"Assume new domains will appear every month."_

Over a decade that implies roughly 120 domain additions, an unknown number of relationship
deprecations, and several ontology restructurings. **The graph will be migrated more often than it
will be designed.** Migration must therefore be a first-class, routine, low-drama operation — not an
event.

The test from `SEMANTIC_DATA_MODEL.md` §6 is the north star: _a new domain must require catalog and
spec rows only, never a code change in the retrieval path._

---

## 2. Versioning

Three independently versioned artifacts. Conflating them is what makes ontology upgrades terrifying.

| Artifact                                       | Version                   | Compatibility rule                                                        |
| ---------------------------------------------- | ------------------------- | ------------------------------------------------------------------------- |
| **Ontology** (`ontology_manifest.json`)        | integer, currently **v2** | additive within major; removals require a major bump                      |
| **Domain vocabulary** (`domain_manifest.json`) | integer                   | canonical values are **append-only**; aliases may be added, never removed |
| **Retrieval** (planner/traversal/fusion)       | semver                    | independent of ontology version                                           |

Every answer pins all three (`PROVENANCE_MODEL.md` §6). An ontology upgrade **never retroactively
alters a past trace** (invariant I-10) — past assertions keep the version they were written under.

### 2.1 Compatibility classes

| Change                            | Class                     | Requires                          |
| --------------------------------- | ------------------------- | --------------------------------- |
| Add relationship type             | additive                  | catalog row + regenerate          |
| Add node class                    | additive                  | spec + privacy class + regenerate |
| Add domain                        | additive                  | vocabulary entry + catalog rows   |
| Add alias (`finance`→`financial`) | additive                  | vocabulary entry                  |
| Widen `permitted_contexts`        | **breaking (governance)** | policy review + shadow mode       |
| Narrow `permitted_contexts`       | additive-safe             | may reduce results; measure       |
| Change `weight`                   | behavioural               | measure on golden set             |
| Deprecate relationship            | staged                    | §3                                |
| Remove relationship               | **breaking**              | major bump + migration            |
| Rename canonical domain value     | **breaking**              | see §5 — prefer alias             |

**Widening a permission is a breaking change even though it adds nothing structurally.** It changes who
can see what, which is the highest-consequence class of change in the system. Classifying it as
"additive" because it only adds a value to a list is the mistake that produces leaks.

---

## 3. Deprecation lifecycle

Relationships already carry `lifecycle`. Full path:

```
proposed → implemented → deprecated → retired → removed
```

| State         | Emittable | Traversable | Citable    | Notes                                              |
| ------------- | --------- | ----------- | ---------- | -------------------------------------------------- |
| `proposed`    | no        | no          | no         | declared, not yet built                            |
| `implemented` | yes       | per policy  | per policy | normal                                             |
| `deprecated`  | **no**    | yes         | yes        | existing instances still serve                     |
| `retired`     | no        | no          | no         | instances remain, inert                            |
| `removed`     | no        | no          | no         | instances migrated or deleted; catalog row deleted |

**Deprecation stops new writes without breaking existing reads.** This is what makes evolution safe: a
relationship can be superseded and drained over months rather than cut over in one migration. A row may
not move to `removed` while instances exist — a build gate checks live counts against retired types.

---

## 4. Migration primitives

Four operations, each with dry-run, preflight artifact, bounded batches, invariants, and rollback —
the staged production model already established in `RELATED_TO_REMEDIATION.md`.

**M1 — Relationship retype.** `(a)-[:OLD]->(b)` → `(a)-[:NEW]->(b)`. Requires the target type to exist
in the catalog first. Preserves provenance. **Verify replacement present before retiring the original.**
_Example:_ the 148 `RELATED_TO` → `HAS_PERSONA` — normalizer fixed first, then source replay.

**M2 — Node class migration.** Relabel and remap attributes. Supersession chain, never in-place
mutation, so it is reversible.

**M3 — Entity consolidation.** Merge duplicates identified by `business_identity`. **Never fuzzy-merge
a class with `BusinessKey::None`.** Confidence below threshold → review queue, never auto-merge.
Implemented as supersession, which is what makes the brief's "reversal demonstrated" requirement
satisfiable — the merged-away assertions still exist.

**M4 — Attribute backfill.** Deterministic derivation only (e.g. titles from existing fields). Any
backfill requiring inference is an _ingestion_ task with provenance, not a migration.

### 4.1 The universal safety envelope

Every migration declares: environment, operation id, code commit, dry-run timestamp, expected affected
count, expected tenants, batch size, current counts, expected post-run counts, query-plan assumptions,
rollback command, reconciliation command.

Automatic stop on: count deviation beyond stated tolerance, unexpected tenant, cross-tenant edge
appearance, total decline without approved deletion, duplicate increase, dimension mismatch, index not
used, error-rate breach, credential appearing in logs.

---

## 5. Semantic diff and automatic migration planning

`semantic_diff(manifest_vN, manifest_vN+1)` emits a typed changeset which is mechanically translated
into a migration plan with per-change expected counts derived from a **live count query**, not from an
estimate. The plan is a machine-readable preflight artifact reviewed before execution.

**The planner never executes.** It proposes; a human approves; execution is separately gated. Automatic
migration _planning_ is a productivity win; automatic migration _execution_ against a knowledge graph
of record is how you lose a decade of data to a confident bug.

### 5.1 Prefer aliasing to renaming

The `finance`→`financial` episode is the template. The corpus held 1,583 points as `financial`;
renaming to `finance` would have required re-embedding to settle a naming preference. **Alias the
wrong name, canonicalize on what the data holds, normalize at the boundary.** Renaming stored values
is a last resort reserved for cases where the stored value is actively harmful.

---

## 6. The OWL/TTL question — resolved

`ontology/*.ttl` holds ~110 camelCase `ln:` ObjectProperties. It is runtime-unused; CI only checks the
files exist. It is a **fourth vocabulary** alongside the Rust catalog, the JSON manifest, and the
domain vocabulary.

**Decision: the runtime catalog is authoritative. The TTL is derived, or it is deleted.**

Three options were considered:

| Option                                          | Verdict                                                                                                                                              |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Make OWL authoritative, generate Rust from it   | **Rejected.** Inverts the proven direction of generation, adds a reasoner dependency, and makes the build depend on an artifact no runtime consumes. |
| Keep both, reconcile manually                   | **Rejected.** This is the defect class the whole workstream exists to eliminate. Two hand-maintained vocabularies drift — always.                    |
| **Generate TTL from the catalog, or delete it** | **Chosen.**                                                                                                                                          |

If OWL export has external value — interoperability, standards conformance, enterprise procurement —
it is **generated** from the catalog as one more export target beside the JSON manifest, drift-gated
identically. If it has no consumer, it is deleted, because an unused vocabulary that looks
authoritative is worse than no vocabulary.

_Benefit:_ eliminates the last independent semantic source; satisfies the target invariant that no
emitter may bypass the authoritative catalog.
_Complexity:_ Low (generator) or trivial (deletion).
_Risk:_ Low — nothing consumes it at runtime today.
_Migration:_ add TTL as an export target; drift-gate; delete the hand-maintained file.
_Rollback:_ restore the file from history.
_Enterprise value:_ a standards-conformant OWL export that is _provably_ in sync with the runtime is a
procurement asset. One that is hand-maintained and silently divergent is a liability.

---

## 7. Graph repair

Repair is migration driven by quality metrics rather than by schema change. Sources:
`SEMANTIC_QUALITY_FRAMEWORK.md` §4 — duplicates, contradictions, dangling assertions, orphans, store
divergence.

**Repair is never automatic and never deletes.** Every repair is a proposal with evidence, dry-run
counts, and an approval gate. Unexplained divergence — such as the open 17-tenant Neo4j/Qdrant gap —
must be **explained before it is repaired**. Deleting what you do not understand is not repair; it is
data loss with a changelog entry.

---

## 8. Evaluation

| Metric                         | Gate                                                       |
| ------------------------------ | ---------------------------------------------------------- | ------- |
| Migration idempotency          | second dry run reports 0 affected — **gate**               |
| Migration reversibility        | rollback restores prior counts exactly — **gate**          |
| Drift — catalog vs manifest    | 0 divergence, semantic compare — **gate (exists)**         |
| Drift — manifest vs live graph | live types ⊆ catalog types — **gate**                      |
| Manifest policy fidelity       | exported fields == declared fields — **gate (closes C-2)** |
| Retired-type instances         | 0 live instances of `removed` types — **gate**             |
| Domain vocabulary append-only  | no canonical value removed — **gate**                      |
| Semantic diff accuracy         | predicted vs actual affected counts within tolerance       | ratchet |
