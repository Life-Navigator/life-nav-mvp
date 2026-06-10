# P0 FRONTEND / MIDDLEWARE INCIDENT — REPORT — 2026-06-10

Branch `fix/platform-trust-stabilization`. Diagnosed and fixed via **real Playwright browser recon**
(headless Chromium, logged-in high_income_executive persona) against the prod-wired preview — the
gap my earlier API-level probes missed.

## Core diagnosis (corrected)

The hypotheses about middleware/session/auth-state were **NOT** the cause. Auth state reaches
middleware, API routes, and client hooks correctly (the founder journey is 13/13; canonical data
loads). The browser breakage was **component / hook / response-shape bugs**:

1. Two pages **crashed** (React error boundary), not "empty".
2. Overview sub-widgets called **non-existent endpoints** (404).
3. A widget **mislabeled** assets by classifying on balance sign.
4. Beta "Connect Account" language + an inflated sidebar total.

## Middleware Findings

`proxy.ts` gate works: public allowed; protected `/dashboard|/onboarding|/admin|/api` require auth;
advisor-first gate (`setup_completed` + `onboarding_completed`) redirects correctly. Browser recon
confirmed logged-in users reach `/dashboard` and finance routes (200, not redirected). **No middleware bug.**

## Auth State Findings

Supabase session cookie → middleware `getUser()` → API route `getUser()` → user-scoped Supabase
queries all work (canonical summary, accounts, investments, retirement returned the correct
per-user values in-browser). **No auth-propagation bug.** No service-role-without-user-filter on the
failing paths.

## Onboarding Gate Findings

Controlled by `profiles.setup_completed` (persona) + `profiles.onboarding_completed` (advisor). Persona
activation does NOT unlock the dashboard; advisor completion/skip does. Confirmed in prior phases + this recon.

## Frontend Hook Inventory (failing pages → fix)

| Surface                                                            | Hook/fetch                                | Was                                 | Fix                          |
| ------------------------------------------------------------------ | ----------------------------------------- | ----------------------------------- | ---------------------------- |
| Overview · AccountsSummary                                         | `/api/plaid/accounts`                     | **404** → "Unable to load accounts" | created route (widget shape) |
| Overview · CashFlow/SpendingTrends/UpcomingBills/FinancialInsights | `/api/plaid/transactions`                 | **404**                             | created route (widget shape) |
| Dashboard finance card                                             | `/api/finance/canonical-summary`          | works                               | (Phase 1C)                   |
| Dashboard (component)                                              | uses `firstInsight` prop                  | **crash: not destructured**         | destructure prop             |
| Accounts page                                                      | `/api/financial` (normalized) + canonical | crash downstream                    | (see shape)                  |
| FinanceSidebar                                                     | `/api/plaid/accounts` summed              | inflated $2.78M                     | → canonical `net_worth`      |

## Dashboard Component Tree

`app/dashboard/page.tsx` (server) → `LifeIntelligence` + `MissionControl` (life snapshot/status) →
`DashboardClient` (client). DashboardClient order: Quick Actions → domain cards (Finance/Health/
Career/Education) → **Alerts & Notifications (with compact recommendation preview)** → Active Goals →
Future Modules. **Recommendations are NOT top-level** (compact preview in Alerts; full list on
`/dashboard/recommendations`). No duplicate/old dashboard component in the tree.

## API Proxy Shape Findings

- `/api/plaid/accounts` & `/api/plaid/transactions` **did not exist** → created (canonical finance
  tables, widget-expected shape: `currentBalance`, `category` string, signed amount).
- `AccountCard` assumed the rich `FinancialAccount` shape (`institution.name.charAt`, `account.currency`,
  `account.status.charAt`) but receives normalized accounts (string/absent institution, no currency/
  status) → crash. Made defensive (handles all shapes; default `currency:'USD'`).
- `AccountsSummary` classified assets/liabilities by **balance sign** (mortgage positive → counted as
  asset → $2.78M assets / $0 liabilities). Fixed: classify by **account type**.

