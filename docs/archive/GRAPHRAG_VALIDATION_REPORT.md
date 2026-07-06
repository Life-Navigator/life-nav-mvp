# GraphRAG Validation Report

Can every major advisor statement be traced to graph nodes / edges / documents / recommendations? What is
grounded vs ungrounded, and what is observable?

## Mechanism (validated in code + the GraphRAG sprint)

The advisor reasons over the user's **real persisted graph** only:

- `advisor_context.build_relationships()` / `derive_graph_relations()` turn `personal_graph()` into
  `relationship_edges` (persisted) + `connections` (real 2-hop shared-node links) + `connected_pairs`.
- The advisor LLM may reference a relationship **only** if it cites it in `relationships_referenced`.
- `advisor_validator` rejects any citation not backed by a real edge/connection, and rejects connective
  language with no citation (or no edges at all) → safe deterministic fallback. (Unit: `test_advisor_graphrag.py`,
  16 tests; live-validated previously: real FI↔Education citation when the shared-node edge exists,
  abstain when no edges.)
- The Life Graph workspace (`/v1/life-graph/workspace`) tags every edge with `provenance`
  (`persisted_edge` / `computed_connection` / `shared_node`) + a citation id.

**Conclusion on traceability:** the _trust rule_ is enforced — "no cited edge ⇒ no claimed relationship."
A relationship the advisor cannot cite cannot be stated. This is the correct GraphRAG grounding contract.

## This run (12 fresh personas)

- Fresh users have **no persisted graph edges**, so `relationships_referenced` was **empty on every turn**
  — i.e., the advisor made **no relationship claims it could not cite**. ✅ Correct (no fabricated graph
  reasoning). This is the desired behavior for users without a built graph, but it means the _grounded_
  relationship path (citing real edges) was not exercised in this sample — that path was validated
  separately with a seeded connected graph in the GraphRAG sprint.

## What is grounded

| Statement type                 | Grounded? | How traced                                                                         |
| ------------------------------ | --------- | ---------------------------------------------------------------------------------- |
| Goal/objective references      | ✅        | the user's own statement (`user_stated`) → candidate_goals with `supporting_quote` |
| Relationship/connection claims | ✅        | must cite `relationship_edges`/`connections`; validator gates                      |
| Risks/opportunities            | ✅        | only from the recommendation engine (evidence-backed); archetype removed           |
| Numbers ($)                    | ✅        | validator rejects financial numbers not in context (0 fabricated this run)         |

## Blind spots (the real gaps)

1. **No per-turn GraphRAG retrieval log.** We enforce that claims are cited, but we do **not persist**
   which nodes/edges/documents/recs the context builder pulled for a given response. Post-hoc, we cannot
   answer "what did GraphRAG retrieve for turn X?" — only "did the advisor's citations validate?" (the
   client sees `relationships_referenced` in-flight; it isn't stored).
2. **Retriever (Qdrant/Neo4j) usage is not turn-correlated.** `core.retriever` logs exist but aren't tied
   to an advisor turn id.
3. **Document retrieval** isn't surfaced in the discovery advisor path for these users (no documents
   uploaded); the document→field→evidence chain is validated in the documents/recommendations path, not here.

## Recommended additions

- Persist, per advisor turn: `graphrag.retrieved = {node_ids, edge_ids, document_ids, recommendation_ids}`
  alongside `relationships_referenced` (part of the `advisor.turns` schema in the observability audit).
- Add a seeded-connected-graph persona to the standing eval so the _grounded_ citation path
  (advisor cites a real edge) is continuously exercised, not just the abstain path.
