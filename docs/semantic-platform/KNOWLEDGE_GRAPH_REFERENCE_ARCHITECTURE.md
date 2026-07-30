# Knowledge Graph Reference Architecture

**Status:** Designed · **Date:** 2026-07-30 · Parent: `SEMANTIC_PLATFORM_ARCHITECTURE.md`

The implementation-level reference: components, contracts, data flow, and the explainability pipeline.
Covers brief Phases 6 and 7.

---

## 1. Component map

```
INGESTION                      SEMANTIC AUTHORITY              SERVING
┌──────────────────┐          ┌─────────────────────┐        ┌──────────────────────┐
│ ingestion-worker │          │ relationship_       │        │ core-api             │
│  (Rust)          │          │   catalog.rs   ◄────┼── AUTHORITATIVE              │
│                  │          │ ontology.rs         │        │  grounding/semantic/ │
│ normalizer.rs ───┼─emits──► │ domain_vocabulary.rs│        │   planner.py         │
│ relationships.rs │          └──────────┬──────────┘        │   traversal.py       │
│ neo4j_client.rs  │                     │ generates          │   fusion.py          │
│ qdrant_client.rs │                     ▼                    │   engine.py          │
└────────┬─────────┘          ┌─────────────────────┐        │   domains.py         │
         │                    │ ontology_manifest   │──reads─►│                      │
         │                    │ domain_manifest     │        └──────────┬───────────┘
         │                    └─────────────────────┘                   │
         ▼                                                              ▼
   ┌───────────────────────────────────────────┐            ┌──────────────────────┐
   │  Neo4j (personal)  │  Qdrant  │  Postgres │            │  Advisor / Agents    │
   │  2,506n / 3,208e   │  2,218p  │  life.*   │            └──────────────────────┘
   └───────────────────────────────────────────┘
```

**One authority, generated contracts, fail-closed consumers.** This is the architecture's strongest
existing property and every extension must preserve it.

### 1.1 The contract defect (C-2)

The generation arrow carries less than the authority declares. `permitted_contexts` and
`permitted_principals` exist in Rust (150 sites) and are absent from the manifest (0). The serving tier
receives a boolean where the authority declared a policy. **The reference architecture is correct; the
serialization is lossy.** Fixing the serialization — not the architecture — closes it.

---

## 2. Contracts

| Contract                 | Producer        | Consumer            | Versioned | Drift-gated |
| ------------------------ | --------------- | ------------------- | --------- | ----------- |
| `ontology_manifest.json` | Rust catalog    | Python planner      | v2        | ✓           |
| `domain_manifest.json`   | Rust vocabulary | Python `domains.py` | ✓         | ✓           |
| Assertion schema         | writer          | provenance store    | planned   | planned     |
| Policy decision          | policy plane    | retrieval + agents  | planned   | planned     |
| Retrieval trace          | engine          | explainability      | planned   | planned     |

**Rule: every cross-tier contract is a generated, versioned, drift-gated artifact.** Never a shared
convention, never a hand-maintained mirror. Both defects that motivated this workstream — the
hand-written `EDGE_FAMILY` dict and the `"finance"` literal — were hand-maintained mirrors of a
generated truth.

**Manifests live inside the Python package** (`app/grounding/semantic/`) because the Dockerfile is
`COPY app ./app`. A manifest anywhere else is absent from the image and fails in production only. This
is a deployment fact with architectural force and must be preserved for every new contract.

---

## 3. Retrieval pipeline

```
query ─► plan ─► seed ─► traverse ─► fuse ─► rank ─► filter ─► trace
         │       │        │           │       │       │
         │       │        │           │       │       └─ policy: citable? reason-over-able?
         │       │        │           │       └───────── confidence + temporal weighting
         │       │        │           └───────────────── RRF across channels
         │       │        └───────────────────────────── bounded, policy-gated, tenant-anchored
         │       └────────────────────────────────────── vector (Qdrant) + lexical (Neo4j)
         └────────────────────────────────────────────── intent, domains, entities, as_of
```

Each stage is independently flag-gated and independently measured. **No stage may ship without a
golden-set measurement**, which is why the evaluation framework gates the whole pipeline.

### 3.1 Stage contracts

**Plan** — emits intent, canonical domains (normalized, never raw), linked entities, `as_of`, seed
limit, traversal bounds. Domain canonicalization happens here and only here.

**Seed** — vector search filtered by canonical domain + tenant; lexical seeds from Neo4j. Both must
return dict-shaped rows; the Aura positional-row contract mismatch is on record as a silent
zero-result failure and is the reason `query_personal_dicts` exists.

**Traverse** — from tenant-anchored seeds only. Expands along catalog-permitted edges for _this
principal in this context_ (post-C-2). Hard bounds on depth, breadth, node budget. Returns **paths**,
not nodes, so provenance can cite the route.

**Fuse** — RRF across channels. No `None` scores. Channel attribution retained for the trace.

**Rank** — `catalog_weight × relationship_confidence × recency × reinforcement × path_confidence`.

**Filter** — policy: may this be cited, may it influence a recommendation. Below-threshold evidence is
dropped, not passed to the model.

---

## 4. Explainability pipeline (brief Phase 6)

Every advisor answer emits a deterministic trace:

