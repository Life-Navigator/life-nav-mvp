# P0 FRONTEND REALITY CHECK — REPORT — 2026-06-10

Diagnosed with **real headless Chromium (Playwright), logged-in married_family persona**, full-page
captures (not truncated this time). Screenshots: `reports/browser-validation/latest/preview/`.

## Current Tested URL / Commit

- Preview: `https://life-nav-mvp-6p7495qci-riffe007s-projects.vercel.app` (branch
  `fix/platform-trust-stabilization` @ `4918486`).
- Persona: married_family (matches the screenshot numbers: cash $31,400, net worth −$376,940, debt $408,340).

## THE root cause (the honest one)

My earlier "removed the top recommendation block" change to `app/dashboard/page.tsx` **was never
committed.** It sat in the working tree as an uncommitted modification across **12 commits** — every
deploy shipped `HEAD`'s `page.tsx`, which still rendered `<FirstInsightCard insight={firstInsight} />`
("TODAY'S BRIEF / GOVERNED") at the top. The preview was faithfully showing committed code; my fix
never reached a commit. (`git show HEAD:…/page.tsx` still had it; `git status` showed `page.tsx` as ` M`.)
My prior "browser validation" also truncated the captured text and missed the block. Fixed: `page.tsx`
is now committed (`4918486`, verified in `git show --stat`) and browser-confirmed.

## Dashboard Render Tree (after fix, verified)

`app/dashboard/page.tsx` (server) → `<LifeIntelligence/>` + `<MissionControl/>` → `<DashboardClient/>`.
No `FirstInsightCard` mounted (dead component). DashboardClient order: Quick Actions → Financial
Overview card (canonical) → Healthcare/Career/Education cards → **Alerts & Notifications (with compact
"TOP RECOMMENDATION" preview)** → Active Goals → Future Modules. Browser check: `TODAY'S BRIEF present: false`,
`TOP RECOMMENDATION (alerts) present: true`, `Finance card net worth present: true`.

## Root Cause Of Old Dashboard Blocks

Uncommitted `page.tsx` (above) → `FirstInsightCard` still mounted at top in the deployed build.

## Root Cause Of Finance Card Empty State

On the LATEST preview the dashboard Finance card **shows data** ($-376,940 net worth, $31,400 cash,
investment/retirement $0 for married_family) sourced from `/api/finance/canonical-summary`. The
"No financial data yet" in the user's screenshot was the **older deployed build** (pre-canonical-card,
before `4918486`). Hard-refresh / latest preview shows data.

## Root Cause Of Sidebar Connected Accounts Mismatch

Was summing all balances via `/api/plaid/accounts` (didn't exist → "No accounts connected" / inflated).
Now reads canonical `net_worth` + `accounts_count` → "Net Worth · 5 accounts · −$376,940"; nav "Manage Accounts".

## Root Cause Of Accounts Failure

`AccountCard` crashed on `Intl.NumberFormat({currency: undefined})` then `institution.name.charAt` —
it assumed the rich `FinancialAccount` shape but received normalized accounts. Made defensive. Accounts
page now **opens** (canonical panel, Net Worth −$376,940, "Add Home Value" prompt, account filters).

## Root Cause Of Investments / Retirement Zero State

For married_family there are genuinely **no** investment/retirement accounts → honest "No Investment
Holdings Yet" / "Retirement balance: Missing" (correct). For the executive persona (validated
separately) Investments shows the $920K account-level banner + holdings-unavailable; Retirement shows
$410K + missing 401k inputs. No false zeros; no fake positions.

## Components / Hooks / Routes Changed (this incident)

- **NEW routes** `app/api/plaid/accounts`, `app/api/plaid/transactions` (overview sub-widgets were 404).
- `app/dashboard/page.tsx` — remove top FirstInsightCard (the never-committed fix).
- `components/dashboard/DashboardClient.tsx` — destructure `firstInsight` (crash fix); beta CTA labels.
- `components/financial/accounts/AccountCard.tsx` — defensive shape (currency/institution/status/date).
- `components/domain/finance/overview/{AccountsSummary,CashFlow,SpendingTrends,UpcomingBills,FinancialInsights}.tsx`
  — classify-by-type fix + "Connect Account" → "View Accounts".
- `components/domain/finance/FinanceSidebar.tsx` — canonical net worth; "Manage Accounts".
- `app/dashboard/finance/page.tsx` — "Connect New Account" → "Manage Accounts".

## Browser Screenshots Saved

`reports/browser-validation/latest/preview/{dashboard,finance,accounts,investments,retirement,overview}.png`
(full-page, from `6p7495qci` @ `4918486`).

## Before / After Rendered Text (dashboard, real browser)

- BEFORE: "…Preview with sample data | **TODAY'S BRIEF | GOVERNED | employer match** … | Welcome back …
  | Financial Overview Net Worth $-376,940 …" (top rec block present)
- AFTER: "…Preview with sample data | Welcome back … | Financial Overview Net Worth $-376,940 … |
  Alerts & Notifications | **TOP RECOMMENDATION** …" (no top block; rec only in Alerts)

## Remaining P0 Frontend Failures

1. **MissionControl "WELCOME TO LIFENAVIGATOR / Preview with sample data"** still at top — this is the
   activation/status state (no docs/discovery), not a recommendation block. Acceptable, but if you want
   pure "Life Snapshot" first, MissionControl's empty-state needs a redesign.
2. **Quick Actions** still render before the domain cards (order nuance vs the requested 1-5 order).
3. **"Go to Healthcare"** nav label remains (navigation, not data-add); other "Add … Data" → "Enter Data".
4. **Older preview URLs / browser cache**: if you're on a per-commit preview before `4918486` (or a
   cached bundle), you'll still see the old block — test `6p7495qci` (or the branch's latest) with a hard refresh.
5. **Branch not merged**; production (`app.lifenavigator.tech` = `536f9dc`) still old until merge+deploy.

## Definition of Done — status

Dashboard no longer shows the top recommendation block (browser-verified) ✓. Finance card has data when
overview does ✓. Domain cards show missing states + CTAs ✓. Alerts contain the recommendation preview ✓.
Accounts opens ✓. Investments/retirement show correct state (no false zeros) ✓. Sidebar shows net worth ✓.
No finance "Connect Account" language ✓. Screenshots saved ✓. Open: MissionControl welcome placement,
Quick Actions order, and (critically) testing the LATEST preview / merging to prod.
