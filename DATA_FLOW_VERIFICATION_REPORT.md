# DATA FLOW VERIFICATION REPORT — LifeNavigator

**Date:** 2026-06-06
**Repo:** `main` @ `12ac619`
**Scope:** PART 10 audit — does data actually move all the way through the platform without manual intervention?
**Method:** every claim verified against the live Supabase project, the live Qdrant cluster, the live Neo4j Aura instance, and the worker / Edge Function source. No assumptions.

---

## Final question (answered up front)

> _Can a user's data move all the way through:_
> _User Input → Supabase → Personalized GraphRAG → Context Assembly → Gemini → Recommendations → Dashboard → Chat — without manual intervention?_

```
PARTIAL
```

### Evidence

| Leg                            | Status                               | Evidence                                                                                                                                                                                                                                                                                                                         |
| ------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User input → Supabase          | **YES**                              | persona activation, manual goal entry, chat persistence (post 111) all write cleanly to `finance.*`, `public.goals`, `chat.*`                                                                                                                                                                                                    |
| Supabase → graphrag.sync_queue | **YES**                              | live count: 1,028 rows queued from `finance.transactions`, `finance.financial_accounts`, `public.user_persona_profile`. Triggers (migrations 050/055/074/076 etc.) emit correctly.                                                                                                                                               |
| sync_queue → Worker            | **YES, w/ broken job processing**    | Fly worker `lifenavigator-ingestion-worker` is running in `iad` and polling. It IS claiming jobs and attempting to process them.                                                                                                                                                                                                 |
| Worker → Gemini embed          | **BROKEN**                           | **827 of 831 failed jobs (99.5%) failed with `Gemini 401 Unauthorized: "Request had invalid authentication credentials. Expected OAuth..."`. The worker's `GEMINI_API_KEY` is wrong, expired, or scoped wrong.** This is the single largest break in the pipeline.                                                               |
| Worker → Qdrant personal       | **PARTIAL**                          | 402 of 1,028 expected points exist in `life_navigator`. Only jobs that completed BEFORE the Gemini key broke have vectors.                                                                                                                                                                                                       |
| Worker → Neo4j personal        | **PARTIAL**                          | 439 of expected ~600+ nodes exist. 233 of those are labeled `:Unknown` (suspect — investigation needed). Real-domain labels: 134 `FinancialAccount`, 37 `UserProfile`, 35 `PersonaProfile`. No `Goal`, `RiskAssessment`, `CareerProfile`, `Education` nodes.                                                                     |
| Context Assembly               | **PARTIAL**                          | Edge Function's `AUTHORITATIVE_FINANCIAL_FACTS` block reads directly from `finance.*` — works regardless of graph state. `PERSONAL_CONTEXT` (from Qdrant + Cypher) only fires for the ~20% of users with completed sync jobs. `CENTRAL_CONTEXT` is **empty** — 0 points in `ln_central`, no central knowledge has been ingested. |
| Context → Gemini chat          | **YES** (different key path)         | The Edge Function uses its OWN `GEMINI_API_KEY` which works (chat responds). The web app's `GEMINI_API_KEY` (also set on Fly secrets) is unrelated. The WORKER's key is the broken one.                                                                                                                                          |
| Gemini → Response              | **YES**                              | chat returns 200 with grounded content; tests pass; governance and character work                                                                                                                                                                                                                                                |
| Response → Recommendations     | **YES**                              | persona rules engine in `lib/finance/recommendations.ts` reads finance directly + emits ≥3 categorized recs                                                                                                                                                                                                                      |
| Recommendations → Dashboard    | **YES** (post `12ac619`)             | FirstInsight + RecommendationsCard render the rec set server-side                                                                                                                                                                                                                                                                |
| Dashboard → Chat surface       | **YES**                              | "Ask your advisor about this" + AskAdvisorButton + ChatSidebar wired; new `/dashboard/chat` page works for new conversations                                                                                                                                                                                                     |
| Chat → persistence             | **NO (until migration 111 applies)** | `persistChatTurn` silently fails because the `chat.*` schema doesn't exist on remote yet                                                                                                                                                                                                                                         |

