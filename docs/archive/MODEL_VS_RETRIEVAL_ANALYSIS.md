# MODEL_VS_RETRIEVAL_ANALYSIS.md — Phase 5

For each benchmark: would a **stronger model** or **better retrieval** improve it? (Scored on the empty-context benchmark; personalized grounding untested — see caveats.)

| Prompt            | Stronger model helps?                                  | Better retrieval helps?                                        | Verdict                         |
| ----------------- | ------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------- |
| F1 afford         | **YES — proven** (Opus 4.8 passed where Gemini failed) | No (generic; user numbers were in-prompt)                      | **Model**                       |
| F2 debt vs dp     | marginal                                               | no                                                             | already good                    |
| F3 emergency fund | marginal                                               | no                                                             | already good                    |
| F4 promotion      | marginal                                               | **would help** (real comp/expense data → sharper)              | mixed                           |
| H1 recomp         | no                                                     | **would help** (real fitness baseline → personalized)          | retrieval (for personalization) |
| H2 injury         | no                                                     | would help (real injury history)                               | retrieval                       |
| H3 TRT            | no                                                     | would help (real labs/protocol — but those are medical, gated) | limited                         |
| X1 master's       | marginal                                               | **would help** (real finances → concrete tradeoff)             | retrieval                       |
| X2 baby           | no                                                     | would help (real family/insurance gaps)                        | retrieval                       |
| X3 die/no will    | no                                                     | **would help** (real estate/beneficiary state)                 | retrieval                       |

## The honest split

- **Where model wins (high-stakes finance number-discipline):** Opus 4.8 > Gemini 2.5 Pro — measured (F1). This is the clearest, proven improvement.
- **Where retrieval would win (personalization):** the cross-domain/health/promotion prompts would get sharper with the user's REAL data — but that's the **SQL fact packet**, not GraphRAG. The benchmark used empty context, so this is structural inference, not measured.
- **GraphRAG (Qdrant/Neo4j) limiting quality?** No evidence. It isn't in the live path, and generic advice doesn't need it. The personalization lever is enriching the fact packet, not wiring a vector/graph DB.

## Answer to the sprint's core question

- **Is retrieval the bottleneck?** Not for generic advisory quality (model is, and Opus 4.8 wins). For **personalized** advice, the lever is the **fact packet**, and that's an untested gap — measure it with seeded users before investing.
- **Is GraphRAG limiting advisor quality?** No.
- **Highest-ROI improvement:** (1) **Opus 4.8 for high-stakes finance/health** (proven), (2) **streaming** for the ~26s latency, (3) **richer personalized grounding via the fact packet** — in that order. Not GraphRAG.
