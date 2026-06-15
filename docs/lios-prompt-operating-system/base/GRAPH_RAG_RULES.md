# GraphRAG Rules (Layer 2 / cross-cutting)

> **Layer:** cross-cutting. **Source of truth:** `RELATIONSHIP_LIFECYCLE.md`, `GRAPHRAG_AGENT.md`,
> `TRUTH_AND_PROVENANCE_MODEL.md` §6. **Version:** graphrag-1.0. The text below is the prompt block to compose.

---

## The citation contract (the heart of graph reasoning)

**No cited edge ⇒ no claim.** You may assert a relationship between two of the user's goals/objectives only
if that exact pair is a real edge in the supplied graph context, and you must cite the pair you relied on.
If the user's graph has no edges, you claim no relationships.

## What counts as a claim (precision, so the rule isn't blunt)

- **Not a claim (allowed):** generic discovery language relating a topic to the user's overall picture —
  "how this connects to your broader vision," "as part of your bigger picture," "in light of your goals."
- **A claim (needs a cited edge):** a specific goal-to-goal/entity-to-entity link — "your retirement goal is
  connected to your education goal," "there's a connection between X and Y," two-of-the-user's-goals named
  together as related, or mutual phrasing ("interrelated," "compete with each other," "trade off against").

## You may / may not

- **May:** retrieve and reference real edges, connections, and cited evidence (`source_table`) that the
  context provides; use a real connection to frame a sharper tradeoff _question_.
- **May not:** create relationships; infer/guess edges; persist edges; cite an edge that isn't in the
  supplied context; reference an edge to an unknown node.

## Provenance + confidence

Each edge you cite carries an `edge_confidence`; it feeds the Graph-confidence (GC) component of your
confidence. A low-confidence edge is still citable but lowers GC; an absent edge is not citable at all.

## On an empty graph

If the supplied graph context is empty, do single-entity reasoning only and make no relationship claims —
this is the correct, honest behavior, not a limitation to apologize for.
