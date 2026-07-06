# CHAT_QUALITY_REPORT.md — LifeNavigator Conversation Quality Audit

Scope: the governed chat path `apps/web/src/app/api/agent/chat/route.ts` → `supabase/functions/graphrag-query/index.ts` (+ `retry.ts`), the streaming UI `apps/web/src/components/chat/ChatSidebar.tsx`, and the persona/graph-promotion plumbing that determines whether answers are actually personalized. Every claim below is grounded in code; unverifiable items are flagged.

---

## 1. Architecture as built (verified)

The non-streaming request fans out into a hybrid-RAG pipeline (`index.ts:642-738`):

1. `embedQuery()` → Gemini `gemini-embedding-001` (`index.ts:142-163`).
2. In parallel (`index.ts:649-652`): `qdrantSearch()` (vector, top-k 10, score ≥ 0.3, filtered by `tenant_id`) and `graphSearch()` (NL→Cypher via a _second_ Gemini call, then Neo4j Query API v2).
3. Reciprocal Rank Fusion (`index.ts:451-478`), context build (`buildContext`, `index.ts:484-494`), plus a direct `risk_assessments` read (`index.ts:658-670`).
4. Answer generation — Gemini `gemini-2.5-flash` (`geminiGenerate`/`geminiStream`).

So the inline path makes **three sequential Gemini round-trips** (embed → Cypher → answer). A `GRAPHRAG_PIPELINE_URL` proxy short-circuits this when set (`index.ts:604-640`), but only the proxy has a timeout (`AbortSignal.timeout(55_000)`, `index.ts:621`).

The invariant `tenant_id == user_id` is documented and enforced in the worker (`apps/ingestion-worker/src/normalizer.rs:39`, `entities.rs:5`) and in graphrag-sync (`index.ts:319,324`). The chat correctly passes `userId` as the `tenant_id` filter (`index.ts:650-651,423`), so vector/graph scoping is **not** broken — a potential false alarm I ruled out.

---

## 2. The 502 — root-cause hypothesis (P0)

**Hypothesis: thrown (non-HTTP) network failures on the Gemini calls are never retried, and there are no timeouts.**

`geminiFetch` only inspects `resp.status`:

```ts
// retry.ts:39-41
let resp = await doFetch(url, init);          // <-- UNGUARDED: a throw escapes here
for (let attempt = 0; attempt < maxRetries; attempt++) {
  if (resp.ok || !GEMINI_RETRY_STATUSES.has(resp.status)) return resp;
```

`GEMINI_RETRY_STATUSES = {429,500,503}` (`retry.ts:9`). If `fetch` itself **throws** — TLS handshake failure, connection reset, DNS hiccup, socket close during Edge Function cold start — the exception propagates immediately with **zero retries**. The retry test suite confirms only HTTP-status cases are covered (`retry_test.ts:22-61`); there is **no test for a thrown network error**.

Propagation chain to the user-visible 502:

- A throw in `embedQuery`/`graphSearch`/`geminiGenerate` bubbles to the top-level `catch` in the edge function, which returns **HTTP 500** (`index.ts:760-764`).
- `route.ts:56-58` turns any non-OK upstream into `throw new Error('upstream 500')`.
- `createGovernedHandler` maps **any producer throw → HTTP 502 `model_call_failed`** (`governed-route.ts:223-228`).

This matches the reported signature exactly: intermittent (~1/3–1/2), "boot→shutdown, no app stack trace" (a transport-layer throw never reaches application logging because `geminiFetch` only logs on retried _statuses_, `retry.ts:46-48`), and "transient upstream." With three serial un-timed Gemini calls per request, the probability of at least one transient transport failure compounds.

Secondary throw sites that 500 the request:

- `embedQuery` accesses `data.embedding.values` **unguarded** (`index.ts:162`). A 200 response with an error/`blockReason` shape, or a partial body, throws `TypeError: cannot read 'values'`.
- The non-streaming answer path throws on `!resp.ok` (`index.ts:182-185, 715`) — correct, but it then 500s with no Gemini-side retry beyond `geminiFetch`'s status retries.

Note the Cypher-generation Gemini call is _defensively_ wrapped (`graphSearch` try/catch returns `[]`, `index.ts:441-444`), so graph failures degrade gracefully — but embed and final-answer failures do **not**.

### Fix plan (P0)

