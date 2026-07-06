# DATA PIPELINE REPAIR REPORT — Sprint Outcome

**Date:** 2026-06-06
**Repo:** `main` @ `cef74ae` (+ `eaae8e1`)
**Sprint:** Data Pipeline Repair — move LifeNavigator from PARTIAL to WORKING for the finance/persona beta path.
**Companion reports:** `GRAPHRAG_REPROCESSING_REPORT.md`, `CHAT_PERSISTENCE_VERIFICATION.md`, `WORKING_APP_VERIFICATION_REPORT.md`.

---

## Final verdict

```
READY_WITH_P0_FIXES
```

All code-level work for P0-1 through P0-6 is done and committed. Three operator-side steps remain before the platform is verifiably WORKING:

1. **Re-stage a working `GEMINI_API_KEY` on the Fly worker** (the current key is 401 Unauthorized).
2. **Push migrations 111 + 112** to `lifenavigator-production`.
3. **Deploy the updated Edge Function + worker + push the commits to origin/main**.

Once those three operator steps complete, the verdict flips to `WORKING_APP_READY_FOR_20_USER_BETA` automatically — no further code changes needed.

---

## What was done this sprint (code-level)

### Commits

```
cef74ae   fix(pipeline): worker entity_type alias + goals/risk triggers + sidebar re-hide + strip empty CENTRAL_CONTEXT
eaae8e1   fix(pipeline): repair sprint — migration collision, worker label, goals/risk triggers, sidebar, central context
```

(The two commits are split because the first one only captured the file rename — the actual edits landed in `cef74ae`. Both should travel together.)

### Per-P0 outcome

#### P0-1 · Worker Gemini authentication

- **Status:** code path verified clean. **Key re-stage pending operator.**
- **Audit finding (live DB):** 827 of 831 failed sync jobs returned Gemini 401. The Edge Function's key works (chat returns 200). The worker's key digest matches the Fly api-gateway's (`6b4d7e1d5e988cca`) — both are broken; the api-gateway just isn't called for Gemini today so the failure is silent there.
- **Action this sprint:** documented the comparison. Did not print the key. The fix is operational only.
- **Operator action needed:** see "Operator action checklist" below.

#### P0-2 · Re-queue failed jobs

- **Status:** ready to execute. SQL ready. **Will NOT execute until P0-1 lands.** Re-queuing now would just re-fail with the same 401.
- **SQL (operator runs after P0-1):**

```sql
UPDATE graphrag.sync_queue
   SET sync_status = 'pending',
       attempts = 0,
       last_error = NULL
 WHERE sync_status = 'failed'
   AND last_error LIKE 'gemini%';
-- expect: UPDATE 831 (or close)
```

- **Live expected effect:** see `GRAPHRAG_REPROCESSING_REPORT.md`.

#### P0-3 · Audit + clean Neo4j `:Unknown` nodes

- **Status:** **bug located + fixed in code.**
- **Audit finding:** 233 :Unknown nodes — all 233 are `finance.transactions` rows with `entity_type='unknown'`. They are connected to their parents.
- **Root cause:** the postgres trigger emits `entity_type='transaction'`, but the worker's `EntityType` enum only knew `transaction_summary`. `serde_json::from_value` fell back to `EntityType::Unknown` for every transaction, producing the wrong Neo4j label.
- **Fix:** `apps/ingestion-worker/src/entities.rs` — added `#[serde(alias = "transaction")]` to `EntityType::TransactionSummary`.
- **Effect post-deploy:** new transaction jobs label correctly as `:TransactionSummary`. The existing 233 `:Unknown` nodes can be re-labelled with one Cypher query (or simply re-processed via P0-2 — easier, idempotent).
- **Re-label Cypher (optional, after worker redeploys):**

```cypher
MATCH (n:Unknown {entity_type: 'unknown', source_table: 'finance.transactions'})
SET n:TransactionSummary
REMOVE n:Unknown
RETURN count(n);
```

#### P0-4 · Chat persistence

- **Status:** migration ready, push pending.
- **Migration:** previously `107_advisor_chat_history.sql` — collided with team's `107_analytics_grants_and_persona_event.sql`. **Renamed to `111_advisor_chat_history.sql`** (111 is the next free slot after team's 105-110).
- **What it creates:** `chat.conversations` + `chat.messages` + `public.chat_conversations` + `public.chat_messages` views, RLS owner-read + service-write, grants for `authenticated` + `service_role`.
- See `CHAT_PERSISTENCE_VERIFICATION.md` for the post-apply verification plan.

#### P0-5 · Goals + Risk Assessment graph flow

- **Status:** migration ready, push pending.
- **NEW migration `112_goals_risk_graphrag_triggers.sql`:**
  - `public.enqueue_goal_sync()` trigger on `public.goals` (insert/update/delete → enqueue_sync)
  - `public.enqueue_risk_assessment_sync()` trigger on `public.risk_assessments`
  - Backfills currently-existing rows so they hit Neo4j on the next worker tick
- **Post-apply expected:** any new goal or risk row writes a queue job → worker → Neo4j gets `:Goal` / `:RiskAssessment` nodes → Cypher generator's schema lines stop being aspirational.

#### P0-6 · Central GraphRAG v1 decision

- **Status:** **Option B implemented per audit recommendation.**
- **Action:** `buildCentralContext()` in `supabase/functions/graphrag-query/index.ts` now returns `''` when `ln_central` is empty (which it is — 0 points). The CENTRAL_CONTEXT section simply doesn't appear in the assembled prompt instead of appearing with a "no policy retrieved" stub.
- **Why Option B:** the audit found:
  - 0 points in `ln_central`
  - no central source repositories
  - no ingestion pipeline
  - 4-6 h to seed a real corpus
