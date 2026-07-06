# Beta Financial Persona Registry

**Date:** 2026-06-03
**Source of truth:** `apps/web/src/lib/integrations/plaid/personas.ts` (server-only)

The 10 sample financial profiles offered in the beta. The **left columns are what beta users see**; the **right columns are server-only** Plaid sandbox wiring that never leaves the server.

| persona_id              | Display name (user sees)     | Complexity | Life stage     | Plaid profile (server)   | Sandbox user (server)       | Products     |
| ----------------------- | ---------------------------- | ---------- | -------------- | ------------------------ | --------------------------- | ------------ |
| `young_professional`    | Young Professional           | Simple     | early_career   | Yuppie                   | `user_good`                 | transactions |
| `small_business_owner`  | Small Business Owner         | Complex    | business_owner | Small Business           | `user_good`                 | transactions |
| `married_family`        | Married Family               | Moderate   | family         | Joint Account            | `user_good`                 | transactions |
| `high_income_executive` | High Income Executive        | Complex    | peak_earning   | Excellent Credit Profile | `user_good`                 | transactions |
| `credit_rebuilding`     | Credit Rebuilding Profile    | Moderate   | recovery       | Poor Credit Profile      | `user_good`                 | transactions |
| `gig_worker`            | Gig Worker / Consultant      | Moderate   | self_employed  | Good Credit Profile      | `user_good`                 | transactions |
| `salary_plus_bonus`     | Salary + Bonus Professional  | Moderate   | mid_career     | Salary with Bonuses      | `user_good`                 | transactions |
| `earned_wage_access`    | Earned Wage Access Worker    | Simple     | hourly_worker  | Earned Wage Access       | `user_good`                 | transactions |
| `bank_income`           | Bank Income Profile          | Moderate   | general        | Bank Income              | `user_bank_income`          | transactions |
| `dynamic_transactions`  | Dynamic Transactions Profile | Moderate   | general        | Dynamic Transactions     | `user_transactions_dynamic` | transactions |

Password for every persona: Plaid's universal sandbox password `pass_good` (server-only). Default institution: `ins_109508` (First Platypus Bank, sandbox).

## Fields per persona

**Public (returned to the browser):** `persona_id`, `display_name`, `description`, `goals` (from `expected_goals`), `complexity` (from `financial_complexity`), `life_stage`.

**Server-only (never serialized):** `plaid_profile_label`, `plaid_sandbox_user`, `plaid_sandbox_password`, `plaid_products`, `institution_id`.

## Expected goals (shown as "What you can explore")

- **Young Professional:** Build an emergency fund · Start investing · Pay down student debt
- **Small Business Owner:** Smooth irregular income · Separate business & personal · Plan for taxes
- **Married Family:** Coordinate joint finances · Save for kids · Pay down the mortgage
- **High Income Executive:** Optimize taxes · Grow investments · Build long-term wealth
- **Credit Rebuilding:** Rebuild credit · Reduce debt · Establish an emergency fund
- **Gig Worker / Consultant:** Manage variable income · Set aside taxes · Build retirement savings
- **Salary + Bonus Professional:** Allocate bonuses well · Max tax-advantaged accounts · Invest consistently
- **Earned Wage Access Worker:** Stabilize cash flow · Avoid fees · Start saving
- **Bank Income Profile:** Understand income patterns · Budget to deposits · Build savings
- **Dynamic Transactions Profile:** Explore spending insights · Find recurring costs · Optimize a budget

## How to edit

`personas.ts` is the **only** place to change personas. To tune the synthetic data per profile, adjust `plaid_sandbox_user` (and optionally move to a Plaid `user_custom` config for fully bespoke datasets). Adding a persona = add one entry to `PLAID_PERSONAS`; the public API, dropdown, and validation pick it up automatically. The registry test asserts the count and that no credentials leak into the public payload — update the expected-count test if you add/remove personas.

## Tuning note

Most personas currently use the universal `user_good` sandbox user (guaranteed to generate valid sandbox accounts/transactions). The `plaid_profile_label` records the intended Plaid sandbox profile; map each to its exact Plaid `override_username` per Plaid's current sandbox **test-credentials** docs as you refine the beta — no other code changes needed.