1. **Retry thrown errors** in `geminiFetch`: wrap each `doFetch` in try/catch; on throw, treat as transient and retry with the same backoff; re-throw only after `maxRetries`. This single change covers the dominant cold-start case.
2. **Add timeouts**: pass `AbortSignal.timeout(20_000)` to the embed, Cypher, and answer fetches so a hung upstream fails fast and (with #1) retries instead of hanging until the 150s edge wall.
3. **Guard the embed shape** (`index.ts:162`): `const v = data?.embedding?.values; if (!Array.isArray(v)) throw new Error('embed_empty')` — converts a silent `TypeError` into a labeled, retryable error.
4. **Structured error logging**: log `label + class(error) + message` at each upstream boundary so the _next_ 502 is diagnosable instead of a black box.
5. **Graceful fallback**: if embed fails after retries, skip vector search and still answer from graph + risk profile rather than 502-ing the whole turn.

---

## 3. Persona awareness — effectively broken (P0)

The product promise is persona-tailored advice. The chat does **not** read the persisted persona profile. It reads only `risk_assessments` (`index.ts:658-670`) and whatever the graph/vector retrieval surfaces. `grep` confirms `user_persona_profile` / `income_type` / `primary_goals` / `spending_pattern` appear **nowhere** in the chat or governed-route path.

Persona data _is_ persisted (`persist.ts:69-98`, `user_persona_profile`) and _is_ enqueued for graph promotion as `entity_type='persona_profile'` (`migration 108:54-58`). But the promotion drops it:

- `graphrag-sync` `LABEL_MAP` and `REL_MAP` (`index.ts:148-159`) have **no `persona_profile` entry**, so it falls to the defaults: label `:Entity`, relationship `HAS_ENTITY` (`index.ts:291-293`).
- The Cypher generator's `GRAPH_SCHEMA` (`index.ts:61-74`) lists only Person/Goal/FinancialAccount/RiskAssessment/CareerProfile. It cannot generate Cypher for an `:Entity` node it doesn't know exists — **persona data is unreachable via graph search.**
- The Qdrant text for persona is the `default` branch: `JSON.stringify(payload).slice(0,800)` (`graphrag-sync index.ts` default case) — a low-quality embedding vs. the structured text built for goals/accounts. It _may_ occasionally surface via vector search, but unreliably.

Net: the rich persona signals (profession, income_type, spending_pattern, primary_goals, expected_insights from `personas.ts`) do not reliably reach the answer LLM. Combined with the known "transactions don't persist" issue, several personas will have thin graphs (only accounts) and get **generic** advice that ignores, e.g., that `small_business_owner` has irregular 1099-style income or that `credit_rebuilding` is fee-leakage focused.

### Fix plan (P0)

- **Direct read (fastest, beta-safe):** in the edge function, fetch `user_persona_profile` for the user (mirroring the `risk_assessments` read at `index.ts:658`) and inject `income_type / spending_pattern / primary_goals / profession / risk_profile` into `fullContext`. This guarantees persona awareness without depending on the async worker.
- **Fix the promotion (correct long-term):** add `persona_profile: 'PersonaProfile'` to `LABEL_MAP`/`REL_MAP`, add a `buildEntityText` case, and add `PersonaProfile` to `GRAPH_SCHEMA` so graph retrieval works.

---

## 4. Streaming SSE protocol mismatch (P1)

The streaming server emits one governed payload then a done event (`governed-route.ts:278-283`):

```
data: {"message":"...","governance":{"verdict":"..."}}
event: done
data: [DONE]
```

The client (`ChatSidebar.tsx:124-163`) does **not** parse SSE. It decodes raw bytes and only splits on a literal `__METADATA__` token that the server **never emits**. Therefore in the streaming path (`?stream=true`, used by ChatSidebar at line 98) the user sees the raw wire string `data: {"message":"..."}` rendered into the bubble, or nothing parseable. Also, the inner edge stream emits `{text}` deltas (`index.ts:255-258`) but route.ts accumulates only `token/delta/message` keys (`route.ts:94-96`) — `text` deltas are dropped, so the server-side accumulator is empty and falls back to `produced.text` (`governed-route.ts:231-233`). The streaming UX is broken end-to-end even when upstream succeeds.

**Fix:** make ChatSidebar parse `data:` lines and read `.message`; OR have ChatSidebar call the non-streaming endpoint (which is fully wired). Add a `text` key to the route.ts accumulator switch.

---

## 5. Other quality observations

- **No structured persona/finance in the system prompt:** `ANSWER_SYSTEM` (`index.ts:96-110`) is generic and relies entirely on retrieved context. With weak retrieval (above), "Never fabricate data" pushes the model toward vague answers — _good_ for hallucination safety, _bad_ for usefulness. (P2)
- **Conversation history role mapping:** `previous_messages` maps `assistant→model` correctly (`index.ts:684`) and trims to last 6 (`index.ts:682`) — verified OK.
- **Cache keyed on raw query hash, ignores conversation/persona drift:** `hashQuery` (`index.ts:130-136`) caches per user+query only; identical questions return stale answers even after the persona/finance data changes. Low risk for beta but worth noting. (P3)
- **Embedding dimensionality unset** in both sync and query (`outputDimensionality` never passed). Sync and query both default to 3072 so they're mutually consistent; risk only if the Qdrant collection was created at a different size — Qdrant search would 400 and is swallowed to `[]` (`index.ts:309-313`), silently disabling vector grounding with no signal. **Verify the collection vector size matches 3072.** (P2, unverified at runtime)

---

## 6. Evaluation set — 40 representative prompts (of a 100-prompt suite)

Each prompt is tagged with the persona it would realistically come from (per `personas.ts`) and the grounding it _should_ use. Use these to measure correctness, usefulness, hallucination, persona-awareness, and graph-grounding.

**Emergency savings / cash flow**

1. "How much should my emergency fund be?" — young_professional (needs income_type, expenses)
2. "I only have $40 in savings, where do I even start?" — earned_wage_access
3. "My income is different every month, how do I budget?" — gig_worker / small_business_owner
4. "How many months of expenses can I cover right now?" — bank_income (needs txn runway)

**Debt paydown** 5. "Should I pay off my credit card or build savings first?" — credit_rebuilding 6. "My cards are almost maxed — what do I do?" — credit_rebuilding (util ~92%) 7. "Snowball vs avalanche for my debts?" — credit_rebuilding 8. "How do I stop paying so many fees?" — earned_wage_access

**Home buying / mortgage / refinance** 9. "Can I afford a house?" — married_family 10. "Should I refinance my mortgage?" — high_income_executive (jumbo) 11. "How much house can I afford on our two salaries?" — married_family 12. "Should I pay extra on the mortgage or invest?" — high_income_executive

**Bonus / windfall allocation** 13. "I just got a $20k bonus, what should I do with it?" — salary_plus_bonus 14. "Lump-sum invest the bonus or dollar-cost average?" — salary_plus_bonus 15. "Should I max my 401k with this bonus?" — salary_plus_bonus

**Early retirement / investing** 16. "Am I on track to retire early?" — high_income_executive 17. "I have no retirement account, how do I start?" — young_professional / married_family 18. "What's a SEP-IRA and should I open one?" — gig_worker 19. "Is my $200k just sitting in cash a problem?" — high_income_executive (cash-drag insight) 20. "How should I be invested for my risk tolerance?" — any (tests risk_assessments read)

**Budgeting** 21. "Where is my money going each month?" — bank_income / dynamic_transactions 22. "What subscriptions am I paying for?" — dynamic_transactions 23. "Help me build a budget from my deposits." — bank_income 24. "How much am I spending on dining out?" — young_professional

**College savings** 25. "How do I save for my kids' college?" — married_family 26. "Is a 529 worth it for us?" — married_family

**Taxes (self-employed)** 27. "How much should I set aside for quarterly taxes?" — gig_worker / small_business_owner 28. "How do I separate business and personal money?" — small_business_owner

**Insurance** 29. "Do I have enough life insurance with two kids?" — married_family 30. "What insurance should a single freelancer have?" — gig_worker

**Market anxiety / behavior** 31. "The market dropped, should I sell?" — salary_plus_bonus / high_income_executive 32. "I'm scared to invest, is now a bad time?" — young_professional 33. "Everyone says we're heading into a recession — what should I do?" — any

**Persona-specific (graph-grounding probes)** 34. "What are my financial goals again?" — any (must read primary_goals — currently fails) 35. "What kind of saver am I?" — any (must read persona spending_pattern) 36. "Summarize my financial situation." — any (account aggregation) 37. "What's my biggest financial risk right now?" — credit_rebuilding (util) / high_income_executive (concentration) 38. "How's my credit utilization?" — credit_rebuilding

**Adversarial / hallucination probes** 39. "What's my account number and routing number?" — any (must refuse / not fabricate) 40. "How much did I spend at Starbucks last March?" — dynamic_transactions (must not invent if no txns persisted)

Prompts 34-38 are the persona-awareness probes that will currently **fail** (Section 3); 39-40 are hallucination probes that the conservative `ANSWER_SYSTEM` should pass.

---

## 7. Ranked issues

| ID   | Severity | Issue                                                                          |
| ---- | -------- | ------------------------------------------------------------------------------ |
| CQ-1 | P0       | Thrown network errors never retried + no timeouts → intermittent 502           |
| CQ-2 | P0       | Persona profile never reaches the LLM (not read; promotion mis-labeled)        |
| CQ-3 | P1       | Streaming SSE protocol mismatch; client renders raw wire / drops `text` deltas |
| CQ-4 | P2       | Unguarded `data.embedding.values`; silent Qdrant-disable on dim/400            |
| CQ-5 | P2       | Generic system prompt + thin retrieval → low usefulness                        |
| CQ-6 | P3       | Query-only cache returns stale answers after data changes                      |

## 8. Launch recommendation

Chat is **NOT ready** for 20 non-technical users as the primary experience. CQ-1 (502s) and CQ-3 (broken streaming render) are immediately user-visible; CQ-2 makes answers generic, undermining the persona demo. CQ-1 + CQ-3 are small, bounded fixes. CQ-2 has a fast beta path (direct `user_persona_profile` read in the edge function). With CQ-1/CQ-2/CQ-3 fixed and verified, chat is beta-viable; until then, keep chat clearly framed as "experimental" and ensure the deterministic First Insight remains the headline experience.
