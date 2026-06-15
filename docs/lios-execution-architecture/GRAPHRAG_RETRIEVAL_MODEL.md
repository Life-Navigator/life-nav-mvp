# LIOS GraphRAG Retrieval Model (Stage [3])

> **Design/spec only.** No code, no Gemini wiring, no runtime, no Vertex, no beta change. This is the
> Stage [3] (Graph Retrieval Plan) contract a future orchestration layer will implement.
> Derived from `docs/lios-agent-specifications/GRAPHRAG_AGENT.md`,
> `docs/lios-agent-specifications/GOAL_CONFLICT_AGENT.md`,
> `docs/lios-agent-specifications/DECISION_SCIENTIST_AGENT.md`,
> `docs/lios-agent-specifications/AGENT_CONFIDENCE_MODEL.md`, `RELATIONSHIP_LIFECYCLE.md`,
> `ORCHESTRATION_ENGINE.md`, `EXECUTION_ARCHITECTURE.md`.

GraphRAG is the **retrieval authority** and the citation contract's source of truth: **no cited edge ⇒
no claim.** This doc says _when_ the Orchestrator queries it, _when_ it skips it, _when_ relationship
evidence is REQUIRED, and _when_ missing evidence BLOCKS a CLAIM (never the turn).

---

## 1. Principle: retrieve only when a claim will rest on a relationship

GraphRAG reads the user's REAL graph across the 3-store (Neo4j edges + Qdrant vectors + Supabase facts),
read-only and tenant-scoped, with provenance on every item. It never invents, never persists, never
decides. The Orchestrator queries it by **deterministic rule** (Stage [3]), not by LLM intuition. A
single-fact lookup that asserts no relationship needs no graph read; a cross-domain or goal-to-goal claim
cannot be made without one.

The cardinal failure mode this model prevents: an agent narrating "your house goal conflicts with
retirement" when **no real edge backs it**. Under this model that _claim_ is dropped (the agent abstains
on the relationship); the _turn_ continues with single-entity reasoning.

---

## 2. The decision: query, skip, require, or block

```
                       Stage [2] route plan
                              │
                  ┌───────────┴────────────┐
            relationship/evidence       single-fact lookup
            or cross-domain claim       (e.g. "what's my net worth")
              possible?                          │
                   │ yes                         │ no relationship asserted
                   ▼                             ▼
            [QUERY GraphRAG] ............... [SKIP GraphRAG]  → graph_required=false
                   │                             (Tool Plan answers the single fact)
        ┌──────────┼─────────────┐
   edges returned   empty graph    store unreachable
        │                │              │
        ▼                ▼              ▼
   claim may cite     [BLOCK the     GraphRAG → `blocked`
   the edge(s);       CLAIM] —       (Stage [3] failure: that
   GC feeds conf.     abstain on     branch degrades; det. floor
        │             the relation;  still answers — never the user)
        ▼             turn continues
   goal-to-goal /     single-entity
   cross-domain       (no relation
   claim is REQUIRED  claim at all)
   to cite a real
   edge (else dropped)
```

`graph_required` is the boolean Stage [2] writes into the route plan (see `ORCHESTRATION_ENGINE.md` §8).

---

## 3. When GraphRAG is QUERIED (deterministic triggers)

