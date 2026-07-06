# TOP_REMAINING_ECONOMIC_RISKS.md

**Date:** 2026-06-04
Ordered by severity for the 20-user beta.

---

### 1. 🔴 BLOCKER — Gemini answer-generation failing ~98% (key quota/rate)

_Not economic, but it gates everything._ After the budget wall was removed, the grounded battery showed
**148/150 chat turns degrade to the fallback** because `geminiGenerate()` in `graphrag-query` fails.
Highest-likelihood cause: the `GEMINI_API_KEY` has hit a free-tier quota/rate ceiling (the model name is
correct; the edge fn is reached; failure timing matches `429 RESOURCE_EXHAUSTED`). **Fix:** provision a
**billing-enabled / higher-quota Gemini key**; re-run `beta20-reverify.mjs`. **Mitigation:** the pipeline
makes ~3 Gemini calls/turn (embed + NL→Cypher + answer) — cache/collapse the auxiliary calls to cut quota
pressure ~3×. _Until this is fixed, chat is not usable and the Truth & Trust sprint must not start._

### 2. 🟠 Existing budget rows not migrated to the new $4 cap

`BETA_USER_BUDGET_DEFAULTS` only applies to **newly lazy-created** rows. Existing users keep their old $1
cap. **Fix:** one-time `UPDATE economic_user_budgets SET daily_budget_micros=4000000,
weekly_budget_micros=20000000, monthly_budget_micros=80000000` for the real cohort (or rely on
lazy-create for fresh signups). Test fixtures were patched manually during verification.

### 3. 🟠 Per-turn cost is under-counted (only 1 of ~3 Gemini calls metered)

The governor prices one flash call (~$0.00035); a real turn costs ~3× (~$0.001) because embed + NL→Cypher

- answer-gen happen un-metered inside the edge function. Harmless at $4/day, but platform-cap forecasting
  is ~3× optimistic. **Fix:** thread real token usage back from `graphrag-query` into
  `produced.actual_micros`, or meter the 3 sub-calls.

### 4. 🟡 `gemini-embedding-001` is unmodeled in the rate table

If an embedding call is ever routed through `estimateCost` (model `gemini-embedding-001`), it hits the
$0.39 unmodeled ceiling — the same class as the chat bug. Harmless today (embeddings aren't governed-
metered). **Fix:** add `gemini-embedding-001` to `RATE_TABLE`.

### 5. 🟡 Deploy trigger gap — push to `mvp` ≠ production

Vercel's production branch is `main`; prod deploys require a manual `POST /v13/deployments`. A committed
fix can silently not ship (it cost ~25 min this session). **Fix:** point Vercel production at `mvp`, or
add a deploy step to `ci.yml`.

### 6. 🟡 `budget_exceeded` friendliness depends on the frontend

The API returns a structured `429 {error:"budget_exceeded"}`. Confirm the chat UI renders a friendly
"daily limit reached" message rather than a raw error.

### 7. 🟢 Rotate the shared secrets

The Supabase `sbp_…` token, service-role key, worker secret, and the Vercel token used this session were
all flagged for rotation. Rotate now that verification is complete.

### 8. 🟢 Chat latency is high (p50 ~12.5s, p99 ~18s)

Even successful turns are slow (3 sequential Gemini calls + Neo4j + Qdrant). Not an economic risk, but a
retention/UX risk for the beta. Consider parallelizing retrieval and streaming the answer.