## Cache Findings

Canonical routes are `dynamic='force-dynamic'`, `cache:'no-store'`. Client widgets fetch on mount with
cookies. No stale-cache / stale-key issue was the cause; data is user-scoped and fresh. (No localStorage/
SWR/RQ stale state implicated in the failures.)

## Files Changed

- **NEW** `app/api/plaid/accounts/route.ts`, `app/api/plaid/transactions/route.ts`
- `components/dashboard/DashboardClient.tsx` (destructure `firstInsight`)
- `components/financial/accounts/AccountCard.tsx` (defensive shape: currency/institution/status/date)
- `components/domain/finance/overview/AccountsSummary.tsx` (classify by type; "Connect Account"→"View Accounts")
- `components/domain/finance/overview/{CashFlow,SpendingTrends,UpcomingBills,FinancialInsights}.tsx` (language)
- `components/domain/finance/FinanceSidebar.tsx` (net worth from canonical; "Connect Accounts"→"Manage Accounts")
- `app/dashboard/finance/accounts/page.tsx` ("Connect Account"→"Add Account")

## Before / After Browser Results (real Chromium, logged-in)

| Page                           | BEFORE                                                                                       | AFTER                                                                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| /dashboard                     | **"Something went wrong"** (crash: firstInsight undefined)                                   | **loads** (200)                                                                                                                      |
| /dashboard/finance/accounts    | **"Something went wrong"** (crash: currency)                                                 | **opens** — canonical panel, Net Worth $290,080, Assets $1,533,200, Liabilities $1,243,120, "Add Home Value" prompt, account filters |
| /dashboard/finance/overview    | sub-widgets "Unable to load …"; AccountsSummary $2,776,320 assets/$0 liab; "Connect Account" | sub-widgets load; AccountsSummary **$1,533,200 / $1,243,120**; "View Accounts"                                                       |
| /dashboard/finance             | works                                                                                        | works (Net Worth $290,080, classified)                                                                                               |
| /dashboard/finance/investments | works                                                                                        | works ($920K account-level + honest missing holdings)                                                                                |
| /dashboard/finance/retirement  | works                                                                                        | works ($410K + honest missing 401k inputs)                                                                                           |
| FinanceSidebar header          | "Connected Accounts $2,776,320"                                                              | **"Net Worth $290,080"**; nav "Manage Accounts"                                                                                      |

End state: **all 6 pages return 200 with no "Something went wrong", no "Unable to load", no "Connect Account", no "No financial data".**

## Remaining Frontend P0s / notes

1. **Benign "Loading"** substring still appears at the 5s capture on some pages (a sub-widget still
   mounting / skeleton) — not a broken state; worth a settle-time check.
2. **"Connect Account" elsewhere**: still present in non-finance pages (career/networking, education,
   integrations, budget, PlaidLinkButton). Finance surfaces are fixed; the broader sweep remains.
3. **Spending/Cash-Flow "No data"**: honest when a persona has no transactions in range — confirm the
   persona seeds transactions if richer widgets are expected.
4. **Dashboard "welcome/get-started" banner** shows when there's no advisor-discovery life model
   (recon user skipped discovery) — by design, not a bug; the domain cards render below it.
5. **Pixel screenshots** were captured to /tmp/recon-\*.png (ephemeral in this env), not exported.
6. **Branch not merged**; production web still serves old code (Core API resolver IS live for all).

## Definition of Done — status

Logged-in browser state reaches middleware/API/hooks ✓. Dashboard + accounts **open (no crash)** ✓.
Pages call correct endpoints / expect correct shapes ✓. Dashboard tree correct; recommendations placed
in Alerts ✓. Investments/retirement show real account-level data, not false zeros ✓. No "Unable to load"
when data exists ✓. Finance "Connect Account" language removed ✓. Remaining: non-finance "Connect Account"
sweep + benign loading settle-check.
