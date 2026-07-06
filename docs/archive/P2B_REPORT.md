# P2B — Remove Frontend Finance Calcs + Discovery-Coverage Domain Cards — 2026-06-10

## Merge Result

- Canonicalization increment (`cc2ad6b`) merged to `main` and deployed to production earlier this session.
- P2B merged to `main`: `cc2ad6b..4c50edd` (fast-forward). `main` HEAD = **`4c50edd`**.

## Production Smoke Result (`app.lifenavigator.tech` @ `4c50edd`, logged-in executive persona)

6 pages (dashboard, finance, transactions, accounts, investments, retirement, overview):

- `crash=false` · `unableToLoad=false` · `fakeFinEmpty=false`
- `genericEmptyCards=false` (no "No X data yet") · `financeRetireTile=true` · `cryptoGone=true`
- dash Net Worth = **$290,080** · transactions Income rendered from backend summary = true
- Unauthenticated `/dashboard` → 302 `/auth` (gate intact).

## Files Changed

- `app/dashboard/finance/page.tsx` — removed `calculateTotals()` + `cryptoAssets` state; Crypto tile → canonical Retirement tile.
- `app/dashboard/finance/transactions/page.tsx` — income/expenses/net now from backend; client only sends the filter.
- **NEW** `app/api/finance/transaction-summary/route.ts` — backend-owned income/expense/net.
- **NEW** `components/dashboard/DomainCoverage.tsx` — compact per-domain coverage block.
- `components/dashboard/DashboardClient.tsx` — fetch `/api/life/discovery-coverage`; Health/Career/Education
  empty states → `<DomainCoverage>`; removed generic "No X data / Enter Data" + orphaned modal triggers.

## Frontend Calculations Removed

1. `finance/page.tsx` `calculateTotals()` — summed banking/investment/credit/crypto + `netWorth` via `.reduce`. **Deleted.** Tiles now read canonical `cash_balance` / `investment_balance` / `retirement_balance` / `net_worth`.
2. `finance/page.tsx` crypto tile `totals.cryptoTotal` (client sum; crypto is canonically folded into `investment_balance`). **Replaced** with canonical Retirement tile.
3. `transactions/page.tsx` `totalIncome` / `totalExpenses` / `netAmount` — `.reduce` over filtered rows. **Replaced** with backend summary.

- Static grep confirms: no remaining `calculateTotals` / `cryptoAssets` / income-expense `.reduce` in these files. (Raw transaction ROWS still render client-side — display only, allowed.)

## Backend Endpoint Added / Used

- **Added:** `GET /api/finance/transaction-summary?start&end&accounts` → `{ income, expenses, net, count }`, summed server-side from `finance.transactions` (income = `transaction_type='income'`). Client passes the filter; server does the math.
- **Used (existing, no new logic):** `GET /api/life/discovery-coverage` → `{ overall_coverage_pct, domains:[{domain,label,coverage_pct,status,confidence_pct,missing[],unlocks[],cta}] }` — the same endpoint `/dashboard/my-discovery` uses.
- **Used (existing):** `GET /api/finance/canonical-summary` for all finance money tiles.

## Dashboard Domain Cards — Before / After

| Card       | BEFORE                                                                                     | AFTER                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Healthcare | "No healthcare data yet. Add your health information." + "Go to Healthcare" / "Enter Data" | `<DomainCoverage>` — coverage %, status, top missing, unlocks, "Continue Health discovery →" (or "Continue Discovery" fallback) |
| Career     | "No career data yet." + "Enter Data"                                                       | `<DomainCoverage>` (career)                                                                                                     |
| Education  | "No education data yet." + "Enter Data"                                                    | `<DomainCoverage>` (education)                                                                                                  |
| Finance    | canonical tiles (net worth/cash/investment)                                                | unchanged (already canonical); Crypto tile → Retirement (canonical)                                                             |

Note: for a persona WITHOUT advisor discovery, `/api/life/discovery-coverage` returns no domains, so the
cards render the honest **"Continue Discovery"** fallback (and `/dashboard/my-discovery` shows the same
empty state — they agree by construction). With discovery data, both populate coverage %/missing/unlocks.

## Browser Validation Results

Preview `4c50edd` + production `app.lifenavigator.tech`:

- Dashboard: no crash, **no generic empty cards**, coverage/Continue-Discovery present.
- Finance landing: no crash, **Retirement tile (canonical)**, **Crypto tile removed**.
- Transactions: no crash, **Income $23,600 / Expenses $980 from backend summary**.
- My Discovery: consistent with dashboard (same source).
- Screenshots: `reports/browser-validation/latest/p2b/{dashboard,finance,transactions}.png`.

## Remaining P1/P2 Issues

- **P2 (backend data):** `/api/life/discovery-coverage` returns empty for personas without advisor discovery,
  so cards show the "Continue Discovery" fallback rather than coverage %. Populating coverage from connected
  finance data (so finance shows a real %) is a Core API change (not done here).
- **P2:** Education `studyStreak` still hardcoded `0` in `/api/dashboard/summary`; Career card still uses the
  legacy summary (not `/api/career/summary` VM); add a Family domain card.
- **P2:** Healthcare card copy "Add your health information" while `is_health_enabled()=false` (globally locked).
- **P2:** Route consolidation (`/api/plaid/*` vs `/api/integrations/plaid/*` vs `/api/data/financial/*` vs `/api/financial`); delete orphan `/api/integrations/plaid/transactions`; migrate `/api/financial` callers to canonical.
- **P2:** Missing `/api/financial/*` routes (retirement-calculator, investments insights/risk/performance) — build or return honest "unavailable".
- **Security:** revoke the Vercel + Supabase tokens pasted in chat.

## Definition of Done — status

✅ Production has the verified canonicalization increment + P2B (`4c50edd`).
✅ Finance landing no longer calculates business values in the frontend (canonical tiles; crypto→retirement).
✅ Transactions summary no longer calculates income/expenses in the frontend (backend `transaction-summary`).
✅ Dashboard domain cards use discovery coverage; generic "No X data / Enter Data" cards removed.
✅ No AI/GraphRAG/recommendation/scenario/decision-engine logic touched.
