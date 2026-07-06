# Beta Persona Registry

**Date:** 2026-06-04
**Source of truth:** `apps/web/src/lib/integrations/plaid/personas.ts` (+ `plaid-custom-configs.ts`), both **server-only**.

Each persona defines the full field set below. The **public** payload sent to the browser is only: `persona_id`, `display_name`, `description`, `goals`, `complexity`, `life_stage`, `profession`, `risk_profile` — **never** credentials or Plaid configs.

| persona_id              | Display name                        | Life stage     | Profession                       | Income type                    | Risk         | Plaid source              |
| ----------------------- | ----------------------------------- | -------------- | -------------------------------- | ------------------------------ | ------------ | ------------------------- |
| `young_professional`    | Young Professional                  | early_career   | Software Analyst                 | W-2 salary (biweekly)          | moderate     | user_custom               |
| `small_business_owner`  | Small Business Owner                | business_owner | Owner, services LLC              | Business revenue + owner draws | aggressive   | user_custom               |
| `married_family`        | Married Family                      | family         | Dual income (teacher + engineer) | Two W-2 salaries               | moderate     | user_custom               |
| `salary_plus_bonus`     | Salary + Bonus Professional         | mid_career     | Senior Manager                   | Salary + quarterly bonus       | aggressive   | user_custom               |
| `high_income_executive` | High Income Executive               | peak_earning   | VP / Executive                   | High salary + equity           | aggressive   | user_custom               |
| `credit_rebuilding`     | Credit Rebuilding Profile           | recovery       | Hourly worker                    | Hourly W-2 (thin)              | conservative | user_custom               |
| `gig_worker`            | Independent Consultant / Gig Worker | self_employed  | Independent consultant           | 1099 variable                  | moderate     | user_custom               |
| `earned_wage_access`    | Earned Wage Access Worker           | hourly_worker  | Retail / hourly                  | Hourly + earned-wage advances  | conservative | user_custom               |
| `bank_income`           | Bank Income Profile                 | general        | Salaried + side income           | Recurring direct deposits      | moderate     | user_custom               |
| `dynamic_transactions`  | Dynamic Transactions Profile        | general        | General consumer                 | Regular deposits               | moderate     | user_transactions_dynamic |

## Per-persona fields (in the registry)

`persona_id`, `display_name`, `description`, `life_stage`, `financial_complexity`, `profession`, `family`, `income_type`, `spending_pattern`, `asset_profile`, `liability_profile`, `investment_profile`, `risk_profile`, `primary_goals[]`, `expected_insights[]`, `plaid_config_source`, plus server-only Plaid wiring (`plaid_sandbox_user`, `plaid_sandbox_password`, `plaid_products`, `institution_id`).

## Signature financial shape per persona (from the `user_custom` configs)

- **Young Professional** — modest checking + small emergency savings + low-balance rewards card + student loan; biweekly payroll, rent, subscriptions, student-loan payment.
- **Small Business Owner** — business operating cash (lumpy client invoices, payroll runs) + personal checking + business card + SBA term loan.
- **Married Family** — joint checking (two payrolls) + 529/family savings + family rewards card + mortgage + auto loan; mortgage, childcare, groceries.
- **Salary + Bonus** — checking with base salary + a large quarterly bonus deposit + taxable brokerage + 401(k) + travel card.
- **High Income Executive** — executive checking + money market + large brokerage + IRA + signature card (low util) + jumbo mortgage.
- **Credit Rebuilding** — very low checking (overdraft + payday-loan + fees) + maxed secured card (overdue) + collections personal loan.
- **Gig Worker** — 1099 checking (multi-client deposits, quarterly tax set-aside) + SEP-IRA + business rewards card.
- **Earned Wage Access** — near-zero checking with frequent small EWA advances + fees + starter card.
- **Bank Income** — clear recurring direct deposits + side-gig deposit + savings + everyday card.
- **Dynamic Transactions** — Plaid's documented dynamic-transactions sandbox user (high-volume evolving transactions).

## Persona metadata persisted to Supabase

`public.user_persona_profile` (one row per user): `persona_id`, `display_name`, `life_stage`, `profession`, `family`, `income_type`, `spending_pattern`, `asset_profile`, `liability_profile`, `investment_profile`, `risk_profile`, `financial_complexity`, `config_source`, `primary_goals` (jsonb), `expected_insights` (jsonb), `metadata` (jsonb). RLS: users read own; service_role writes. A trigger promotes it to the graph.

## How to edit / extend

Add or tune a persona in `personas.ts`; add its dataset to `plaid-custom-configs.ts` keyed by `persona_id` (omit to fall back to a documented sandbox user). The public API, dropdown, validation, persistence, and graph promotion pick it up automatically. The distinctness test asserts each custom config is unique — update it if you intentionally share configs.
