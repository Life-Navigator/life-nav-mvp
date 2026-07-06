# ADVISOR_CONTEXT_QUALITY_AUDIT.md — Phase 3

## Critical honesty note

The benchmark runs (this sprint + the prior one) were executed with **`FakeSupabase` — i.e. EMPTY retrieved context.** So for all 10 prompts:

| Context source                                                           | Expected (production, onboarded user) | Actual (benchmark) |
| ------------------------------------------------------------------------ | ------------------------------------- | ------------------ |
| Domain facts (career/edu/finance/family/docs/life.facts/health/military) | the user's real rows                  | **0 — empty**      |
| Personal graph edges (`life_graph_edges`)                                | the user's edges                      | **0**              |
| Citations                                                                | from the fact packet                  | **0**              |
| Goals / candidate_goals                                                  | the user's goals                      | **0**              |
| Risks / opportunities / constraints                                      | the user's snapshot                   | **0**              |
| Documents                                                                | the user's uploads                    | **0**              |

The benchmark therefore measured **model reasoning on generic prompts with no grounding** — it is NOT a measurement of production context quality.

## What production retrieval actually is (proven earlier, unchanged)

The live advisor path builds context from **Supabase SQL only**: the fact packet (`build_fact_packet`), the personal graph (SQL `life_graph_edges`), discovery coverage, goals/risks/constraints. **No Qdrant, no Neo4j, no embeddings, no ontology at request time** (GRAPHRAG_TRUTH_AUDIT.md). Retrieval == the SQL fact packet.

## Implication for "context quality"

- For the 10 benchmark prompts (generic advice: "build a workout plan", "what if I die"), **no personal grounding is needed to answer well** — and both models did. So context emptiness did not hurt these answers.
- A true context-quality audit requires **seeded, onboarded users** with real domain rows + a live Supabase — NOT run here (no live DB in this environment). That is the one missing measurement.

## Recommendation

Before claiming retrieval is or isn't the bottleneck for PERSONALIZED advice, run the 10 prompts (plus personalized variants like "given MY accounts, rebalance") against **seeded users on live Supabase** and record the actual fact-packet contents per turn. Until then, the honest scope is: model reasoning is measured; personalized grounding is not.