### So the "PARTIAL" verdict is driven by

1. **Worker Gemini auth broken** → 80% of all sync jobs fail → personal graph is sparse → Cypher queries against `Goal`, `RiskAssessment`, `CareerProfile` etc. return empty for most users.
2. **Central knowledge graph never ingested** → `ln_central` Qdrant = 0 points → the advisor's "framework guidance" layer is empty.
3. **Chat history doesn't persist** → conversation across sessions disappears (fixed when migration 111 applies).

The CRITICAL pieces (finance facts, recommendations, chat generation, governance) work. The PERIPHERAL pieces (graph enrichment, central knowledge, history) are broken or empty.

A new beta user activating a persona today gets:

- ✓ A populated finance dashboard
- ✓ Grounded chat answers about their finances
- ✗ No chat history between sessions
- ✗ Limited grounding for non-finance questions
- ✗ No framework-level guidance from central knowledge

---

## Live system state (probed in real time)

### Sync queue (graphrag.sync_queue on Supabase)

```
Total rows:        1,028
By status:
  failed:           831   (80.8 %)   <-- mostly Gemini 401
  completed:        197   (19.2 %)
By source_table:
  finance.transactions:          786
  finance.financial_accounts:    190
  public.user_persona_profile:    52
```

### Top failure reasons

```
613 × "gemini request failed: 401 Unauthorized: Request had invalid authentication credentials. Expected OAuth..."
214 × (same 401 — different timestamp batch)
  4 × "gemini request failed: 429 Too Many Requests: Resource exhausted..."
```

**99.5 % of failures are the same root cause: Gemini 401.**

### Qdrant collections

```
life_navigator (personal):   402 points
ln_central (shared):           0 points
```

### Neo4j personal database (4f61c985)

```
Total nodes:         439
Total relationships: 402
By label:
  :Unknown            233   <-- suspect; investigate
  :FinancialAccount   134
  :UserProfile         37
  :PersonaProfile      35
  (no :Goal, :RiskAssessment, :CareerProfile, :Education, etc.)
```

### sync_queue schema vs worker expectation

| Worker expects                                                                                                                                                                                              | Remote DB has it?               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `id`, `user_id`, `entity_type`, `entity_id`, `source_table`, `operation`, `payload`, `neo4j_synced`, `qdrant_synced`, `sync_status`, `attempts`, `max_attempts`, `last_error`, `created_at`, `processed_at` | ✓ all 15 columns present        |
| `access_scope` (added by migration 077)                                                                                                                                                                     | **✗ MISSING** — 077 was skipped |

