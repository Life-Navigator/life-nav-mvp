# CONTEXT_ENGINEERING_AUDIT.md — LifeNavigator GraphRAG pipeline

**Date:** 2026-06-04
**Scope:** The full retrieval → fusion → context-assembly pipeline that feeds the conversational advisor. Grounded in code (file:line citations), not inferred.
**Verdict for 20 users:** **Pass with two P1 fixes** — user isolation is structurally sound; the real risks are (a) an _async_ eventual-consistency window where a persona-switch can briefly mix old+new account facts, and (b) no token budget / freshness model.

---

## 0. The two retrieval paths (which code governs?)

The edge function `supabase/functions/graphrag-query/index.ts` tries a **Python pipeline proxy first** (`GRAPHRAG_PIPELINE_URL`, `index.ts:608-644`) and falls back to **inline hybrid search** if the pipeline is unset/non-200/unreachable. Both paths filter retrieval by the authenticated `user_id` (`query.py:132,152` and `index.ts:662,664`). This audit covers the **inline fallback** (the authoritative, always-present path); the Python pipeline mirrors it (`apps/graphrag-pipeline/`). **Action:** confirm in prod which path is live so observability targets the right one.

---

## 1–12. Item-by-item findings

| #   | Item                            | Finding                                                                                                                                                                                                                                                          | Evidence                                                                        |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | **Qdrant retrieval count**      | Top **10**, cosine `score_threshold = 0.3`, payload included.                                                                                                                                                                                                    | `index.ts:54` `VECTOR_TOP_K=10`; `:302-304`                                     |
| 2   | **Neo4j retrieval count**       | Up to **20 rows** (Cypher `LIMIT 20` enforced by prompt rule). No semantic threshold.                                                                                                                                                                            | `index.ts:86` (rule "Limit to 20 rows max"); `graphSearch :437`                 |
| 3   | **Context ranking**             | Reciprocal Rank Fusion across the two lists, `RRF_K=60`; ranked by **rank position**, not raw score.                                                                                                                                                             | `index.ts:455-482`                                                              |
| 4   | **Context freshness**           | **Not modeled.** No recency weighting/ordering of retrieved facts. Only the _risk profile_ is fetched "latest" (`order created_at desc limit 1`). Freshness relies entirely on stale rows being **deleted** (see #6/staleness).                                  | `index.ts:671-682`; no `created_at` in `buildContext`                           |
| 5   | **Duplicate elimination**       | RRF dedups by **`entity_id`** (Map keyed by entity_id; keeps the longer text). Same fact under **different** entity_ids is NOT deduped.                                                                                                                          | `index.ts:458-476`                                                              |
| 6   | **Persona isolation**           | Persona switch deletes `finance.financial_accounts`; an `AFTER INSERT OR UPDATE OR DELETE` trigger enqueues a graph **`delete`** job → `graphrag-sync` runs `DETACH DELETE` (Neo4j) + `points/delete` (Qdrant). Design is correct, but **asynchronous** (queue). | `migration 050:197,214-215`; `graphrag-sync:296-299,244-253`                    |
| 7   | **Financial account isolation** | All of a user's own accounts are retrievable (correct — it's their data). No cross-user leak: every node/point carries `tenant_id = user_id`.                                                                                                                    | `entity_mapper.py:47,62`; `qdrant_client search tenant_id=user_id query.py:132` |
| 8   | **User isolation**              | **Sound.** `tenant_id == user_id` on write; Qdrant filter `must tenant_id=value`; Cypher `$tenant_id` injected server-side; cache keyed by `user_id`; caller `user_id` is auth-verified (or trusted worker-secret).                                              | `index.ts:300,427,596,561-572`                                                  |
| 9   | **Context truncation**          | Fused list truncated to **15 items** for the prompt; **5** for `sources`. Item-count cap, **not** token-based.                                                                                                                                                   | `index.ts:493` (`slice(0,15)`), `:750` (`slice(0,5)`)                           |
| 10  | **Token budgeting**             | **None explicit.** No token counting; relies on the 15-item cap. Graph items are `JSON.stringify(row)` — variable, potentially verbose. Output capped (`maxOutputTokens` 512 non-stream / 2048 stream).                                                          | `index.ts:440,493,179,214`                                                      |
| 11  | **Context ordering**            | Single flat list by fused score; graph JSON rows interleaved with vector text snippets. No domain sectioning.                                                                                                                                                    | `index.ts:488-497`                                                              |
| 12  | **Retrieval scoring**           | Vector: cosine, floored at 0.3. Graph: **positional** (`1.0 - idx*0.05`), not relevance-based — so graph items aren't semantically scored at all.                                                                                                                | `index.ts:328,441`                                                              |

