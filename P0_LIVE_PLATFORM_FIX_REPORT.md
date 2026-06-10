# P0 LIVE PLATFORM FIX — REPORT — 2026-06-09

Scope: dashboard finance card, finance source-of-truth, accounts, investments, retirement,
recommendation placement. **Code-complete + `tsc` 0 errors.** Browser/live proof is BLOCKED on
credentials (no `apps/web/.env.local`); the founder-journey probe is built and ready to run.

> Honesty gate: per the Definition of Done, "if the browser does not prove it, it is not done."
> Nothing below is marked DONE-verified. Code is COMPLETE; live verification is PENDING the probe run.

## Root Cause Summary

- **Dashboard finance card blank / divergent:** card read `/api/dashboard/summary` (a parallel
  computation) and gated on `financial.hasData`. Now reads the SAME canonical endpoint as the
  Financial Overview page → identical values, no separate math.
- **Accounts empty for everyone:** page read top-level `data.accounts` but `/api/financial` returns a
  nested Core API DomainViewModel. Fixed in Phase 1 with `normalizeFinancePayload`.
- **Investments/Retirement empty:** pages call `/api/investments/*` and `/api/retirement/*` routes
  that don't exist (404). They now render the canonical account-level balance + honest missing-state
  instead of nothing/fabricated defaults.
- **Recommendations dominating the top:** `FirstInsightCard` (the top recommendation) rendered above
  the domain cards. Moved into a compact preview inside Alerts & Notifications, below the domain cards.

## Plaid Source Verification — BLOCKED (no live creds)

Cannot trace live values without Supabase/deployment access. The **path** that will be verified by
`apps/web/founder-journey.mjs` once `.env.local` exists:
Plaid sandbox persona → `/api/integrations/plaid/activate-persona` → `finance.financial_accounts` /
`finance.assets` / `finance.retirement_plans` (Supabase, RLS by `user_id`) → `FinancialInputResolver.summary()`
→ `/v1/finance/canonical-summary` → Financial Overview page + Main Dashboard finance card + Investments
banner + Retirement resolver panel. The probe asserts each value is numeric and consistent across surfaces.
**Not yet executed.**

## Main Dashboard Finance Fix — CODE COMPLETE

`components/dashboard/DashboardClient.tsx`: the Financial Overview card now fetches
`/api/finance/canonical-summary` directly (same endpoint as the Financial Overview page) and renders
net worth, total assets, total liabilities, cash, investments, retirement, **source label**, **last
updated**, and a **CTA** to `/dashboard/finance/overview`. Empty state only when canonical returns no
data (never "No financial data yet" when canonical has data).

## Accounts Page Fix — CODE COMPLETE (Phase 1)

`app/dashboard/finance/accounts/page.tsx`: response run through `normalizeFinancePayload`; renders
account name/type/balance/institution from `finance.financial_accounts`; net worth from canonical.

## Investments Page Fix — CODE COMPLETE

`app/dashboard/finance/investments/page.tsx`: fetches canonical `investment_balance`; shows an
**account-level investment balance banner** (with source label) above the analytics; the empty state
now reads "Account-level investment balance ($X) is available. Position-level holdings are not
available for this sandbox persona." Removed the fabricated 7% dividend-growth compounding. No fake
tickers as holdings (the ticker chips are an add-picker, not "your portfolio").

## Retirement Page Fix — CODE COMPLETE

`app/dashboard/finance/retirement/page.tsx`: already renders `FinancialResolverPanel withProjection`
(canonical retirement balance, contribution rate, employer match, income, time horizon — each with
source label / missing-input prompt / deterministic projection). Loading resolves even when the
`/api/retirement/*` routes 404 (`finally{setIsLoading(false)}`), so the canonical panel always shows.
Gated the "Retirement Readiness / Monte Carlo" banner behind a real `plan` (no fabricated 0-score /
"10 years"); shows an "Add retirement details" CTA otherwise. Fabricated default balances removed earlier.

## Recommendation Placement Fix — CODE COMPLETE

- `app/dashboard/page.tsx`: removed `FirstInsightCard` and `NeedsAttention` from the top; top is now
  Life snapshot (`LifeIntelligence`) + status (`MissionControl`).
- `DashboardClient.tsx`: order is now domain cards → **Alerts & Notifications** (with a compact
  "Top recommendation" preview linking to `/dashboard/recommendations`) → **Active Goals** → voting.
  No full recommendation list on the dashboard.

## Before / After Values — BLOCKED (needs live data)

Cannot produce real numbers without a live user. Will be filled by the probe (`KEEP_USERS=1` to
capture per-surface values for the before/after table).

## Browser Validation Results — BLOCKED (probe ready)

| Surface            | Loads?  | Data?   | Source label? | Matches canonical? | Empty state? |
| ------------------ | ------- | ------- | ------------- | ------------------ | ------------ |
| Main Dashboard     | pending | pending | pending       | pending            | pending      |
| Financial Overview | pending | pending | pending       | pending            | pending      |
| Accounts           | pending | pending | pending       | pending            | pending      |
| Investments        | pending | pending | pending       | pending            | pending      |
| Retirement         | pending | pending | pending       | pending            | pending      |
| Recommendations    | pending | pending | pending       | pending            | pending      |

To fill this: add `apps/web/.env.local` (APP_URL + Supabase URL/anon/service-role) and run
`node apps/web/founder-journey.mjs` — I'll then report the real matrix.

## Remaining Beta Blockers

1. **Live proof not run** — the single blocker; needs `.env.local`.
2. **Investments/Retirement data plane** — `/api/investments/*` and `/api/retirement/*` still 404;
   pages show canonical balance + missing-state, but position-level holdings / full retirement tabs
   need their backend routes built (Phase 2). Per Architectural Rule #1, those tabs should arguably be
   hidden until the contract exists.
3. **Assets-as-investments** — canonical resolver folds `finance.assets.current_value` into
   `investment_balance`; give assets their own canonical line (Phase 2).
4. `getSession→getUser` on ~30 proxy routes (Phase 3 hygiene).

## Definition of Done — status

Items 1–6 (Financial Overview has data; dashboard card matches; accounts open; investments/retirement
show data-or-missing-state; recommendations moved) are **code-complete and type-checked** but **not
browser-verified**. Items 7–9 (no fake data, no blank-when-data-exists, every value traces to a real
source) hold in code. **DoD is NOT met until the probe/browser run passes** — that is the next action
the moment credentials are provided.