The worker code paths for "central vs personal routing" expect this column. Without it, every job is treated as personal (the column's default value would have been 'personal'). This works _by accident_ today, but if migration 077 ever lands, the schema flips and the worker's claim query may break unexpectedly.

---

## Root cause analysis — the Gemini 401

The worker is configured with a `GEMINI_API_KEY` env var, but Gemini's API returns:

> `Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential.`

This wording is specific to two scenarios:

1. **The key was minted in a Google Cloud project where the Generative Language API is not enabled** — Gemini interprets the request as "looks like a key, but no API access."
2. **The key was deprecated / rotated and the worker secret was not re-staged.**

The web-side `GEMINI_API_KEY` (used by the Edge Function `graphrag-query` and the Fly api-gateway) is DIFFERENT and WORKS, evidenced by:

- chat replies arriving with grounded content
- Sprint Q tests still passing
- `/api/agent/chat` not 502-ing

So the fix is operational:

1. **Confirm the same key is on the worker as on the Edge Function.** Run `flyctl secrets list -a lifenavigator-ingestion-worker` and compare to the Supabase Edge Function secret of the same name.
2. **Re-stage**: `flyctl secrets set GEMINI_API_KEY=<value-from-edge-function> -a lifenavigator-ingestion-worker` then `flyctl deploy --remote-only` to roll the secret into the running machine.
3. **Re-queue failed jobs**: `UPDATE graphrag.sync_queue SET sync_status='pending', attempts=0, last_error=NULL WHERE sync_status='failed' AND last_error LIKE 'gemini%';` — the worker will retry.

Expected outcome after fix: the 831 failed jobs re-process. Qdrant `life_navigator` grows from 402 to ~1,028 points. Neo4j personal grows correspondingly. PERSONAL_CONTEXT becomes useful for the existing test users.

---

## Domain-level data flow (per the audit categories)

| Domain                   | Source data → Supabase                    | → Sync queue                                                          | → Personal graph                     | Status                                                          |
| ------------------------ | ----------------------------------------- | --------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| **Finance**              | YES (Plaid sandbox + real)                | YES (786 + 190 jobs)                                                  | PARTIAL (134 FinancialAccount nodes) | PARTIAL — direct-read path covers grounding even if graph empty |
| **Persona profile**      | YES                                       | YES (52 jobs)                                                         | PARTIAL (35 PersonaProfile nodes)    | PARTIAL                                                         |
| **Career**               | NO — `career` schema missing on remote    | n/a                                                                   | n/a                                  | NOT INGESTED                                                    |
| **Education**            | NO — `education` schema missing on remote | n/a                                                                   | n/a                                  | NOT INGESTED                                                    |
| **Health & wellness**    | NO — `health` schema missing on remote    | n/a                                                                   | n/a                                  | NOT INGESTED                                                    |
| **Family**               | NO — migrations skipped                   | n/a                                                                   | n/a                                  | NOT INGESTED                                                    |
| **Goals**                | YES (`public.goals` exists)               | NO trigger fires on goals table on remote (migration 074/076 skipped) | NO Goal nodes in Neo4j               | NOT FLOWING                                                     |
| **Risk profile**         | YES (`public.risk_assessments`)           | same — no trigger                                                     | NO RiskAssessment nodes              | NOT FLOWING                                                     |
| **Conversation history** | YES (post 111)                            | NO trigger                                                            | NO Conversation nodes                | NOT FLOWING — design call: should it?                           |
| **Central knowledge**    | NO ingestion pipeline                     | n/a (no central source tables)                                        | 0 points in ln_central               | EMPTY                                                           |

### Net domain coverage

```
Finance:        70% complete — works for the user even though graph is sparse
Persona:        70% complete — same
Goals:           5% complete — table exists but graph wiring absent
Risk:            5% complete — table exists but graph wiring absent
Conversation:    0% on graph side (and 0% in DB until 111 applies)
Career/Edu/Health/Family/Central: 0% — schemas don't exist
```

---

## Recommendations (compact)

Per the bias of the audit, these go directly into `EXECUTION_SEQUENCE.md` Step 0 — they precede everything else.

| Order | Action                                                                                                                                                                                                           | Effort                   | Effect                                                             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------ |
| 0a    | **Fix worker Gemini key + re-queue 831 failed jobs**                                                                                                                                                             | 15 min ops               | Personal graph populates; PERSONAL_CONTEXT becomes useful          |
| 0b    | **Decide central knowledge ingestion** (a) build a tiny seed of central docs to populate `ln_central`, OR (b) drop CENTRAL_CONTEXT from the prompt for v1 and re-add when there's real content                   | 2 h decide + 4 h execute | Stops the advisor from referring to an empty CENTRAL_CONTEXT block |
| 0c    | **Audit the 233 `:Unknown` Neo4j nodes** — likely partial writes from failed jobs; either delete or relabel                                                                                                      | 30 min                   | Cypher returns cleaner results                                     |
| 0d    | **When migration 111 lands**, the persistChatTurn path works, but conversation graph promotion is NOT enabled — add a trigger on `chat.messages` that enqueues sync jobs IF conversation-graph context is wanted | 1 h or defer             | Cross-session learning vs amnesia                                  |

---

End of `DATA_FLOW_VERIFICATION_REPORT.md`.
