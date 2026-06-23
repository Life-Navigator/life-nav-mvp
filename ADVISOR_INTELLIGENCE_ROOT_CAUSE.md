# ADVISOR_INTELLIGENCE_ROOT_CAUSE.md — Synthesis

Proven across 5 code investigations (see FAILED_ADVISOR_TRACE / GRAPHRAG_TRUTH / ADVISOR_MODEL_QUALITY / ADVISOR_CONTEXT_ASSEMBLY / FINANCE_OVERVIEW_RENDERING audits). No guessing.

## The real cause is NOT GraphRAG, NOT architecture

The control experiment already proved architecture ≈ 0% of the gap, and this audit confirms the live advisor path is plain SQL+facts+citations anyway. **Wiring GraphRAG would not move quality.** The intelligence gap is three things, in order of impact:

### 1. The number gate (biggest, and it's a self-inflicted wound)

`advisor_validator.py:84,182-184`: `_FIN_NUM` matches any `$`, `%`, or integer ≥100; **any number not in `allowed_numbers` rejects the entire reply** → deterministic generic fallback. It was built to stop _fabricated personal financial figures_ (a legitimate trust guarantee) but it also kills **general domain knowledge**: rep ranges, calories, macros, "3–6 months emergency fund", "20% down", typical match %. This is why answers are vague and non-actionable across every domain, and especially health.

### 2. Forced decision-analysis structure + mandatory question (every turn)

`advisor_llm.py:45-66,184` + `advisor_validator.py:187`: six mandatory sections and a required closing question on every turn, with no "plan/program" output field. This is why it asks unnecessary questions and won't produce a concrete plan even when asked directly.

### 3. Model = Gemini 2.5 Flash, not Claude

`dependencies.py:311` + `config.py:26`. In-repo benchmark: Claude 8.2 / ChatGPT 6.2 / LN 5.8; Claude won 48/50, LN 0/50. Control swap Gemini→Claude = +0.64. Claude is fully wired (`VertexClaudeAdvisorLLM`) but OFF behind flags needing Vertex creds.

### Secondary (proven)

- Health + military context never enters the prompt (`advisor_facts.py` reads no health; `MilitaryService` never called) → health turns ungrounded.
- Risk chips leak cross-domain (`relationship_manager.py:393` → `send-server.ts:61-66`; global `top_risks`, not topic-scoped).
- Default RM agent ships all-domain risks/goals/graph regardless of topic.
- Contradictory `_SAFETY` vs V4 system prompt → over-refusal.

## Final Questions

1. **Model quality?** Partly — measured ~half the gap (+0.64). Necessary, not sufficient.
2. **Prompt design?** Yes — forced structure + mandatory question suppress plans/answers.
3. **Context assembly?** Yes — health/military withheld; cross-domain leak.
4. **GraphRAG actually used?** **No** — live path is SQL+facts+citations; Qdrant/Neo4j only on an unused route + offline pipeline.
5. **Ontology used?** **No** — never consulted at request time.
6. **Irrelevant context leaking?** **Yes** — global risk chips + all-domain panel on the default agent.
7. **Competitive with ChatGPT now?** **No** (LN 5.8 vs ChatGPT 6.2 vs Claude 8.2, measured).
8. **Finance overview renders correct backend data?** **No** — Gaps 1–3 (P0/P1) cause divergent net worth, empty account lists, and empty spending/tx/investments under the proxy.
9. **What fixes shipped?** **None yet** — this sprint proved the cause; fixes await a scope decision (see below).
10. **What remains blocking?** The number-gate trade-off decision (trust vs actionability), Vertex creds for the Claude swap, and live validation.

## The one decision before any code change

The #1 fix — loosening the number gate — touches the product's **no-fabrication trust spine** (the one thing LN currently _wins_ on: Trust 8.3, tied with Claude). This is a genuine product trade-off the owner must make, not a silent patch. The other fixes (health fact reader, risk-chip domain scoping, optional `next_question`, reconcile `_SAFETY`, finance mapping) are clearly correct and low-risk.

Also: the live advisor deploys from branch `advisor/p0-upgrade-2.3.0` (per project memory), NOT the current branch — so fixes must target the right branch to reach prod.

## Final Status: **BLOCKED** (diagnosis complete & proven; fixes not yet shipped)

Root cause is conclusively identified. Status flips to ADVISOR_INTELLIGENCE_FIXED after: (a) number-gate scope decision + implementation, (b) Claude routing enabled with Vertex creds, (c) live re-validation vs the 6 prompts, (d) finance Gaps 1–3 fixed. None require new architecture.
