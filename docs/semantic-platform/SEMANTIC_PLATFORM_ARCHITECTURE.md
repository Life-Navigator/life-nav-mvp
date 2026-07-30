# Semantic Platform Architecture

**Status:** Designed · **Date:** 2026-07-30 · **Commit:** `da8c7428`
**Anchor document.** Every other document in `docs/semantic-platform/` refines a layer named here.

---

## 0. Evidence reconciliation — read this before the design

The brief instructs: _"Assume the current implementation has already reached the following baseline… Do
not redesign these foundations unless measurable evidence demonstrates they are incorrect."_

Measurement was taken against production on 2026-07-30 (`artifacts/graphrag-reconciliation/production_baseline.json`).
Most of the stated baseline holds. **Four items do not**, and the brief's own evidentiary standard
requires saying so rather than designing on top of them.

| Stated baseline                         | Measured reality                                                                | Verdict                                |
| --------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------- |
| Unified runtime relationship catalog    | `relationship_catalog.rs` exists, covers every emitter, fails closed            | **HOLDS**                              |
| Generated ontology manifest             | `ontology_manifest.json` v2, 147 relationships, drift-gated                     | **HOLDS**                              |
| Drift-gated relationship definitions    | 4 gates in CI                                                                   | **HOLDS**                              |
| Production graph, Neo4j, Qdrant         | Live: 2,506 nodes / 3,208 edges / 2,218 vectors                                 | **HOLDS — at 0.0025% of target scale** |
| Vector retrieval                        | Live, 3072-dim, correct model                                                   | **HOLDS**                              |
| Explicit traversal policies             | Declared in Rust; **flattened to one boolean at the export boundary**           | **PARTIAL**                            |
| Graph traversal                         | Code path exists; `GRAPH_GROUNDING_ENABLED=false`, never run against production | **UNPROVEN**                           |
| Retrieval evaluation framework underway | Builder script exists; `golden.json` **does not exist**                         | **NOT STARTED**                        |
| Ontology-aware planner                  | Exists and loads the manifest                                                   | **HOLDS**                              |

### The four corrections

**C-1 — Traversal is unproven, not established.** The engine's traversal path was only recently made
capable of running at all (the Aura positional-row defect). It has never executed against production
with the flag on. Designing Phases 7 and 13 as extensions of "working traversal" would inherit an
unverified assumption into a decade-long substrate. _Traversal is treated here as **Implemented,
not Live-store tested**._

**C-2 — The relationship catalog's authorization model does not survive export.** This is the most
consequential finding for the multi-agent objective. `relationship_catalog.rs` declares
`permitted_contexts` and `permitted_principals` in **150 places**, with the explicit design statement
that _"traversability is a per-context policy, not a Boolean."_ The exported
`ontology_manifest.json` contains **zero** occurrences of either field. The Python planner — the tier
that actually serves retrieval — reads a single `traversable: bool` meaning _personal-advisor-traversable_.

The Rust side is correct and fails closed. The **export contract is lossy.** Consequence: the Python
tier is structurally incapable of expressing "the compliance agent may traverse this, the personal
advisor may not." Phase 10 of the brief requires exactly that. **This is the single highest-leverage
correction in the entire program**, and it is a manifest-schema change, not a rewrite.

**C-3 — Provenance is absent at the relationship level.** Production carries 3,208 relationships;
**zero carry any property at all** — no `created_at`, no source id, no extractor, no confidence, no
ontology version. The brief's Guiding Principles demand every graph object answer _"Who created me?
When? Why? From what evidence? With what confidence? Using which ontology version?"_ Today, for
relationships, **every one of those answers is unavailable**. Phase 2 is therefore not an enhancement
layer over existing provenance — it is net-new construction.

Additionally, **no relationship carries `tenant_id`** (0 of 3,208). Tenant safety rests entirely on
node properties. Any traversal-level isolation guarantee must be enforced in Cypher against node
properties; there is no edge-level guard to fall back on.

**C-4 — The scale gap is four orders of magnitude.** Phase 12 specifies 100M nodes / 1B relationships.
Production holds 2,506 / 3,208 — a **~40,000×** node gap and **~312,000×** edge gap. This does not
invalidate designing for scale, but it does invalidate _optimizing_ for it now. Designs below are
required to be **scale-compatible** (no choice that forecloses partitioning) without being
**scale-premature** (no sharding infrastructure for 2,506 nodes). Every scalability recommendation
states its trigger threshold rather than a build date.

