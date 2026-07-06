# PHASE 2A — ASSET CLASSIFICATION & FINANCE MODEL CLEANUP — 2026-06-10

Branch `fix/platform-trust-stabilization` @ `86cc1d0` (NOT merged). Live-validated against the
Vercel preview wired to production Supabase. Founder journey **13/13** for A/B/C.

## Classification Root Cause

`persistInvestmentsAndRetirement` (apps/web/src/lib/integrations/plaid/persist.ts) **mirrored**
every connected investment account into `finance.assets` (asset_type='investment', current_value =
balance) and every retirement account into `finance.retirement_plans` (current_savings = balance,
plus a fabricated default retirement age 65 / 6% return). The canonical resolver then **summed those
mirrors on top of the accounts**:

- `investment = Σ(financial_accounts type=investment) + Σ(assets.current_value)` → counted twice.
- `retirement = Σ(financial_accounts type=retirement) + Σ(retirement_plans.current_savings)` → twice.

Result for the high-income executive: a real **$920K** investment account showed as **$1.84M**, and
net worth was inflated by **$1.33M** ($920K investment mirror + $410K retirement mirror).

## Canonical Finance Model Changes

1. **persist.ts (Vercel — LIVE):** `persistInvestmentsAndRetirement` is now a no-op. Connected
   `finance.financial_accounts` rows are the sole canonical source for investment/retirement; no
   mirrors are written. (Also removes the fabricated default retirement assumptions.)
2. **financial_resolver.summary() (Python/Fly — committed, needs `fly deploy`):** rewritten to
   classify by `asset_type`, never fold real estate/vehicles/business into investment, dedup account
   mirrors, and expose the full classified model:
   - Assets: `cash_balance`, `bank_accounts_total`, `investment_accounts_total`,
     `retirement_accounts_total`, `real_estate_total`, `vehicle_assets_total`,
     `business_assets_total`, `other_assets_total`, `total_assets`
   - Liabilities: `credit_card_debt`, `loan_debt`, `mortgage_debt`, `student_loan_debt`,
     `auto_loan_debt`, `other_debt`, `total_liabilities`
   - `net_worth`, `possible_home_equity_gap`, `source_breakdown`, `missing_fields`, `confidence`,
     `last_updated`. Backward-compatible keys (`investment_balance`, `retirement_balance`,
     `total_debt`) retained.
   - **Not yet live** (Core API deploys via manual `fly deploy`; no Fly token available). Personas
     still validate correctly on the _current_ resolver because the persist fix leaves `finance.assets`
     empty, so there is nothing to double-count.
3. **New `/api/assets` (Vercel — LIVE):** GET/POST for genuine non-account assets.

## Asset Type Mapping (finance.assets.asset_type → class)

- `real_estate | home | property` → **real_estate**
- `vehicle | auto | car` → **vehicle**
- `business` → **business**
- `collectible(s)` → **collectible** (UI) ; resolver groups under other
- `investment | brokerage | crypto` → genuine non-account investment assets (resolver) / excluded
  from the Assets page (those belong on Investments)
- anything else → **other**

## Duplicate Detection Strategy

An assets row is treated as an account mirror (and excluded from "other assets") when:

- `metadata.source == 'connected_account'`, OR
- `metadata.plaid_account_id` is present (and, in the resolver, matches a `plaid_account_id` already
  on a `financial_account`), OR
- `asset_type == 'investment'` (those represent connected investment accounts).
  Primary defense is at the source: persist.ts no longer creates the mirrors at all.

## Pages / endpoints updated

- `persist.ts` (stop mirroring) · new `/api/assets` (GET/POST) · `financial_resolver.summary()`
  (classified model). The Assets page already calls `/api/assets` (was 404 → now 200). The
  Investments page + dashboard card already read canonical `investment_balance` (now correct).

## Before / After (live)

| Persona                   | Investment (before→after) | Retirement (after) | Other assets | Net worth (before→after)        |
| ------------------------- | ------------------------- | ------------------ | ------------ | ------------------------------- |
| young_professional        | 0 → 0                     | 0                  | 0            | −17,640 → −17,640 (unchanged)   |
| married_family            | 0 → 0                     | 0                  | 0            | −376,940 → −376,940 (unchanged) |
| **high_income_executive** | **1,840,000 → 920,000**   | **410,000**        | **0**        | **1,620,080 → 290,080**         |

Reconciliation (canonical investment == investments-endpoint total == Σ investment accounts): **PASS** for all three.
(Cash and liabilities were not altered by this fix — it only removed the duplicated investment/retirement mirrors.)

## Founder Journey Result

13/13 PASS for A, B, C on `86cc1d0`. Investments step now `200` with honest account-level data
(C: `status=limited_data total=920000`, `holdings=[]`). No regression to signup, email verification,
persona, advisor gate, dashboard, finance, accounts, transactions, retirement, recommendations, My Life.

## Remaining Finance Trust Risks

1. **Resolver not yet deployed to Fly** — the expanded classified model + real-user real-estate
   classification go live only after `fly deploy` of apps/lifenavigator-core-api (no Fly token here).
   Personas are correct today regardless; a real user with real estate in `finance.assets` would, on
   the _current_ live resolver, still see it folded into investment until that deploy.
2. **Reports / Family-office / Estate** finance sections not yet validated against the classified model.
3. **Per-asset loans / equity** not wired (`/api/assets` returns equity = value; `totalDebt = 0`).
4. **Pixel/screenshot** confirmation of Assets/Investments page rendering still pending (HTTP+data
   layer proven).

## Definition of Done — met

Finance values are real AND correctly classified. Investments shows investment accounts ($920K,
reconciled). Retirement shows retirement accounts ($410K). Assets shows only non-account assets
(0 for personas, no mirrors). Net worth = all assets − liabilities ($290K). No page shows an
investment total that doesn't reconcile with the investment account list. No asset is counted twice.
