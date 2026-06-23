# WORKING APP VERIFICATION REPORT — 12-step end-to-end smoke

**Date:** 2026-06-06
**Target:** LifeNavigator beta — finance + persona path, single user, advisor chat.
**Repo:** `main` @ `cef74ae` (+ `eaae8e1`)
**Companion reports:** `DATA_PIPELINE_REPAIR_REPORT.md`, `GRAPHRAG_REPROCESSING_REPORT.md`, `CHAT_PERSISTENCE_VERIFICATION.md`

---

## Pre-conditions

These must all be TRUE before starting the smoke. If any one is FALSE, stop and finish the matching operator step first (see `DATA_PIPELINE_REPAIR_REPORT.md` § Operator action checklist).

```
[ ] Operator step A done: Gemini key restaged on worker + api-gateway + edge + Vercel.
    Verified via:
      curl -sS -o /dev/null -w "%{http_code}\n" \
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=$NEW_KEY" \
        -H 'Content-Type: application/json' \
        -d '{"model":"models/gemini-embedding-001","content":{"parts":[{"text":"hi"}]}}'
    → 200

[ ] Operator step B done: Migrations 111 + 112 applied (supabase migration list --linked).

[ ] Operator step C done: Failed jobs reset to 'pending', queue drained < 30 jobs pending.
    Verified via:
      SELECT sync_status, count(*) FROM graphrag.sync_queue GROUP BY sync_status;

[ ] Operator step D done:
      - supabase functions deploy graphrag-query → success
      - git push origin main → Vercel deploy green
      - flyctl deploy on lifenavigator-ingestion-worker → green
      - flyctl status -a lifenavigator-ingestion-worker → image hash bumped

[ ] You have:
      - a test user account with verified email + a populated persona profile
      - that user has at least one linked Plaid account (sandbox is fine)
      - at least one goal row in public.goals (or create one in step 5)
```

---

## The 12 steps

### Step 1 — Sign in

```
URL:    https://lifenavigator-prod.vercel.app/login   (or your prod URL)
Action: sign in with the test account.

Pass:   redirected to /dashboard
        layout sidebar shows ONLY: Dashboard · Chat · Goals & Assessment ·
                                    Scenario Lab · Finance · Settings
        does NOT show: Career, Education, Healthcare, Calendar, Roadmap.
```

If any of those 5 hidden domains appear: `Sidebar.tsx` change didn't deploy. Re-check Vercel build.

### Step 2 — Dashboard top-section

```
On /dashboard, look at:
  * "Today's brief"
  * "Your top moves"

These are persona-driven deterministic (no LLM call). Pass conditions:
  ✓ Both render text (not empty, not "Coming soon").
  ✓ The recommendations reference the user's actual persona archetype
    (visible in Settings · Persona Profile).
```

### Step 3 — Finance domain renders Plaid data

```
URL:    /dashboard/finance

Pass:
  ✓ Net Worth tile shows a real number (not $0, not skeleton).
  ✓ Cash Flow tile shows month income/expense bars.
  ✓ Account list shows the test user's Plaid sandbox accounts with balances.
  ✓ Recent transactions show actual merchant names + amounts.

The route this hits is /api/financial. Look at the network tab — it should
return JSON in < 800 ms with non-empty arrays for accounts + transactions.
```

### Step 4 — Live queue is healthy

```sql
SELECT sync_status, count(*)
  FROM graphrag.sync_queue
 GROUP BY sync_status
 ORDER BY 2 DESC;
```

```
Pass:
  ✓ completed: ≥ 1,000
  ✓ pending:   0-30   (background steady-state)
  ✓ failed:    0-5    (transient retries OK)
```

If `failed` is large again: re-check operator step A (key) and `flyctl logs`.

### Step 5 — Create a goal, see it in the graph

```
1. /dashboard/goals → "Add a goal" → fill out → save.
2. Wait 90 seconds (one worker tick + Neo4j write).
3. SQL check:
     SELECT entity_type, sync_status FROM graphrag.sync_queue
      WHERE entity_type = 'goal' ORDER BY created_at DESC LIMIT 5;
   → expect: top row sync_status = 'completed'
4. Cypher check:
     MATCH (g:Goal) WHERE g.user_id = '<test user uuid>' RETURN g LIMIT 5;
   → expect: 1+ rows
```

If `:Goal` is absent: migration 112 didn't apply OR worker doesn't know
`entity_type='goal'`. Check both.

### Step 6 — Risk assessment writes to the graph

Same as step 5 but for `/dashboard/goals` (risk tab) or wherever the risk
profile lives. Should produce a `:RiskAssessment` node by the same path.

### Step 7 — Advisor chat uses retrieval

```
1. /dashboard/chat → new conversation.
2. Send: "what is my net worth right now?"
3. Wait for reply.

Pass:
  ✓ The reply names the actual number (or a close approximation).
  ✓ The reply does NOT say "I don't have access to your accounts" or
    similar refusal.
  ✓ Network tab: /api/agent/chat returns 200 in < 8s.
```

This proves:

- the Edge function calls graphrag-query
- graphrag-query reads from Qdrant + Neo4j (via worker-loaded data)
- the model gets the user's actual finance state in PERSONAL_CONTEXT
- the assembled prompt does NOT include an empty `CENTRAL_CONTEXT` section
  (open the chat route's debug payload if you want to confirm; the section
  should simply not appear).