- **Re-enable path (when central content is seeded — v1.1):** single-line revert of the early return.

#### P0-7 · Verify full pipeline

- **Status:** end-to-end smoke pending operator steps.
- See `WORKING_APP_VERIFICATION_REPORT.md` for the trace + expected outputs.

#### P0-8 · Domain visibility

- **Status:** **DONE.**
- `apps/web/src/components/layout/Sidebar.tsx` now hides Career, Education, Healthcare, Calendar, Roadmap (`comingSoon: true`). Visible items: Dashboard, Chat, Goals & Assessment, Scenario Lab, Finance, Settings.

#### P0-9 · Reports

- **Status:** all four deliverables produced (this file + the three companions).

---

## Operator action checklist (in execution order)

### A · Restage worker Gemini key (15 min)

The current worker key returns 401 for both `generateContent` and `embedContent`. You need a key with the **Generative Language API** enabled on its GCP project. Path of least resistance: mint a fresh one at `https://aistudio.google.com/app/apikey`.

```bash
# 1. Mint a fresh key at aistudio.google.com/app/apikey
#    Confirm by hand:
NEW_KEY='...'   # paste the new value here
curl -sS -o /dev/null -w "%{http_code}\n" \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${NEW_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{"model":"models/gemini-embedding-001","content":{"parts":[{"text":"hi"}]}}'
# expect: 200 (NOT 401)

# 2. Stage on worker.
~/.fly/bin/flyctl secrets set GEMINI_API_KEY="$NEW_KEY" -a lifenavigator-ingestion-worker

# 3. Also stage on the api-gateway (its key has the same digest — also broken).
~/.fly/bin/flyctl secrets set GEMINI_API_KEY="$NEW_KEY" -a lifenavigator-api-gateway

# 4. Restage on Supabase Edge Function secrets (verify it's the working value;
#    if chat works on the deployed function today the live one IS already
#    different — leave it alone if /api/agent/chat returns 200 to authenticated
#    requests).
supabase secrets set GEMINI_API_KEY="$NEW_KEY" --project-ref diwkyyahglnqmyledsey

# 5. Restage on Vercel production env (same).
vercel env add GEMINI_API_KEY production --token=$VERCEL_TOKEN

# 6. Force a worker redeploy so it picks up the new secret immediately.
cd apps/ingestion-worker
~/.fly/bin/flyctl deploy --remote-only

# 7. Tail logs and confirm next poll cycle no longer prints "gemini 401".
~/.fly/bin/flyctl logs -a lifenavigator-ingestion-worker
```

### B · Push migrations 111 + 112 (5 min)

```bash
export SUPABASE_ACCESS_TOKEN='<fresh token from supabase.com/dashboard/account/tokens>'
export SUPABASE_DB_PASSWORD='<DB password>'

supabase migration list --linked        # confirm 111 and 112 queued
supabase db push --linked --include-all --dry-run -p "$SUPABASE_DB_PASSWORD"
# review — should list ONLY 111_advisor_chat_history + 112_goals_risk_…

supabase db push --linked --include-all -p "$SUPABASE_DB_PASSWORD"
```

Verify:

```sql
-- chat schema created
SELECT count(*) FROM chat.conversations;   -- 0 (empty, table exists)
SELECT count(*) FROM chat.messages;        -- 0

-- triggers installed
SELECT tgname FROM pg_trigger
 WHERE tgrelid IN ('public.goals'::regclass, 'public.risk_assessments'::regclass)
   AND tgname LIKE 'trigger_graphrag%';
-- expect: trigger_graphrag_goal_sync, trigger_graphrag_risk_assessment_sync

-- backfill enqueued existing goals + risk rows
SELECT entity_type, count(*) FROM graphrag.sync_queue
 WHERE created_at > NOW() - INTERVAL '1 hour'
   AND entity_type IN ('goal','risk_assessment')
 GROUP BY entity_type;
-- expect: a row each, count > 0 if you had goals/risk on file
```

### C · Reset the 831 failed Gemini jobs (1 min)

```sql
UPDATE graphrag.sync_queue
   SET sync_status = 'pending', attempts = 0, last_error = NULL
 WHERE sync_status = 'failed' AND last_error LIKE 'gemini%';
-- expect: UPDATE ≥ 827 (the 401 rows)
```

The worker (now redeployed with the fixed Gemini key + the entity_type alias) will pick them up over the next ~10-15 minutes. Monitor:

```bash
# Watch the worker drain the queue.
watch -n 30 'psql ... -c "SELECT sync_status, count(*) FROM graphrag.sync_queue GROUP BY sync_status"'
```

Expected progression:

```
T+0    pending: 831    completed: 197
T+5    pending: 600    completed: 428
T+10   pending: 100    completed: 928
T+15   pending:   0    completed: 1028    failed: 0
```

(Live counts will differ slightly because there's always ~10-30 background activity.)

### D · Deploy Edge Function + Worker + push to origin (10 min)

```bash
# Edge function (central-context strip)
supabase functions deploy graphrag-query --project-ref diwkyyahglnqmyledsey

# Push commits
git push origin main
# Vercel auto-deploys.

# Worker — already redeployed in step A.
```

### E · End-to-end smoke (5 min)

See `WORKING_APP_VERIFICATION_REPORT.md` for the 12-step smoke checklist.

---

## What's NOT in this sprint

Per the goal ("Do not add new UI · Do not expose additional domains · Do not build career/education/health/family"):

- No new pages built.
- No domain UI work.
- No Plaid Link launcher (that was P0-4 in the prior gap tree; this sprint is data-pipeline only).
- No Discovery conversation wiring (the prior P0-3; deferred to next sprint).
- No `ln_central` corpus seeding (Option A from the audit; deferred to v1.1).

---

End of `DATA_PIPELINE_REPAIR_REPORT.md`.