### One challenged assumption the brief did not list

`ln_central` — the central knowledge collection — is **empty (0 points)**, and the `central` Neo4j
database has no reader outside an orphaned service. The "central knowledge layer" is a capability
claim with no content behind it. Any design that treats shared/collective knowledge as an existing
substrate to build on is designing on a void. It is modelled below as **greenfield**.

---

## 1. What the platform is

> A governed semantic knowledge platform providing explainable, ontology-driven, provenance-aware,
> temporally consistent, confidence-aware knowledge services for autonomous AI systems.

The distinction from a GraphRAG application is not size or feature count. It is **that every assertion
in the graph carries enough metadata to be independently adjudicated** — trusted, cited, traversed,
reasoned over, expired, deleted, or reconstructed — _without consulting the code that produced it._

A GraphRAG application asks: _what did we retrieve?_
A semantic operating system asks: _by what authority does this assertion participate in this answer,
for this principal, at this point in time, at this confidence?_

That question is answerable only if the metadata exists on the object. Today it does not (C-3). This
is the architecture's central task.

---

## 2. The layer model

```
┌─────────────────────────────────────────────────────────────────┐
│ L7  Agent Plane        planner · retrieval · compliance · domain │  MULTI_AGENT_SEMANTIC_ARCHITECTURE
├─────────────────────────────────────────────────────────────────┤
│ L6  Reasoning Plane    paths · causal · goal · constraint        │  (this doc §7)
├─────────────────────────────────────────────────────────────────┤
│ L5  Retrieval Plane    plan · seed · traverse · fuse · rank      │  existing semantic/
├─────────────────────────────────────────────────────────────────┤
│ L4  Policy Plane       traversal · citation · reasoning · access │  SEMANTIC_GOVERNANCE
├─────────────────────────────────────────────────────────────────┤
│ L3  Semantic Plane     ontology · catalog · manifest · versions  │  SEMANTIC_DATA_MODEL
├─────────────────────────────────────────────────────────────────┤
│ L2  Assertion Plane    nodes · edges · confidence · time         │  CONFIDENCE / TEMPORAL model
├─────────────────────────────────────────────────────────────────┤
│ L1  Provenance Plane   document → chunk → extraction → assertion │  PROVENANCE_MODEL
├─────────────────────────────────────────────────────────────────┤
│ L0  Substrate          Neo4j · Qdrant · Postgres · object store  │  ENTERPRISE_SCALABILITY_PLAN
└─────────────────────────────────────────────────────────────────┘
```

**The load-bearing inversion.** In the current system, provenance (L1) is the _thinnest_ layer and
retrieval (L5) the thickest. In a semantic operating system this is inverted: L1 and L4 are the
foundation everything else derives authority from. An assertion whose provenance is unknown cannot be
governed, cannot be cited, cannot be safely reasoned over, and cannot be deleted on request. **Every
capability in Phases 6–14 of the brief is downstream of L1 and L4 existing.**

This is why the roadmap sequences provenance and policy _before_ reasoning and multi-agent work, even
though the latter are more visible.

---

## 3. The assertion — the platform's atomic unit

Today the atom is a node or an edge. In the target model the atom is an **assertion**: a claim that
some relationship or attribute holds, together with everything needed to adjudicate it.

An assertion answers all thirteen Guiding Principle questions. Where an answer is unavailable, it says
so **explicitly** rather than omitting the field — an absent field is indistinguishable from an
unasked question, and that ambiguity is what makes today's graph un-auditable.