Query IFF any holds (from `ORCHESTRATION_ENGINE.md` §3: "GraphRAG runs IFF the plan needs
relationships/evidence"):

- the plan needs **relationships** between two of the user's entities (goal↔goal, evidence→source);
- the plan needs **evidence** to back a recommendation (Recommendation Agent will cite it);
- a **cross-domain claim is possible** (Decision Scientist mapping which domains a decision touches —
  cross-domain relevance "rests on cited real edges", DECISION_SCIENTIST §10);
- the **Goal Conflict** path runs (a conflict _is_ a cited edge — its citation gate `_check_relationships`
  needs the edge);
- the Decision pipeline runs (≥2 domains, or intent=decision) and a domain link must be justified.

## 4. When GraphRAG is SKIPPED

Skip (graph_required=false) when the answer asserts **no relationship**:

- a **simple single-fact lookup** — "what's my net worth", "what's my 401k balance", "list my goals".
  The number/fact comes from Tool Execution (Stage [4]) or Memory; no edge is claimed, so no read.
- a pure conversational/discovery turn using **generic** language ("how this connects to your broader
  vision") — per `RELATIONSHIP_LIFECYCLE.md` §1 this is **not** a relationship claim, so no edge required.
- any turn where the deterministic floor already produced the safe answer and no relationship is asserted.

Skipping is a positive choice: "silence is cheaper than a no-op call" (`ORCHESTRATION_ENGINE.md` §3).

## 5. When relationship evidence is REQUIRED (the citation contract)

A **real cited edge is REQUIRED before any goal-to-goal claim** and before any cross-domain link
(`RELATIONSHIP_LIFECYCLE.md` §1; GOAL_CONFLICT §3; DECISION_SCIENTIST §8). Precisely:

- two-entity / mutual phrasing about the user's own goals ⇒ a claim ⇒ requires a real edge;
- a single-target phrase naming ≥2 of the user's goals ⇒ a claim ⇒ requires a real edge;
- a cross-domain decision link ("this housing choice affects retirement") ⇒ requires a cited edge.

If the required edge exists, the claim cites the exact pair (with provenance) and the edge's
`edge_confidence` flows into the asserting agent's **GC** component (`AGENT_CONFIDENCE_MODEL.md` §1).

## 6. When missing evidence BLOCKS a CLAIM (not the turn)

This is the load-bearing distinction:

| Situation                                 | Effect on the CLAIM                                  | Effect on the TURN                                  |
| ----------------------------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| Edge exists, retrieved, cited             | claim allowed; GC = `edge_confidence`                | continues normally                                  |
| Edge missing for this pair                | **claim dropped** — agent abstains on the relation   | continues with single-entity reasoning              |
| Empty graph (no edges at all)             | **no relationship claims permitted, full stop**      | continues; advisor abstains (GraphRAG `needs_data`) |
| Pair has only a `proposed` (uncited) edge | claim dropped (only `projected`/`cited` are citable) | continues single-entity                             |
| Store unreachable / 3-store drift         | GraphRAG `blocked` — serve no edges as truth         | that branch degrades; deterministic floor answers   |

"Missing edge ⇒ the CLAIM is dropped (abstain), the turn continues" — GraphRAG returns empty and the
asserting agent (Goal Conflict, Decision Scientist, Advisor) **stays single-entity**. The turn never fails
the user; the deterministic floor (Stage [0]) guarantees a safe response (`EXECUTION_ARCHITECTURE.md` §3).
Only an unreachable store or a 3-store **integrity** failure yields `blocked` — and even then the branch
degrades, the floor still answers (GRAPHRAG_AGENT §11–12).

---

## 7. 3-store alignment, read-only, tenant-scoped, provenance

- **3-store alignment** (Supabase = Neo4j = Qdrant): a relationship is valid only if all three agree
  (`RELATIONSHIP_LIFECYCLE.md` §5). If counts diverge, GraphRAG `blocked` + flag — **never serve possibly
  stale edges as truth** (GRAPHRAG_AGENT §11).
- **Read-only:** GraphRAG never creates/persists/infers an edge. Projection from committed truth is a
  separate worker sync, not this stage (`RELATIONSHIP_LIFECYCLE.md` §4 invariant: citable only by
  projection).
- **Tenant-scoped:** every store query is bound to the JWT `user_id` (RLS / tenant filter); cross-tenant
  retrieval is forbidden (GRAPHRAG_AGENT §3).
- **Provenance on every edge:** every edge resolves to real nodes and carries `source_table` +
  `edge_confidence`; every evidence item carries `source_table` + `similarity`. No provenance ⇒ rejected,
  because it would break the citation contract.
- **`edge_confidence` feeds GC:** the asserting agent's Graph-confidence component = mean of cited
  `edge_confidence`. GC is N/A (renormalize) when no graph claim is made; GC counts only when a claim
  cites an edge (`AGENT_CONFIDENCE_MODEL.md` §1, invariant 5).

---

## 8. Stage [3] contract (inputs / outputs / confidence / failure / observability)

| Field             | Contract                                                                                                                                                                                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inputs**        | the Stage [2] route plan (selected agents, intent, `graph_required`); the typed retrieval request (focus node(s)/query); the authenticated `UserContext` (JWT `user_id`) for tenant scoping                                                                                               |
| **Outputs**       | the GraphRAG payload: `edges[]` (from/to/rel/edge_confidence/source_table), `connections[]`, `connected_pairs[]`, `evidence[]` (statement/source_table/similarity). No edges ⇒ all arrays empty. (GRAPHRAG_AGENT §5)                                                                      |
| **Confidence**    | global formula with GraphRAG weights: `renormalize(0.40·GC + 0.30·EC + 0.20·PQ + 0.10·DC)`, TA dropped (N/A), GC dropped when vectors-only. No `success` < 0.75. The retrieved `edge_confidence` becomes the GC the _downstream_ asserting agent uses                                     |
| **Failure**       | empty graph → `needs_data` (advisor abstains, no synthesized edge); store unreachable or 3-store drift → `blocked` + flag (no stale edges as truth); item missing `source_table` → `compliance_rejected`. Failure degrades the _branch_, never the turn — the deterministic floor answers |
| **Observability** | emits `graph_plan` (Stage [3] event). Planned: persist the per-turn retrieval set (node/edge/doc ids used) so "which edges were cited" is auditable (`RELATIONSHIP_LIFECYCLE.md` §7, §11)                                                                                                 |

---

## 9. Invariants

1. No cited edge ⇒ no claim — enforced at the source (GraphRAG returns empty ⇒ no downstream relation claim).
2. Query when a relationship/evidence/cross-domain claim is possible; **skip** single-fact lookups.
3. A goal-to-goal or cross-domain claim **requires** a real cited edge before it may be asserted.
4. Missing edge ⇒ the **claim** is dropped (abstain); the **turn** continues single-entity. Only an
   unreachable store / integrity failure → `blocked`, and even then the floor answers.
5. Empty graph ⇒ zero relationship claims; read-only; tenant-scoped; provenance on every item.
6. `edge_confidence` feeds the asserting agent's GC; GC is N/A (renormalize) when no edge is cited.
7. 3-store divergence blocks rather than serving stale edges as truth — the system models, never guesses.
