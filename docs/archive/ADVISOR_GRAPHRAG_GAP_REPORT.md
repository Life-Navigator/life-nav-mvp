# ADVISOR_GRAPHRAG_GAP_REPORT.md — Phase 5

Each capability classified. No new architecture proposed — the architecture is sound for grounded, cited, no-fabrication answers; the "missing" pieces are deliberate non-features that would require new services (out of scope).

| Capability                                        | Status                   | Evidence / note                                                                                                             |
| ------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **life.facts (document-derived)**                 | ✅ WIRED AND GOOD        | Read + cited (confirmed/inferred gate); 25 citations live                                                                   |
| **Domain facts (career/edu/finance/family/docs)** | ✅ WIRED AND GOOD        | SQL with sourceTable+recordId+confidence                                                                                    |
| **Graph relationships**                           | ✅ WIRED AND GOOD        | personal_graph edges + 2-hop links, validator-gated, referenced live                                                        |
| **Citations / provenance**                        | ✅ WIRED AND GOOD        | survive to response (`citations[]`)                                                                                         |
| **Goals / risks / constraints**                   | ✅ WIRED AND GOOD        | from RelationshipManager context_panel                                                                                      |
| **Domain routing → retrieval**                    | ✅ WIRED AND GOOD        | route_domains gives correct domain hint; does NOT block traversal (orchestrator keeps all facts for cross-domain synthesis) |
| **Semantic / vector retrieval**                   | ⬜ NOT WIRED (by design) | no Qdrant/embeddings in path; adding = new vector service (OUT OF SCOPE)                                                    |
| **Ontology expansion**                            | ⬜ NOT WIRED (by design) | keyword router, not concept taxonomy; adding = new ontology engine (OUT OF SCOPE)                                           |
| **life.relationships table**                      | ⬜ NOT WIRED / EMPTY     | 0 rows (future MCP target); personal_graph already supplies edges — nothing to wire                                         |

## Does routing block GraphRAG/ontology retrieval?

**No.** For the orchestrator (Arcana), `route_domains` feeds the `agent_domains` prompt _hint_ but does **not** filter facts or edges — all domain facts + the full personal_graph are always available for cross-domain synthesis. Direct domain agents scope facts to their domain (intentional). So routing cannot block traversal.

## Are unrelated finance facts excluded when not relevant (Q7)?

At the **context** level for Arcana: all facts are present (needed for cross-domain). At the **answer** level: the corrected `agent_domains` hint + the user message keep the answer in-domain — verified live (health Q → health answer, zero finance leak). This is the intended focus-with-cross-domain-awareness behavior.

## Surgical fixes warranted: NONE

Everything with data is wired and cited. The unwired items are either empty (life.relationships) or require forbidden new services (semantic, ontology). Recommendation: **do not add them this sprint**; the grounded-facts + graph-edges + citations system is investor-credible as-is.
</content>
