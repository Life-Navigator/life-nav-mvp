# PHASE 2B — DEPLOY CLASSIFIED FINANCE MODEL + DOWNSTREAM VALIDATION — 2026-06-10

Branch `fix/platform-trust-stabilization` @ `def5540` (NOT merged). The classified finance model
is now LIVE (Core API deployed to Fly). Validated against the Vercel preview wired to production
Supabase + the production Core API.

## Fly Deployment Result

`flyctl deploy --remote-only` of `apps/lifenavigator-core-api` → **succeeded**. App
`lifenavigator-core-api` (org personal, region iad). Rolling update of 2 machines, health checks
passed. (A transient "not listening on 0.0.0.0:8080" warning appeared mid-roll; the started machine's
health check passes and the API serves — see verification.) Rollback target retained: **v65**.

Verification (live, no auth needed for shape):

- `/docs` → 200 (FastAPI serving)
- `/v1/finance/canonical-summary` → 401 (serving, auth-gated, correct)

## Live Core API Version

- **Release v66** · image `lifenavigator-core-api:deployment-01KTR0K3NY4546G84MNZHTF9CZ`
- Contains: classified `financial_resolver.summary()`, asset-type classification, mirror dedup,
  full assets/liabilities breakdown, `net_worth`, `possible_home_equity_gap`, expanded keys.

## Classified Finance Summary Per Persona (LIVE — all 20 classified fields present)

| field                               | young_professional | married_family | high_income_executive |
| ----------------------------------- | ------------------ | -------------- | --------------------- |
| cash_balance                        | 8,000              | 31,400         | 203,200               |
| investment_accounts_total           | 0                  | 0              | **920,000**           |
| retirement_accounts_total           | 0                  | 0              | **410,000**           |
| real_estate_total                   | 0                  | 0              | 0                     |
| vehicle/business/other_assets_total | 0                  | 0              | 0                     |
| total_assets                        | 8,000              | 31,400         | 1,533,200             |
| credit_card_debt                    | 640                | 2,840          | 3,120                 |
| loan_debt                           | 25,000             | 21,500         | 0                     |
| mortgage_debt                       | 0                  | 384,000        | 1,240,000             |
| total_liabilities                   | 25,640             | 408,340        | 1,243,120             |
| **net_worth**                       | **−17,640**        | **−376,940**   | **290,080**           |
| possible_home_equity_gap            | false              | true           | true                  |
| confidence                          | 0.95               | 0.95           | 0.95                  |

## Reconciliation Table (all PASS, live)

| rule                                                                             | young_professional | married_family | high_income_executive |
| -------------------------------------------------------------------------------- | ------------------ | -------------- | --------------------- |
| total_assets == Σ(cash+invest+retire+real_estate+vehicle+business+other)         | PASS               | PASS           | PASS                  |
| total_liabilities == Σ(cc+loan+mortgage+student+auto+other)                      | PASS               | PASS           | PASS                  |
| net_worth == total_assets − total_liabilities                                    | PASS               | PASS           | PASS                  |
| investment_accounts_total == investments-endpoint total == Σ investment accounts | PASS               | PASS           | PASS                  |
| /api/assets returns only non-account assets (no mirrors)                         | 0                  | 0              | 0                     |

No double-counting. No asset class mislabeled.

## Downstream Surface Results

- **Canonical summary endpoint** (dashboard card, finance overview, accounts page all read it): LIVE classified ✓
- **Investments endpoint** (`/api/investments/analytics`): total == investment accounts ($920K), not total assets; `holdings:[]` ✓
- **Assets endpoint** (`/api/assets`): non-account assets only, classified, dedup'd ✓
- **Estate / Legacy page**: reads `investment_balance`/`retirement_balance`/`cash_balance` via the
  resolver panel — now correctly classified (investment is investment-only) ✓ (data-layer)
- **Pixel/screenshot** confirmation of each page's rendering: NOT done (no headless browser) — data
  layer proven, page render pending.

## Reports / Estate Validation

- **Estate/Legacy:** investment/retirement/cash are correctly classified (no mislabel). Does not yet
  surface real_estate as its own line (personas have none).
- **Reports PDF** (`/v1/reports/{type}/pdf`) and **Family Office** (`/v1/family/office`): proxy
  SEPARATE Core API endpoints with their own aggregation, which were NOT audited/fixed in this sprint.
  The resolver summary is correct, but these generators may still aggregate finance differently.
  **NOT validated — flagged as remaining (P0.6 partial).**
- **Decision Brain / Scenarios:** no direct canonical-field usage found in those page dirs; their
  finance inputs were not audited this sprint. Flagged.

## Home Asset Gap Status

- `possible_home_equity_gap` is LIVE and correct: **true** for married_family (mortgage $384K, no home)
  and high_income_executive (mortgage $1.24M, no home); false for young_professional.
- `NetWorthSummary` now reads `possible_home_equity_gap` (was checking non-existent
  `mortgage_balance`/`home_value`) and renders an **"Add Home Value"** CTA → `/dashboard/finance/assets`,
  where a `real_estate` asset (source `user_entered`) is added via `/api/assets` POST, which then clears
  the gap on the next canonical fetch. (Data + code proven; pixel render pending.)

## Founder Journey Result

**13/13 PASS** for A/B/C (commit 86cc1d0; the only change since, def5540, is a render-only component).
Targeted P0.7 assertions — all PASS (live):

- high_income_executive `investment_accounts_total = 920000` ✓
- `retirement_accounts_total = 410000` ✓
- no `finance.assets` mirrors (assets endpoint count 0) ✓
- `net_worth = 290080` (no home value entered) ✓
- assets endpoint returns only non-account assets ✓
- investments endpoint total = investment account total (920000), NOT total assets (1,533,200) ✓

## Remaining Finance Trust Risks

1. **Reports PDF + Family Office aggregation** not audited against the classified model — may still
   group assets differently (P0.6 partial).
2. **Pixel/screenshot** validation of Dashboard/Investments/Retirement/Assets/Estate rendering pending.
3. **Per-asset loans / equity** not wired (`/api/assets`: equity = value, totalDebt = 0).
4. **Existing pre-fix prod data** (users created before the persist fix) still has mirror rows in
   `finance.assets`/`retirement_plans`; the deployed resolver now DEDUPS mirrors at read time, so their
   numbers are corrected on read, but a cleanup migration would remove the stale rows.
5. **Branch not merged**; production app (app.lifenavigator.tech) still serves old web code (the Core
   API is now updated for everyone, but the web fixes live only on the branch/preview until merge).

## Definition of Done — status

Classified model is LIVE (Core API v66) ✓. Investment/retirement/other-assets/real-estate/liabilities
separated in the canonical model and reconcile everywhere ✓. No double-counting ✓. Net worth reconciles
✓. Dashboard/finance/investments/retirement/assets/estate consume the same classified truth (data layer)
✓. Reports/Family-Office aggregation + pixel validation remain (flagged).
