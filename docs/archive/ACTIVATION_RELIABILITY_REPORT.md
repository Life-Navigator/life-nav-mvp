# Activation Reliability Audit — LifeNavigator 10-Persona Beta

**Scope:** the "sample financial profile" activation path for a 20-non-technical-user internal beta, target **99% activation success**. Every claim below is grounded in code I read and, for First Insight, in the real engine executed against each persona's dataset.

## How activation actually works (traced)

`POST /api/integrations/plaid/activate-persona` (`apps/web/src/app/api/integrations/plaid/activate-persona/route.ts`) runs, in order:

1. **Auth + validation** — `supabase.auth.getUser()` (401 if absent), JSON parse (400), `isValidPersonaId` (400), Plaid creds env check (503). (`route.ts:37-62`)
2. **Sandbox token flow** — `createSandboxPublicToken` then `exchangePublicToken`. For the 9 custom personas this passes `override_username:"user_custom", override_password:JSON.stringify(config)` (`client.ts:51-56`); `dynamic_transactions` uses the documented `user_transactions_dynamic` user.
3. **Persist item** — `persistPlaidItem` upsert into `finance.plaid_items` (`persist.ts:100-128`). **Throws on error** → activation 500s.
4. **Persist accounts** — `getAccounts` then `persistAccounts` upsert into `finance.financial_accounts` with `account_type` from `mapAccountType` (`persist.ts:131-159`). **Throws on error.**
5. **Persist transactions** — wrapped in its own try/catch that only `console.warn`s (`route.ts:98-104`); non-fatal by design.
6. **Persist persona profile** — `persistPersonaProfile` upsert into `public.user_persona_profile` (`persist.ts:69-98`). **Throws on error** → activation 500s.
7. **`setup_completed = true`** on `profiles` — failure only `console.warn`s (`route.ts:116`).
8. **Audit event** — `recordUserEvent(... 'sample_financial_profile_activated')`; fully best-effort (swallowed, `events.ts:66`).
9. **Best-effort first recommendation** — `fetch(... /api/recommendations/generate, body:{trigger})` with `.catch(()=>{})` inside a try/catch (`route.ts:137-155`).

## Per-persona reliability matrix

First Insight columns are **verified**: I executed the real `getFirstInsight` engine twice per persona — once with transactions persisted (matches the existing `first-insight-personas.test.ts`) and once with **txns=0** (the documented live sandbox condition where `transactions_synced:0`).

| Persona                  | Activation | Dashboard (finance.\* rows) | Graph promotion        | First Insight (live, txns=0)                                                                               | Reco on activation | Chat |
| ------------------------ | ---------- | --------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------ | ---- |
| young_professional       | PASS       | PASS (4 accts)              | RISK (fire-and-forget) | PASS `[neutral] No retirement account…`                                                                    | **FAIL** (422)     | PASS |
| small_business_owner     | PASS       | PASS (4 accts)              | RISK                   | PASS `[caution] No retirement account…`                                                                    | **FAIL** (422)     | PASS |
| married_family           | PASS       | PASS (5 accts)              | RISK                   | PASS `[caution] No retirement account…`                                                                    | **FAIL** (422)     | PASS |
| salary_plus_bonus        | PASS       | PASS (4 accts)              | RISK                   | PASS `[positive] $242,200 in savings & investments…`                                                       | **FAIL** (422)     | PASS |
| high_income_executive    | PASS       | PASS (6 accts)              | RISK                   | PASS `[positive] managing $1,533,200 … alongside a $1,240,000 mortgage` (txns-present would say idle-cash) | **FAIL** (422)     | PASS |
| credit_rebuilding        | PASS       | PASS (3 accts)              | RISK                   | PASS `[risk] credit cards are 92% used…`                                                                   | **FAIL** (422)     | PASS |
| gig_worker               | PASS       | PASS (3 accts)              | RISK                   | PASS `[positive] $44,100 in savings & investments…`                                                        | **FAIL** (422)     | PASS |
| earned_wage_access       | PASS       | PASS (2 accts)              | RISK                   | PASS `[risk] credit cards are 55% used…`                                                                   | **FAIL** (422)     | PASS |
| bank_income              | PASS       | PASS (3 accts)              | RISK                   | PASS `[caution] No retirement account…`                                                                    | **FAIL** (422)     | PASS |
| **dynamic_transactions** | RISK       | **RISK (unverified accts)** | RISK                   | **RISK (unverified, not in test matrix)**                                                                  | **FAIL** (422)     | PASS |

