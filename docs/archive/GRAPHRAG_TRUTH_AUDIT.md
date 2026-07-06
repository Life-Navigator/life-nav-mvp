# GRAPHRAG_TRUTH_AUDIT.md — Phase 3

No marketing language. The question: does the **live advisor chat turn** use GraphRAG? Cite file:line.

## Verdict: **(c) SQL + facts + citations.** NOT semantic GraphRAG.

Per advisor request, retrieval is `AdvisorContextBuilder.build()` (`advisor_context.py:353`) running 4 concurrent **Supabase SQL reads** (`:368-370`). Nothing else.

| Capability                                       | Used in live advisor turn?     | Evidence                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Semantic / vector retrieval (Qdrant, embeddings) | **NO**                         | No Qdrant/`embed`/similarity call in `advisor_orchestrator.py`, `advisor_context.py`, `advisor_facts.py`, `life_discovery.personal_graph`. `Retriever.retrieve_personal` (real Gemini-embed + `qdrant.search_personal`, `grounding/retriever.py:53-58`) is reachable only from the **unused** `/v1/chat` path. |
| Graph DB traversal (Neo4j / Cypher)              | **NO**                         | Advisor "graph" = `LifeDiscoveryService.personal_graph()` (`life_discovery.py:1010`) built from Supabase rows (`self._sb.select` over `life.life_graph_edges`, `life.goals/risks/constraints`, domain tables). Real Cypher (`clients/neo4j.py:53`) only on the unused path.                                    |
| Ontology concepts                                | **NO**                         | No ontology import/call in the advisor path. Ontology lives in `apps/graphrag-pipeline` (offline), never called by the advisor.                                                                                                                                                                                |
| Document facts / `life.facts`                    | **YES (SQL)**                  | Fact packet `build_fact_packet` (`advisor_facts.py:78`) `sb.select`s career/education/finance/family/documents rows.                                                                                                                                                                                           |
| personal_graph / `life_graph_edges`              | **YES (SQL)**                  | `_relationships()` → `personal_graph()` reads `life.life_graph_edges` (`life_discovery.py:1020`); edges derived in Python (`advisor_context.py:104-195`).                                                                                                                                                      |
| risks / goals / constraints                      | **YES (SQL)**                  | Deterministic panel + `personal_graph` read `life.risks/goals/constraints/opportunities` (`life_discovery.py:1016-1019`).                                                                                                                                                                                      |
| Citations                                        | **Constructed from SQL reads** | `_citations_from_context` maps `domain_facts` to citation records carrying `sourceTable/recordId/confidence/updatedAt` (`advisor_orchestrator.py:41-57`, `advisor_facts.py:40-52`). Real row-level provenance — NOT vector/graph similarity scores. Explicitly "SECTION-LEVEL, not per-sentence" (`:42-44`).   |

## Online vs offline (the key distinction)

- **ONLINE (per advisor chat request):** Supabase SQL reads only → in-Python relationship derivation → Gemini → deterministic validator. Zero Qdrant/Neo4j/embeddings/ontology.
- **OFFLINE / SEPARATE:** `apps/graphrag-pipeline` (own service: `lib/qdrant_client.py`, `lib/neo4j_client.py`, `lib/embedding_builder.py`, `lib/rrf.py`) does real embedding + Qdrant + Neo4j + RRF fusion. The core-api advisor path has **zero** references to it. The Rust `apps/ingestion-worker` is the other offline writer.
- The marketing strings ("Personal GraphRAG" `chat.py:1-7`; "grounds via Qdrant + Neo4j" `main.py:39`) describe the **unused** `/v1/chat` path and the offline pipeline — not the turn users hit.

## Critical implication (do not miss this)

The advisor is NOT using GraphRAG — **but that is not the cause of poor answers.** The prior control experiment (`docs/advisor-benchmark/CLAUDE_CONTROL_EXPERIMENT.md`) proved architecture contributes ~0% to the quality gap; the gap is model + the number gate. **Wiring GraphRAG into the live path would not fix answer quality.** It is graph-_shaped_ SQL with honest provenance, which is fine for grounding. The intelligence problem lives in the prompt/validator/model, not the retrieval substrate.
