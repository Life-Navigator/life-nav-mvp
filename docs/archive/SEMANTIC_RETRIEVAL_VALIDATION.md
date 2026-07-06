# SEMANTIC_RETRIEVAL_VALIDATION.md — Phase 2

## Verdict: the advisor does NOT use semantic/vector retrieval.

Retrieval is **deterministic SQL fact-fetch + persisted-graph traversal**, not embedding/vector search. Proven by absence: no Qdrant client, no embedding call, no vector query in `AdvisorContextBuilder.build()` / `_facts()` / `build_fact_packet()`.

## Per test prompt — what is retrieved (and how)

| Prompt                                               | Retrieval                                | Source tables                                                   | Semantic?          | Citations survive?                                        |
| ---------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------- | ------------------ | --------------------------------------------------------- |
| "Build me a weekly training plan"                    | SQL facts + graph edges; routed→health   | life.facts, family.dependents, personal_graph                   | No (keyword route) | ✅ (live: 25 cites on cross-domain Q)                     |
| "How does getting promoted affect my home timeline?" | SQL facts (career+finance) + graph edges | career.career_goals, finance.financial_accounts, personal_graph | No                 | ✅ verified live (25 citations incl. career.career_goals) |
| "What happens if I die tomorrow?"                    | family/estate facts + graph              | family.dependents, documents.documents, life.facts              | No                 | ✅                                                        |
| "UT AI master's before/after a house?"               | education + finance facts + graph        | education._, finance._                                          | No                 | ✅                                                        |
| "Does my trust conflict with my life insurance?"     | family + documents facts                 | family.\*, documents.documents, life.facts                      | No                 | ✅                                                        |
| "Risks before having a child?"                       | family + risk context                    | family.dependents, base risks                                   | No                 | ✅                                                        |

## Live evidence

A cross-domain promotion question returned **25 citations** with full provenance (`kind, domain, label, value, sourceTable=career.career_goals, recordId, confidence`) and a `relationships_referenced` field. So **document-derived + domain facts are retrieved and cited** — just not via embeddings.

## Honest framing

This is **retrieval without semantics**: precise, provenance-carrying, never-fabricated — but it can't do fuzzy concept matching (e.g. "body recomposition" → "strength training" unless a keyword/fact links them). That's a deliberate trust-first design, not a bug. Adding true semantic retrieval = a new vector service (explicitly out of scope this sprint).
</content>
