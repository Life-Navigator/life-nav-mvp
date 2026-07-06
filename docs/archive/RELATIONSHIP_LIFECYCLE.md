# LIOS — Relationship Lifecycle

> The complete lifecycle of a **relationship** (a graph edge between two of the user's entities — goals,
> objectives, evidence, documents, accounts) in LifeNavigator: creation, projection, validation, citation,
> decay, removal. Validation review against the LIOS architecture. Architecture review only — no code, no
> prompts.

A "relationship" = a real edge in the user's personal graph (Neo4j), projected from relational truth and
carrying provenance to its source. It is the substrate the advisor reasons over when it connects two goals,
links evidence to a recommendation, or frames a cross-domain tradeoff.

---

## 1. The citation contract (live, enforced — the heart of this lifecycle)

> **No cited edge ⇒ no claim.** An agent may assert a relationship between two of the user's goals/
> objectives only if that exact pair is a real edge in the graph, and it must cite the pair in
> `relationships_referenced`. If the graph has no edges, no relationship may be claimed.

Precision (so the gate isn't blunt): generic discovery language ("how this connects to your broader vision/
goals") is **not** a relationship claim and is allowed; a specific **goal-to-goal** link is a claim and
requires a real edge. Compliance distinguishes them (two-entity/mutual phrasing, or a single-target phrase
naming ≥2 of the user's own goals, counts as a claim). This is live in the validator.

---

## 2. Edge taxonomy

| Edge kind             | Example                                           | Source                                    |
| --------------------- | ------------------------------------------------- | ----------------------------------------- |
| goal ↔ goal           | retirement ↔ education-funding (tradeoff/support) | derived from goals + reasoning, confirmed |
| evidence → source     | recommendation `evidenced_by` a document field    | RecommendationOS + Document Intelligence  |
| fact → document       | a value extracted `from_source` a statement       | Document Intelligence                     |
| entity → domain hub   | a goal belongs to the finance domain              | deterministic                             |
| account/member → user | a Plaid account, a family member                  | domain writers                            |

Each edge carries: endpoints (with known node ids), `rel` (type), `confidence`, and provenance back to the
relational row/document that justifies it.

---

## 3. States

| State        | Meaning                                                               | Citable?    |
| ------------ | --------------------------------------------------------------------- | ----------- |
| `proposed`   | a candidate relationship (e.g. LLM suggests two goals relate)         | no          |
| `validated`  | endpoints are known real nodes; not to unknown nodes                  | —           |
| `projected`  | written to Neo4j (+ vector context in Qdrant) from a committed source | **yes**     |
| `cited`      | referenced by an agent in a response (with provenance)                | yes         |
| `stale`      | source evidence aged                                                  | re-validate |
| `superseded` | replaced by an updated edge                                           | history     |
| `removed`    | source deleted / relationship no longer holds                         | no          |

---

## 4. State transitions

```
 (fact/doc/goal committed) ─▶ projected ─▶ (available to GraphRAG) ─▶ cited (in a response)
                                  │                                       │ source changes
 LLM suggests a link ─▶ proposed ─▶ validated ─(endpoints real?)─▶ projected   ▼
        │ endpoints unknown / no support              │ no                    stale → re-validate
        ▼                                             ▼                          │ source removed
     DROPPED (citation contract: not claimable)    DROPPED                       ▼
                                                                              removed
```

| Transition                     | Trigger                     | Owning agent            | Guard                                      |
| ------------------------------ | --------------------------- | ----------------------- | ------------------------------------------ |
| → `proposed`                   | LLM suggests a relationship | Advisor / Goal Conflict | must be cited if asserted                  |
| `proposed` → `validated`       | check endpoints             | Compliance + GraphRAG   | both endpoints are real nodes; not unknown |
| committed source → `projected` | sync after relational write | GraphRAG sync (worker)  | a committed source row/doc exists          |
| `projected` → `cited`          | agent references it         | Advisor / domain        | cite the exact pair; provenance attached   |
| `proposed` → `DROPPED`         | no real edge                | Compliance              | citation contract                          |
| `projected` → `stale`          | evidence ages               | freshness rule          | time-based                                 |
| source removed → `removed`     | delete/retire               | GraphRAG sync           | source gone                                |

**Invariant:** an edge becomes **citable only by projection from committed truth**, never by an LLM
asserting it. The LLM can _propose_ and (if a real edge exists) _cite_ — it can never _create_ the edge.

---

## 5. The three-store alignment

Relationships live in Neo4j but must stay aligned with Supabase (truth) and Qdrant (vectors):

- Supabase row/document is the source of truth and provenance.
- Neo4j holds the edge (projected, with a pointer back).
- Qdrant holds vector context for retrieval.
- A relationship is only valid if all three agree; the worker's sync keeps them aligned, and an edge to an
  unknown node is dropped (never half-projected).

---

## 6. Conflicts, decay, removal

- **Stale evidence:** an edge whose justifying evidence aged is marked stale and re-validated before it's
  cited again.
- **Contradiction:** if new truth removes the basis for an edge (e.g. a goal is rejected), the edge is
  removed; any recommendation that cited it must re-evaluate.
- **Removal cascade:** deleting a source (document/account/goal) removes its projected edges; cited claims
  that depended on them are no longer assertable.

---

## 7. Observability

- Each cited relationship records the exact pair + provenance on the turn (planned: persist the retrieval
  set — node/edge ids — per turn).
- The GraphRAG validation work tracks 3-store alignment and graph-integrity (e.g. family domain validated at
  a measured %); LIOS keeps integrity as a first-class, measured property.

---

## 8. Invariants (relationship-specific)

1. No relationship claim without a real, cited edge (citation contract).
2. An edge is citable only after projection from committed truth.
3. No edge to an unknown node; no half-projected edge (3-store alignment).
4. Generic "connects to your vision" language is not a claim; a goal-to-goal link is.
5. Removing a source removes its edges; dependent claims re-evaluate.
6. Every edge carries endpoints + type + confidence + provenance.

---

## 9. Failure / escalation

| Failure                                   | Handling                                      |
| ----------------------------------------- | --------------------------------------------- |
| LLM asserts an uncited/false relationship | Compliance rejects → fallback                 |
| Graph empty                               | advisor abstains from all relationship claims |
| Edge to unknown node                      | dropped in projection                         |
| 3-store drift                             | sync reconciles; integrity metric flags it    |
| Source removed                            | edge removed; dependent recs re-evaluate      |

---

## 10. Validation review

| Requirement                              | Today                                                          | Verdict / gap                                                     |
| ---------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| Citation contract                        | live (validator `_check_relationships`, precise carve-outs)    | ✅ holds (eval: 0 ungrounded relationship claims)                 |
| Edge only from committed truth           | live (worker projection)                                       | ✅ holds                                                          |
| No edge to unknown node                  | live (drops edges to unknown nodes)                            | ✅ holds                                                          |
| 3-store alignment                        | live (worker; integrity engine)                                | ✅ holds, measured                                                |
| Grounded-citation path exercised in eval | partial (fresh users have no edges → only abstain path tested) | ⚠️ **gap: a seeded-graph persona to assert a real edge is cited** |
| Per-turn retrieval-set logging           | partial                                                        | ⚠️ **gap: persist node/edge/doc ids used per turn**               |
| Edge freshness / decay                   | partial                                                        | ⚠️ **gap: per-edge freshness + re-validation cadence**            |
| Removal cascade                          | partial                                                        | ⚠️ **gap: formal cascade when a source is deleted/rejected**      |

**Open questions:**

1. Which edge types decay (evidence-derived) vs. are permanent (member-of-family)?
2. How are inferred edges (vs. user-confirmed) labeled and confidence-weighted for citation?
3. Should the advisor be allowed to cite evidence→source edges (not just goal↔goal) to justify a claim?

---

## 11. Live vs planned

- **Live:** citation contract + precise carve-outs; projection-from-truth; no-unknown-node; 3-store
  alignment + integrity measurement.
- **Planned:** seeded-graph eval persona; per-turn retrieval-set logging; per-edge freshness; formal removal
  cascade; inferred-vs-confirmed edge labeling.
