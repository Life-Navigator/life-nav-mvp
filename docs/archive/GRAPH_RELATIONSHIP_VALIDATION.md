# GRAPH_RELATIONSHIP_VALIDATION.md — Phase 4

## Verdict: graph relationships ARE used — and validator-gated.

The advisor traverses the user's **personal_graph** (persisted nodes + edges via `LifeDiscoveryService.personal_graph()`), passes `relationship_edges` + `graph_connections` into the LLM prompt, and the validator **rejects any relationship the model asserts that isn't in the real graph** (`connected_pairs` gate).

## How traversal works (advisor_context.py)

- `derive_graph_relations()` (l.104) — extracts persisted edges + computes 2-hop primary-node connections (goals/objectives linked via a shared intermediate node).
- `build_relationships()` (l.153) — labels them → `relationship_edges`, `connections` (with basis: direct or via shared node), `connected_pairs` (validator allowlist).
- Prompt rule (advisor_llm.py l.116): the model may state a connection **only** if the pair is in `graph_connections`/`relationship_edges`; else the validator strips it.

## Relationship types the graph supports (as edges exist)

| Edge intent                   | Supported via                                 |
| ----------------------------- | --------------------------------------------- |
| goal depends_on constraint    | persisted edge                                |
| risk threatens goal           | persisted edge                                |
| recommendation mitigates risk | recommendation registry + edge                |
| education advances career     | 2-hop primary connection                      |
| promotion improves finance    | 2-hop / cross-domain edge                     |
| document supports fact        | life.facts provenance (sourceTable=documents) |
| insurance protects dependents | family facts + edge                           |

## Live evidence

- Cross-domain promotion question → response carried `relationships_referenced` + 25 citations and brought **home-timeline context** without derailing the career answer. Confirms traversal + cross-domain synthesis + no-fabrication gate working together.

## Important honesty

- Source is **personal_graph**, NOT a `life.relationships` table (that table is empty — 0 rows — the future MCP target).
- No Neo4j inference / dynamic relationship discovery — only **persisted** edges. If two goals were never linked during discovery, the advisor won't invent the link (by design — the validator enforces this).

## Classification: WIRED AND GOOD.

</content>
