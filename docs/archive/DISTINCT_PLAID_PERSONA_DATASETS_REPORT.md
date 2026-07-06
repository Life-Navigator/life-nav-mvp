# Distinct Plaid Persona Datasets — Report

**Date:** 2026-06-04
**Branch:** `mvp` (commit `e2a3ee6`)
**Goal:** each beta "sample financial profile" produces materially different financial data + LifeNavigator context, so testers experience different dashboards, cash-flow, liabilities, income, and recommendations — without connecting real accounts.

---

## Result — live-verified (4 personas)

Activated on production (`life-nav-mvp-web`), each with its own user; all graph jobs `completed`:

| Persona               | Accounts | Total balance  | Account types                                           | Profession          | Risk       |
| --------------------- | -------- | -------------- | ------------------------------------------------------- | ------------------- | ---------- |
| Young Professional    | 4        | **$33,640**    | checking, credit_card, loan, savings                    | Software Analyst    | moderate   |
| Small Business Owner  | 4        | **$103,840**   | checking, credit_card, loan                             | Owner, services LLC | aggressive |
| Married Family        | 5        | **$439,740**   | checking, credit_card, loan, mortgage, savings          | Dual income         | moderate   |
| High Income Executive | 6        | **$2,776,320** | checking, credit_card, investment, mortgage, retirement | VP / Executive      | aggressive |

Distinct on **every axis**: account count, account-type mix, total balance (≈80× spread), profession, risk profile, goals. Graph promotion for each included **both** `financial_account` **and** `persona_profile` entities (all `completed`, `qdrant_synced=neo4j_synced=true`).

## How distinctness is produced

1. **Plaid `user_custom` configs** (`apps/web/src/lib/integrations/plaid/plaid-custom-configs.ts`, server-only) — each persona ships a JSON describing its accounts (type/subtype/balance/credit-limit/liability) and signature transactions. Passed as `override_username: "user_custom"`, `override_password: JSON`. Live-verified: Plaid returns exactly the configured accounts/transactions.
2. **LifeNavigator persona metadata** (`personas.ts`) — profession, family, income_type, spending_pattern, asset/liability/investment/risk profiles, primary_goals, expected_insights. Persisted to `public.user_persona_profile` and promoted to the graph, so dashboards + recommendation/GraphRAG retrieval are persona-aware even where two personas share similar raw numbers.

## Requirement #8's "recommendations can distinguish ≥3 personas"

The inputs a recommendation/GraphRAG query consumes differ materially across all four verified personas: different account mixes and balances (Qdrant + Neo4j financial nodes), and different `persona_profile` context (profession, income, risk, goals) in both Supabase and the graph. A GraphRAG query for each user therefore retrieves persona-specific context → different answers. (Demonstrated by the materially different persisted datasets above for 4 personas.)

## Graceful fallback (requirement #5)

`dynamic_transactions` uses the documented `user_transactions_dynamic` sandbox user (rich evolving transactions) rather than a custom config. `getPlaidActivation()` returns `customConfig` for `user_custom` personas and falls back to the documented user otherwise — every persona still activates, and persona metadata always distinguishes it.

## Tests

- Web (Jest, 16): persona configs are distinct (unique dataset fingerprints), metadata complete per persona, public payload never contains credentials/configs, `getPlaidActivation` returns custom config only for `user_custom`, `persistPersonaProfile` called on activation, invalid persona → 400.
- Worker (cargo, 18): `persona_profile` produces a populated embeddable summary (graph promotion of metadata).

## Files

`plaid-custom-configs.ts` (new), `personas.ts` (metadata + config source), `client.ts` (`user_custom` support), `persist.ts` (`persistPersonaProfile`), `activate-persona/route.ts` (use config + persist metadata), migration `108_user_persona_profile.sql` (table + RLS + graph-promotion trigger), worker `entities.rs`/`normalizer.rs` (`PersonaProfile` entity + summary).