```json
{
  "trace_id": "...", "as_of": "...",
  "versions": {"ontology": 2, "retrieval": "...", "prompt": "...", "policy": "...", "eval": "..."},
  "plan": {"intent": "...", "domains": ["financial"], "entities": [...]},
  "channels": {"vector": {"seeds": 12}, "lexical": {"seeds": 4}, "central": {"hits": 0}},
  "paths": [{"nodes": [...], "edges": [...], "path_confidence": 0.73}],
  "evidence": [{"assertion_id": "...", "confidence": {...}, "citable": true, "source": "..."}],
  "confidence_chain": {"evidence": 0.9, "answer": 0.78, "recommendation": 0.71},
  "policy_decisions": [{"assertion_id": "...", "action": "cite", "verdict": "deny", "reason": "..."}],
  "excluded": [{"assertion_id": "...", "reason": "confidence_below_citation_threshold"}]
}
```

### 4.1 Three properties that make the trace trustworthy

**Determinism.** Identical inputs + pinned versions → identical trace. Enforced by test (I-7).

**Exclusions are recorded.** What was retrieved and _rejected_, with the reason, is as important as
what was used. A trace showing only the winners cannot distinguish "we had no evidence" from "we had
evidence and suppressed it" — and those have opposite remedies.

**The boundary is explicit.** The trace records what the model was **given** and what policy
**allowed**. It never reconstructs why the model produced particular words. The brief's _"Never expose
hidden model reasoning"_ is satisfied by tracing inputs and authorization, not by narrating the model.
Claiming to explain generation would be the fabrication the platform exists to prevent, one level up.

---

## 5. Reasoning strategies (brief Phase 7)

All are traversal strategies over the same catalog — not separate engines
(`SEMANTIC_PLATFORM_ARCHITECTURE.md` §7).

| Strategy                     | Mechanism                                                  | Prerequisite              |
| ---------------------------- | ---------------------------------------------------------- | ------------------------- |
| Path ranking                 | rank by aggregate path confidence × weight                 | traversal live            |
| Causal                       | restrict to `causal_meaning ∈ {causes, enables, prevents}` | `causal_meaning` declared |
| Goal                         | traverse planning+progress families toward `Objective`     | class hierarchy           |
| Constraint                   | constraint edges filter candidates, never form paths       | catalog extension         |
| Hierarchical                 | traverse the class hierarchy                               | class hierarchy           |
| Cross-domain                 | multi-domain seeds, explicit grant                         | policy plane              |
| Dependency                   | forward closure over `requires` semantics                  | catalog extension         |
| Eligibility                  | constraint satisfaction over declared criteria             | catalog extension         |
| Impact ("what changes if")   | hypothetical overlay + diff                                | temporal overlays         |
| Cause ("what caused")        | backward causal closure                                    | `causal_meaning`          |
| Prevention ("what prevents") | `prevents` edges into a goal                               | `causal_meaning`          |
| Gap ("what is missing")      | expected edges per class − present                         | class hierarchy           |
| Conflict ("what conflicts")  | contradictory active assertions                            | `assertion_status`        |

**Every one is measured independently** on the golden set, and every one ships flag-gated. A strategy
that does not improve a measured metric does not ship — the discipline that distinguishes this from
accumulating retrieval features.

Note that most strategies are blocked on **catalog metadata**, not on algorithms. This is the
recurring theme: the leverage is in the vocabulary, not the engine.

---

## 6. Failure semantics

The defining failure mode of this system, twice on record (`domain=finance` → 0 hits;
positional-row `AttributeError` → 0 seeds), is **silent success**: an integrity failure that returns
empty and is indistinguishable from "no data."

Rules:

1. **Zero results from a filter on a non-existent value is an error, not an empty set.** Filtering on
   an unrecognized domain, principal, or relationship type raises; it never returns empty.
2. **Normalize at the boundary, fail loudly on unknown.** `normalize_domain` returning `None` means
   "do not filter" plus a logged warning — never "filter on the raw value."
3. **No fallback vocabularies.** A built-in default that shadows a generated contract recreates the
   original defect. The planner raising when the manifest is unreadable is correct.
4. **Broad exception handlers must classify.** `expected_degradation` vs `integrity_failure` — the
   hop-level `except` that swallowed every row error is the precedent.

---

## 7. Deployment topology

| Service                          | Role                                                                        | Status           |
| -------------------------------- | --------------------------------------------------------------------------- | ---------------- |
| `lifenavigator-core-api`         | authoritative serving tier, owns retrieval + grounding                      | live             |
| `lifenavigator-ingestion-worker` | authoritative writer, owns the catalog                                      | live             |
| `lifenavigator-api-gateway`      | **orphaned-but-live**; holds superior RRF + central retrieval, zero callers | live, no traffic |
| Neo4j Aura (`personal`)          | graph substrate; Query API v2 only                                          | live             |
| Neo4j (`central`)                | no reachable reader                                                         | unknown contents |
| Qdrant `life_navigator`          | 2,218 pts, 3072-dim                                                         | live             |
| Qdrant `ln_central`              | **0 points — empty**                                                        | live, unused     |

**The gateway must be harvested before retirement** — RRF fusion and central retrieval are the best
retrieval code in the repository and exist nowhere else. Retiring it before porting destroys
capability. Retirement requires: 0 traffic evidenced over 7 days, a `410 Gone` shim for one release,
and the replacement live in core-api.