| Principle question               | Carried by                                     | Today                     |
| -------------------------------- | ---------------------------------------------- | ------------------------- |
| Who created me?                  | `asserted_by` (agent/pipeline/human principal) | ✗                         |
| When?                            | `created_at`, `observed_at`                    | node-only                 |
| Why?                             | `assertion_reason` + originating intent        | ✗                         |
| From what evidence?              | `derived_from[]` → provenance chain (L1)       | ✗                         |
| With what confidence?            | `confidence` vector, never a scalar (L2)       | ✗                         |
| Which ontology version?          | `ontology_version`                             | ✗                         |
| Under which tenant?              | `tenant_id`                                    | node-only (0/3,208 edges) |
| Through which pipeline?          | `pipeline_id` + `pipeline_version`             | ✗                         |
| Can I be trusted?                | derived: confidence × provenance completeness  | ✗                         |
| Can I be cited?                  | `citation_policy` from catalog                 | partial (catalog)         |
| Can I be traversed?              | `permitted_contexts` per principal (L4)        | **lossy (C-2)**           |
| Can I influence recommendations? | `reasoning_policy`                             | ✗                         |
| Can I be deleted?                | `retention_class` + cascade rules              | ✗                         |
| Can I be reconstructed?          | provenance chain replay (L1)                   | ✗                         |

**Two of fourteen are answerable today.** That gap is the honest measure of the distance to
"enterprise semantic platform," and it is a _metadata_ gap, not an algorithmic one — which is good
news: it is additive, migratable, and testable.

---

## 4. Design invariants

These are the rules every subsequent document and every implementation must preserve. They are chosen
to be _checkable_ — each maps to a CI gate or a live reconciliation query.

| #    | Invariant                                                                             | Enforcement                             |
| ---- | ------------------------------------------------------------------------------------- | --------------------------------------- |
| I-1  | No executable path may emit a relationship absent from the authoritative catalog      | Rust CI gate (**exists**)               |
| I-2  | An undeclared relationship is refused, never defaulted                                | `spec_for → None` = refuse (**exists**) |
| I-3  | The exported manifest must carry **every** policy field the catalog declares          | **new gate — closes C-2**               |
| I-4  | No assertion without attributable origin, unless explicitly classified `synthetic`    | **new**                                 |
| I-5  | Traversal must never cross `tenant_id`; enforced at node level                        | property test                           |
| I-6  | Confidence is never collapsed to a scalar in storage                                  | schema gate                             |
| I-7  | Every answer is reproducible from its trace + ontology version + retrieval version    | replay test                             |
| I-8  | Deletion of a source cascades to every assertion derived from it                      | provenance cascade test                 |
| I-9  | Policy is data (catalog), never code branching on relationship names                  | grep gate                               |
| I-10 | Ontology version is pinned per answer; upgrades never retroactively alter past traces | immutability test                       |

**I-9 deserves emphasis.** The failure that produced this workstream — a hand-written `EDGE_FAMILY`
dict, a `match` that could not be enumerated, a `"finance"` string literal — was in every case _policy
encoded as code_. Code cannot be enumerated, diffed, versioned, or audited. Data can. Every place the
platform is tempted to branch on a relationship name is a place a catalog row belongs.

---

## 5. Component architecture

### 5.1 Authoritative catalog (Rust, `relationship_catalog.rs`) — **keep, extend**

Correct today. Extend each row with: `citation_policy`, `reasoning_policy`, `evidence_requirement`,
`temporal_behavior`, `merge_policy`, `conflict_resolution`, `retirement_policy`, `privacy_class`.
See `SEMANTIC_DATA_MODEL.md` §3.

### 5.2 Manifest export — **fix (C-2), highest priority**

Export the full policy surface. Versioned schema, additive-only within a major version. The Python
planner replaces its boolean read with a principal-scoped `is_traversable_in(rel, context, principal)`
mirroring the Rust predicate. Same fail-closed semantics on both sides.

_Benefit:_ unblocks all governance and multi-agent work.
_Complexity:_ Low — schema + generator + planner read path.
_Risk:_ Low — additive; the existing boolean can be derived for one release.
_Migration:_ dual-emit both shapes, cut over, drop boolean.
_Rollback:_ revert planner to boolean read; manifest superset remains valid.

### 5.3 Provenance store (new, L1) — see `PROVENANCE_MODEL.md`

### 5.4 Policy decision point (new, L4)

A single evaluator answering _"may principal P, in context C, at time T, traverse/cite/reason-over
assertion A?"_ One implementation, consulted by retrieval, reasoning, and every agent. Not duplicated
per tier — the auth-duplication defect already on record (two `verify_jwt` implementations) is the
precedent to avoid.

### 5.5 Retrieval plane — **keep**

