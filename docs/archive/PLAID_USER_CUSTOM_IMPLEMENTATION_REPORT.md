# Plaid `user_custom` Implementation Report

**Date:** 2026-06-04
**Branch:** `mvp` (commit `e2a3ee6`)

---

## Mechanism (verified live)

Plaid Sandbox's `override_username` only accepts specific documented users (`user_good`, `user_transactions_dynamic`, …) — arbitrary names return `INVALID_CREDENTIALS`. To produce **bespoke** datasets, use **`user_custom`**:

```
POST /sandbox/public_token/create
{ institution_id, initial_products:["transactions"],
  options: { override_username: "user_custom",
             override_password: "<JSON config>" } }
```

Verified against `sandbox.plaid.com` with these creds: a config with two accounts returned exactly **Everyday Checking $4,200** + **Rewards Card $1,240 / $8,000 limit** and the configured transactions (ACME PAYROLL, Shell). So the `override_password` JSON drives the account mix, balances, credit limits, and signature cash-flow.

## Config schema used

```jsonc
{ "override_accounts": [
  { "type": "depository", "subtype": "checking", "starting_balance": 3200,
    "meta": { "name": "Everyday Checking" },
    "transactions": [
      { "date_transacted": "2026-05-31", "date_posted": "2026-05-31",
        "amount": -2150, "description": "EMPLOYER PAYROLL", "currency": "USD" }
    ] },
  { "type": "credit", "subtype": "credit card", "starting_balance": 640,
    "meta": { "name": "Cash Rewards Card", "limit": 5000 },
    "liability": { "type": "credit", "credit": { "aprs": [...], "minimum_payment_amount": 35 } },
    "transactions": [...] }
] }
```

Plaid convention: a positive transaction `amount` = money out. `type`/`subtype` map to our `finance.financial_accounts.account_type` via `mapAccountType()` (checking/savings/credit_card/investment/retirement/loan/mortgage).

## Where it lives

| File                                                                | Role                                                                                                                                                                       |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/integrations/plaid/plaid-custom-configs.ts`       | **server-only** per-persona configs (9 `user_custom`; `dynamic_transactions` documented)                                                                                   |
| `apps/web/src/lib/integrations/plaid/client.ts`                     | `createSandboxPublicToken({ customConfig })` → `override_username:"user_custom"`, `override_password:JSON.stringify(config)`; falls back to documented user when no config |
| `apps/web/src/lib/integrations/plaid/personas.ts`                   | `getPlaidActivation(persona)` → `{ username, password, customConfig }`                                                                                                     |
| `apps/web/src/app/api/integrations/plaid/activate-persona/route.ts` | passes the config; persists accounts/transactions + persona metadata                                                                                                       |

## Security

`user_custom` JSON and all sandbox credentials are confined to the two `server-only` modules (`import 'server-only'` → build fails if a Client Component imports them). The browser receives only public persona fields. Jest asserts the public payload contains none of `pass_good` / `user_custom` / `override_accounts` / `override_password` / `starting_balance`.

## Graceful fallback (requirement #5)

If a persona has no custom config, `getPlaidActivation` returns `customConfig: null` and uses the documented user named by `plaid_config_source`; the persona still activates and is distinguished by its Supabase persona metadata (career/income/risk/goals) on the dashboard + in recommendations.

## Liabilities / investments

The configs include `liability` blocks (APRs, minimum payments, overdue flags) and investment/retirement account subtypes (brokerage, 401k, IRA, money market) so liability and investment profiles differ across personas. Deeper liability/holdings detail (per-security holdings, full amortization) can be added to the same configs (Plaid `user_custom` supports `holdings`, `investment_transactions`, richer `liability` objects) without other code changes.

## Verification

- Live: 4 personas activated on production → materially different account sets/balances ($33,640 → $2,776,320), distinct type mixes, graph promotion `completed` for both `financial_account` and `persona_profile`. See `DISTINCT_PLAID_PERSONA_DATASETS_REPORT.md`.
- Tests: web 16/16 Jest, worker 18/18 cargo; `next build` green.
