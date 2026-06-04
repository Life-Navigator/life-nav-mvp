# Plaid Sandbox Persona — Implementation Report

**Date:** 2026-06-03
**Branch:** `mvp`
**Goal:** a non-technical beta user picks a sample financial profile from a dropdown and experiences LifeNavigator's financial intelligence — without ever seeing Plaid, usernames, passwords, or developer language.

---

## Summary

Beta users select a friendly "sample financial profile." The server looks up that persona's Plaid **sandbox** credentials, runs the sandbox token flow, persists the synthetic data into the `finance` schema (which auto-promotes it into the personal knowledge graph), writes an audit event, and best-effort kicks off a first recommendation. **No sandbox credentials ever reach the browser.**

### What was built

| File                                                                | Purpose                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/integrations/plaid/personas.ts`                   | **Server-only** registry of 10 personas (full fields incl. sandbox creds) + `toPublicPersona` / `listPublicPersonas` / `getPersona` / `isValidPersonaId`. `import 'server-only'` makes the build fail if a Client Component imports it. |
| `apps/web/src/lib/integrations/plaid/client.ts`                     | Added `createSandboxPublicToken` (sandbox `public_token/create` with `override_username/password`), `getInvestments`, `getLiabilities`.                                                                                                 |
| `apps/web/src/lib/integrations/plaid/persist.ts`                    | **Server-only** persistence into `finance.*` via service role: `persistPlaidItem`, `persistAccounts` (fires graph promotion), `persistTransactions`, `mapAccountType`.                                                                  |
| `apps/web/src/app/api/integrations/plaid/personas/route.ts`         | `GET` — returns **public** persona list only (auth required).                                                                                                                                                                           |
| `apps/web/src/app/api/integrations/plaid/activate-persona/route.ts` | `POST { persona_id }` — validates, sandbox flow, persist, audit, best-effort recommendation.                                                                                                                                            |
| `apps/web/src/components/onboarding/SampleFinancialProfile.tsx`     | Client UI: dropdown + description/goals/complexity + beta & safety copy + "Activate Financial Profile".                                                                                                                                 |
| `apps/web/src/app/onboarding/financial-profile/page.tsx`            | Onboarding step page.                                                                                                                                                                                                                   |
| `supabase/migrations/105_finance_graphrag_api_grants.sql`           | **Foundation fix** — grants the API roles access to `finance`/`graphrag` (see below). Applied to the live DB.                                                                                                                           |
| `apps/web/src/app/api/integrations/plaid/exchange/route.ts`         | **Foundation fix** — the existing route wrote to a non-existent `public.plaid_items`; now writes `finance.plaid_items` with correct columns via the shared helper.                                                                      |
| tests                                                               | `…/plaid/__tests__/personas.test.ts`, `…/integrations/plaid/__tests__/activate-persona.test.ts`                                                                                                                                         |

### Activation flow (`POST /api/integrations/plaid/activate-persona`)

1. Auth (`createServerSupabaseClient` cookie session). 401 if absent.
2. Validate `persona_id` against the registry → **400 on unknown**.
3. `getPersona()` → sandbox creds (server-side only).
4. `createSandboxPublicToken({ institutionId, products, username, password })` → public token (no Link UI).
5. `exchangePublicToken()` → access token + item id.
6. `persistPlaidItem` → `finance.plaid_items` (service role).
7. `getAccounts` → `persistAccounts` → `finance.financial_accounts`. **This fires `trigger_financial_account_sync` → `graphrag.sync_queue` → the Rust worker promotes the account into Neo4j + Qdrant** (the "financial activation job" / graph promotion).
8. `getTransactions` (30d) → `persistTransactions` → `finance.transactions` (non-fatal if sandbox lags).
9. `recordUserEvent('sample_financial_profile_activated')` → `analytics.user_events` (audit).
10. Best-effort `POST {NEXT_PUBLIC_API_URL}/api/recommendations/generate` (first recommendation; the governed path writes `economic.usage_events` when a model is called). Never fails activation.
11. Returns `{ success, persona_id, accounts_linked, transactions_synced, graph_promotion: 'enqueued' }`.

## Credential safety (requirements #3, #4, #7, #8)

- Sandbox usernames/passwords live ONLY in `personas.ts`, guarded by `import 'server-only'`.
- The browser receives only `{ persona_id, display_name, description, goals, complexity, life_stage }` (via `toPublicPersona`).
- Beta copy: _"Use a sample financial profile to explore LifeNavigator without connecting real accounts."_
- Safety copy: _"No real bank credentials are used during this beta experience."_
- Tests assert the public payload and the client component contain none of the sandbox secrets.

## Foundation fixes (were blocking ALL financial features)

1. **`finance`/`graphrag` API grants** — both schemas were PostgREST-exposed but the API roles had no table grants, so every REST call returned **403** (even service_role). `105_finance_graphrag_api_grants.sql` grants the minimum needed; applied live (verified `finance.financial_accounts` now returns 200).
2. **Broken `plaid_items` writes** — the existing `exchange` route targeted `public.plaid_items` (doesn't exist; tables are in `finance`) with wrong column names (`item_id`/`access_token` vs `plaid_item_id`/`access_token_encrypted`). Fixed via the shared `persistPlaidItem` helper.

## Tests (Jest) — **11/11 passing**

- `personas.test.ts`: all 10 personas present + unique; every persona has server creds; `getPersona`/`isValidPersonaId` accept/reject correctly; `toPublicPersona` strips creds; serialized public list contains **no** sandbox secrets; registry is `server-only`; client component has no sandbox passwords.
- `activate-persona.test.ts`: **invalid persona_id → 400**; unauthenticated → 401; Plaid-not-configured → 503; valid persona → sandbox token exchanged, accounts persisted (= activation/graph-promotion job), audit event written.

Mapped to the requested test list: ✅ frontend never contains sandbox passwords · ✅ invalid persona_id rejected · ✅ persona selection creates financial activation job (persistAccounts → sync trigger) · ✅ sandbox token exchange works · ✅ account sync works · ✅ audit event written. Live-only (post-Plaid-creds smoke): dashboard has financial data, economic usage event on model call.

## Go-live prerequisites (still required)

1. **Plaid sandbox credentials on Vercel** (`life-nav-mvp-web`): `PLAID_CLIENT_ID`, `PLAID_CLIENT_SECRET`, `PLAID_ENV=sandbox`. They are NOT currently set; the values live only in Supabase Edge Function secrets and can't be read back. Until set, `activate-persona` returns a clean 503 ("Sample financial profiles are not available yet").
2. **Redeploy `life-nav-mvp-web`** from `mvp` so the new routes/page ship to production.
3. Then a **live activation smoke**: select a persona → 200 → `finance.financial_accounts` populated → `graphrag.sync_queue` job created → audit row.

## Known follow-ups (non-blocking, documented)

- The read routes `accounts`/`transactions`/`disconnect` still target the old `public` schema; they need the same `.schema('finance')` fix (and ideally should read the persisted `finance.*` data) for the dashboard to render from persisted persona data rather than live Plaid. To be done/verified during the live smoke.
- Exact Plaid sandbox `override_username` per persona can be refined in `personas.ts` (single source of truth); most use the universal `user_good`, with `user_bank_income` / `user_transactions_dynamic` for those profiles. `plaid_profile_label` records the intended Plaid profile.
- Sandbox access tokens are stored in `access_token_encrypted` as-is (non-sensitive test tokens); the real-Plaid path should encrypt via `core.encrypt_text`.