**Key positive result:** the First Insight rule ladder (`first-insight.ts:108-196`) always terminates in a rule-6 net-worth fallback, so **every custom persona yields a specific, true, `has_data:true` insight even when transactions don't persist.** The much-feared txns=0 condition does **not** degrade First Insight to the empty state. Only `high_income_executive` flips rule (idle-cash → positive fallback); both lines are accurate and presentable.

## Findings

### P0-1 — First recommendation is dead-on-arrival for all 10 personas (schema mismatch)

`route.ts:149` posts `body: JSON.stringify({ trigger: 'financial_profile_activation' })` to `/api/recommendations/generate`. The gateway handler binds `GenerateBody(QueryRequest)` where `query: str = Field(min_length=1, max_length=4000)` is **required** (`apps/api-gateway/app/routes/recommendations.py:27,42`; `apps/api-gateway/app/schemas/common.py:9-12`). With no `query` field, FastAPI returns **422 every time**. The call is wrapped in `.catch(()=>{})` and an outer try/catch (`route.ts:151-154`), so the failure is invisible: no recommendation is generated, and `recommendation_generated` is never recorded. The "kick off a first recommendation" behavior is non-functional for the entire beta. **Likely failure rate of this sub-step: 100%.**
**Fix:** send a real query, e.g. `body: JSON.stringify({ query: 'Give me a first recommendation based on my financial profile', domain: 'finance' })`. Optionally surface a non-2xx as a logged warning instead of `.catch(()=>{})` so this class of regression is caught.

### P0-2 — `dynamic_transactions` persona is unverified and unpredictable

It is the only persona with **no custom config** (`plaid-custom-configs.ts:389-390`) and uses the documented `user_transactions_dynamic` sandbox user (`personas.ts:266-284`). Its accounts, balances, account-type mix, and therefore its First Insight are not covered by `first-insight-personas.test.ts` (which iterates `Object.keys(PLAID_CUSTOM_CONFIGS)` — this persona is absent). For a non-technical beta we cannot assert what insight or dashboard a tester sees.
**Fix:** either exclude `dynamic_transactions` from the public picker (`listPublicPersonas`) for the beta, or give it a custom config so its dataset is deterministic and testable.

### P1-1 — Activation funnel events depend on migration 109 being applied

The analytics CHECK whitelist in migration 098 does **not** include `sample_financial_profile_activated` or `first_insight_viewed` (`supabase/migrations/098*.sql:21-38`); those are added only in migration 109 (`109_funnel_event_types.sql:18-21`). If 109 is not applied in prod, the audit insert at `route.ts:119` and the dashboard `first_insight_viewed` insert (`dashboard/page.tsx:27`) both violate the CHECK. They are swallowed by `recordUserEvent`'s try/catch (`events.ts:55-68`), so **activation survives but the beta funnel silently loses its core conversion events** — you'd be flying blind on activation rate.
**Fix:** verify 109 is applied in prod before launch; add a startup assertion or smoke check that `analytics.is_event_type('sample_financial_profile_activated')` returns true.

### P1-2 — Partial-activation trap if `persistPersonaProfile` throws after finance.\* committed