### Step 8 — Advisor chat uses graph reasoning

```
Send: "what are my top 3 spending categories last month?"
```

This forces a Cypher path (`MATCH (u:UserProfile)-[:OWNS]->(a:FinancialAccount)
-[:HAS_TRANSACTION]->(t:TransactionSummary) ...`). If transactions are now
`:TransactionSummary` (the entity_type alias fix), the answer will reference
real categories. If they are still `:Unknown`, the answer will be vague.

### Step 9 — Chat persists across refresh

```
1. After step 7/8 lands, hit browser refresh.
2. /dashboard/chat should show the conversation in the left sidebar.
3. Click it → both messages replay in order.

DB check (see CHAT_PERSISTENCE_VERIFICATION.md for full SQL):
  SELECT title, message_count FROM public.chat_conversations
   WHERE user_id = '<test user uuid>'
   ORDER BY last_message_at DESC LIMIT 3;
  → expect: top row with message_count ≥ 4 (two from step 7 + two from step 8)
```

### Step 10 — Domain hiding actually applied

Already covered in step 1. Restating because it's required for the verdict.

```
Pass:
  ✓ Sidebar omits Career, Education, Healthcare, Calendar, Roadmap.
  ✓ Direct URL hits to /dashboard/career etc. either redirect to /dashboard
    or render a placeholder (acceptable — they're flagged comingSoon).
```

### Step 11 — No unexpected errors in logs

```
Vercel Functions logs (last 5 min): no 500s on /api/agent/chat, /api/financial.
Fly worker logs (last 5 min):
  ✓ steady "claimed N jobs" + "processed job <uuid> qdrant=true neo4j=true"
  ✗ no "gemini 401"
  ✗ no "neo4j auth failed"
  ✗ no "qdrant 4xx"
Edge graphrag-query logs (last 5 min): 200s only.
```

### Step 12 — Live graph snapshot

```python
# Neo4j personal counts
MATCH (n) WITH labels(n) AS l, count(*) AS c
RETURN l, c ORDER BY c DESC;

Pass conditions:
  ✓ :TransactionSummary       ≥ 700
  ✓ :FinancialAccount         ≥ 150
  ✓ :PersonaProfile           ≥ 35
  ✓ :Goal                     ≥ 1   (after step 5)
  ✓ :RiskAssessment           ≥ 0-1
  ✓ :Unknown                   0     (after re-label Cypher)
                              OR 233  (if you skipped the relabel — still OK,
                                       just stale legacy nodes)
```

```bash
# Qdrant counts
curl -sS -H "api-key: $QDRANT_API_KEY" "$QDRANT_URL/collections/life_navigator" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"]["points_count"])'

Pass:
  ✓ ≥ 1,000 points  (you can flip to 1,028+ once steps 5-6 add a few more)
```

---

## Verdict matrix

| Step                                   | Pass? | Notes            |
| -------------------------------------- | ----- | ---------------- |
| 1 Sign in + sidebar hides 5 domains    | [ ]   |                  |
| 2 Dashboard brief + top moves render   | [ ]   |                  |
| 3 Finance domain shows real Plaid data | [ ]   |                  |
| 4 Sync queue: completed≥1k, failed<5   | [ ]   |                  |
| 5 New :Goal node appears in Neo4j      | [ ]   |                  |
| 6 New :RiskAssessment node appears     | [ ]   |                  |
| 7 Chat answer uses real net worth      | [ ]   |                  |
| 8 Chat answer uses real categories     | [ ]   |                  |
| 9 Chat persists across refresh         | [ ]   |                  |
| 10 Hidden domains absent from sidebar  | [ ]   | (duplicate of 1) |
| 11 No 5xx, no gemini-401, no auth errs | [ ]   |                  |
| 12 Neo4j + Qdrant counts hit targets   | [ ]   |                  |

---

## Final verdict

```
ALL 12 STEPS PASS  →  WORKING_APP_READY_FOR_20_USER_BETA

ANY FAILURE        →  remain in READY_WITH_P0_FIXES; loop back to the
                      operator action checklist for the failing dimension
                      (see DATA_PIPELINE_REPAIR_REPORT.md).
```

The verdict is binary on purpose. The beta promise is:

- finance domain renders Plaid data,
- persona-driven recommendations appear,
- the advisor can answer questions using real user data,
- chat history persists,
- nothing 5xx's under steady-state load.

If any of those break for the smoke user, they will break worse for the next
19 users.

---

## After the smoke passes — recommended next sprint

Out of scope for this repair sprint, listed here as the obvious next move:

1. **Seed `ln_central`** — small starter corpus on financial planning
   methodology so CENTRAL_CONTEXT actually carries weight. (Re-enable Option A
   from the GraphRAG audit.)
2. **Discovery conversation wiring** — connect the existing discovery /
   need-behind-need engines to a UI surface so onboarding can capture
   second-order drivers.
3. **Career domain** (and the other 4 hidden) — only after the data pipeline
   is verified stable on the finance path.
4. **Drift cleanup** — backport the skipped migrations 061-087 OR document
   them as intentionally retired in a `MIGRATION_LINEAGE.md`.

---

End of `WORKING_APP_VERIFICATION_REPORT.md`.