`planner.py` / `traversal.py` / `fusion.py` / `engine.py` are structurally sound. They gain: policy
consultation, trace emission, temporal filtering, confidence propagation.

---

## 6. What we deliberately do **not** build

Enterprise architecture is as much refusal as construction. Each of these is a defensible omission with
a stated re-entry trigger.

| Not building                            | Why                                                                                                      | Re-entry trigger                           |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Graph sharding / partitioning           | 2,506 nodes; adds failure modes, buys nothing                                                            | > 10M nodes or p95 traversal > budget      |
| Custom inference/rules engine           | Ontology-driven traversal covers current reasoning; a rules engine is a second semantics to keep in sync | proven need after Phase 7 measurement      |
| Real-time streaming ingestion           | Queue-based batch is sufficient and simpler to make provenance-complete                                  | sub-minute freshness requirement           |
| Multi-model embedding routing           | One 3072-dim model; multiple models fragment the vector space                                            | second embedding model with measured win   |
| Full OWL reasoner over `ontology/*.ttl` | The TTL files are a disconnected fourth vocabulary with 110 unused properties                            | see `GRAPH_EVOLUTION_STRATEGY.md` §6       |
| Collective/cross-tenant knowledge       | `ln_central` empty; cross-tenant sharing is the highest-risk feature possible pre-governance             | after L4 policy plane is Live-store tested |

---

## 7. Reasoning plane (L6) — architectural position

Phase 7 of the brief lists causal, goal, constraint, hierarchical, and impact reasoning. These are
**not separate engines**. They are traversal strategies over a graph whose edges carry enough semantics
to distinguish them — which is precisely what `EdgeFamily` plus the extended catalog provides.

- _Causal_ — traversal restricted to edges whose `causal_meaning` is `causes` / `enables` / `prevents`
- _Goal_ — traversal over `planning` + `progress` families toward a goal node
- _Constraint_ — edges with `constraint` semantics act as filters, not paths
- _Impact ("what changes if…")_ — forward closure from a hypothetical assertion, bounded
- _Missing ("what is missing…")_ — ontology coverage diff: expected edges per entity class vs present

**This is the argument for investing in the catalog rather than in engines.** Five reasoning
capabilities fall out of one well-specified edge vocabulary. Building five engines over a thin
vocabulary would produce five things to keep in sync — the `EDGE_FAMILY` failure, five times over.

Each strategy must be independently measurable (`SEMANTIC_QUALITY_FRAMEWORK.md` §5) and independently
flag-gated. **No reasoning strategy ships before the Phase 4 retrieval baseline exists**, because
without it, improvement claims are unfalsifiable — the failure mode already on record.

---

## 8. Sequencing rationale

The brief's phase order is a capability taxonomy, not a build order. Dependency-correct order:

```
   C-2 manifest fidelity ──┐
   L1 provenance ──────────┼──> L4 policy ──> multi-agent (Ph10) ──> autonomy (Ph14)
   temporal + confidence ──┘         │
                                     └──> explainability (Ph6) ──> governance (Ph9)
   retrieval baseline (Ph11) ──> reasoning (Ph7) ──> quality dashboard (Ph5)
```

**Retrieval evaluation is on the critical path and has not started.** `golden.json` does not exist.
Until it does, every claim in Phases 5, 7, 11, and 12 is unmeasurable. It is the cheapest unblock in
the program and gates the most.

Full sequencing with effort and gates: `SEMANTIC_PLATFORM_ROADMAP.md`.
Itemized work with the nine required fields per item: `SEMANTIC_PLATFORM_BACKLOG.md`.

---

## 9. Honest status

| Layer                           | Highest achieved status                        |
| ------------------------------- | ---------------------------------------------- |
| L3 Semantic (catalog, manifest) | **Live-store tested**                          |
| L5 Retrieval — vector           | **Live-store tested**                          |
| L5 Retrieval — traversal        | **Implemented** (never run against production) |
| L0 Substrate                    | **Operationally observed**                     |
| L1 Provenance                   | **Designed**                                   |
| L2 Confidence / Temporal        | **Designed**                                   |
| L4 Policy                       | **Designed**                                   |
| L6 Reasoning                    | **Designed**                                   |
| L7 Agent plane                  | **Designed**                                   |

Nothing in this document is Implemented. It is an architecture, and it says so.