PostgREST executes steps 3–7 as **separate statements**, each auto-committing. If `persistPersonaProfile` throws (e.g., `public.user_persona_profile` missing because migration 108 wasn't applied, or an RLS/grant gap), activation 500s at `route.ts:108` **after** `finance.financial_accounts`/`transactions` are already written and **before** `setup_completed=true` (`route.ts:112-115`). The user now has finance data but `setup_completed=false`, so `middleware.ts:106-109` permanently redirects them to `/onboarding/financial-profile`. Re-activating re-runs cleanly (all writes are idempotent upserts on `plaid_item_id`/`plaid_account_id`/`user_id`), so it self-heals on retry — but a non-technical user won't know to retry.
**Fix:** verify migration 108 applied; consider moving `setup_completed=true` to run even when persona-profile persistence fails, or wrap steps 4/6/7 so a profile-write failure still marks setup complete (the dashboard insight works from finance.\* alone).

### P2-1 — Graph promotion is fire-and-forget by design (acceptable, but invisible)

Writing `finance.financial_accounts` fires `graphrag.trigger_financial_account_sync` (`050_graphrag.sql:188-216`), which calls `enqueue_sync` (a synchronous INSERT into `graphrag.sync_queue`, `050_graphrag.sql:60-86`) **inside the same transaction**. Crucially the trigger body has `EXCEPTION WHEN OTHERS THEN RAISE NOTICE … RETURN NEW` (`050_graphrag.sql:208-211`), so a queue-insert failure **does not roll back the account write** — good for activation reliability. The downside: actual promotion to Neo4j/Qdrant is performed asynchronously by the Rust worker, with no activation-time signal. The route returns `graph_promotion: 'enqueued'` (`route.ts:162`) regardless of whether the worker ever drains the queue. Chat/GraphRAG quality therefore lags activation and can be empty if the worker is down. This is the right tradeoff for activation success but should be monitored.
**Fix:** add a lightweight worker-queue-depth / oldest-pending-age alert; the persona-profile trigger (`108:47-68`) has the same swallow-and-continue pattern and is also subject to this.

### P2-2 — `AbortSignal.timeout(20_000)` on the reco fetch

`route.ts:150` uses `AbortSignal.timeout`. Even once P0-1 is fixed and the body is valid, a slow/cold gateway can take the full 20s; because the fetch is `await`ed before the success response is returned (`route.ts:143`), a hung gateway adds up to 20s to perceived activation latency for non-technical users. Consider firing it without awaiting, or lowering the timeout.

### P3-1 — Sandbox access token stored unencrypted

`persistPlaidItem` stores the raw token in `access_token_encrypted` (`persist.ts:117-119`). The comment notes sandbox tokens are non-sensitive; flagged only so the real-Plaid path doesn't inherit this.

## Quantifying the gap to 99%

- **Activation itself** (token flow + finance.\* persist + setup_completed): for the 9 custom personas this is high-reliability. The realistic failure modes are (a) transient Plaid sandbox/network errors on `createSandboxPublicToken`/`exchangePublicToken`/`getAccounts` (no retry wrapper on these calls — a single transient failure 500s the whole activation), and (b) the P1-2 partial-activation trap if migration 108/grants are missing. With migrations confirmed and 1 user-driven retry, custom-persona activation should comfortably exceed 99%. **Adding a retry/backoff around the three Plaid client calls is the single highest-leverage activation-reliability fix.**
- **Dashboard population:** PASS for custom personas (verified the rows persist.ts writes map to types First Insight reads). RISK for `dynamic_transactions`.
- **First Insight:** **PASS for all 9 custom personas in both txns modes** — the strongest part of the system.
- **Reco on activation:** **0% currently** (P0-1). Does not block activation, but the feature is silently broken.
- **Chat:** activation-independent; gated by the separately-documented intermittent graphrag-query 502 (out of scope here).

**Bottom line:** activation and First Insight clear the 99% bar for the 9 custom personas once Plaid-call retries are added and migrations 108/109 are confirmed. The two must-fix items before inviting 20 users are **P0-1 (broken reco call)** and **P0-2 (hide/define `dynamic_transactions`)**, plus **verifying migrations 108 and 109 are live in prod** (P1-1/P1-2).