---

## Answers to the six questions

**Are we retrieving too much?** No. ≤10 vector + ≤20 graph → fused → **15-item** context + risk profile + last 6 messages. With `maxOutputTokens` 2048, the model is not overwhelmed by volume. The only unbounded dimension is **per-item size** (graph `JSON.stringify(row)`), not item count.

**Are we retrieving irrelevant data?** _Vector side:_ gated at cosine 0.3 (reasonable). _Graph side:_ **yes, possibly** — Cypher returns rows by graph _structure_ up to 20, with **no semantic relevance threshold**. A broad generated query (e.g. "RETURN all accounts") injects every account regardless of the question. The only relevance gate is the quality/narrowness of the LLM-generated Cypher (temp 0.1, which helps).

**Are we retrieving stale data?** **Only inside the async window.** Persona-switch deletes do enqueue graph/vector purges, but processing is queue-driven. If the `graphrag-sync` queue lags or its worker is down, the **old persona's `FinancialAccount` nodes persist** alongside the new ones (sandbox mints fresh `account_id`s each activation, so re-promotion MERGEs _new_ nodes rather than overwriting old ones). There is no freshness/recency filter to defend against this at read time.

**Can conflicting facts enter context?** **Yes, during that window.** Old + new persona accounts have different `entity_id`s → RRF won't dedup them → the model can see two different "current_balance: checking" facts. Outside the window (queue drained), no.

**Can multiple personas contaminate context?** **Same answer:** structurally prevented once the delete jobs drain; possible transiently if the queue is unhealthy. This is the **#1 thing to verify operationally** before 20 users.

**Can retrieval overwhelm the model?** No, on count. The residual risk is a few large graph JSON rows crowding the 15-item budget — mitigated by switching to a token budget (see fixes).

---

## Risk ranking & fixes

### P1 (do before 20 users)

1. **Close the persona-switch staleness window.** Two options: (a) make `clearPriorFinanceData` **synchronously** purge the user's graph+vector nodes (call the same DETACH/Qdrant delete inline, not only via the async queue) before re-promotion; or (b) verify the `graphrag-sync` queue worker is healthy, drained within seconds, and alarmed if backlog > N. Today, a user who switches personas and immediately opens chat _could_ be told about both personas' accounts. _Evidence: `activate-persona` clears SQL only (`persist.ts clearPriorFinanceData`); graph purge is async (`migration 050:215` → `graphrag-sync`)._
2. **Add a real token budget + per-item clamp.** Replace the fixed `slice(0,15)` with a token-counted assembly (e.g. ≤2–3k context tokens) and clamp each graph item (don't dump raw `JSON.stringify(row)`; project to named fields). _Evidence: `index.ts:440,493`._

### P2

3. **Add a graph relevance gate.** Either embed/score graph rows and threshold them, or cap graph contribution (e.g. top 8) so a broad Cypher can't flood context. _Evidence: `index.ts:437` (no threshold)._
4. **Stamp freshness into context.** Include `as of <date>` / `updated_at` on financial facts so the model can prefer the latest and hedge on stale data. _Evidence: `buildContext` omits timestamps (`index.ts:493`)._
5. **Section the context by domain** (Finance / Goals / Career) rather than one flat list — improves the model's grounding and reduces cross-domain bleed. _Evidence: `index.ts:491-497`._

### Already sound (no action)

- User isolation (tenant_id=user_id end-to-end), per-user cache keying, auth verification of the caller, RRF dedup by entity_id, vector relevance floor (0.3), bounded output tokens, resilient degradation (embed/graph failures return `[]` rather than 500 — from the prior chat-502 sprint).

---

## One-line verdict

**Context quality is structurally safe for 20 users on isolation, and bounded on volume — the two things to fix are the _async staleness window_ on persona switch (the only path to conflicting facts) and the lack of a real _token budget/freshness model_.** Both are P1, both are small, neither blocks launch if the sync queue is verified healthy.
