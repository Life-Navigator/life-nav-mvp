# FINANCE_OVERVIEW_RENDERING_AUDIT.md — Phase 5

Static (code-level) audit. Playwright on live finance users NOT run this pass (flagged where it matters).

## Root structural cause: two summary engines + two "overview" pages

| Engine                                                | Endpoint                        | File                        |
| ----------------------------------------------------- | ------------------------------- | --------------------------- |
| `FinancialInputResolver.summary` (declared canonical) | `/v1/finance/canonical-summary` | `financial_resolver.py:124` |
| `FinanceService.summary` (legacy)                     | `/v1/finance/summary`           | `domains/finance.py:136`    |

They compute net worth **differently** (Gap 1). Two pages: `/dashboard/finance/overview` (sidebar "Overview", the real one — reads canonical + `/api/finance/analytics`) and `/dashboard/finance/page.tsx` (legacy "Financial Dashboard").

## Per-card mapping — real overview (`/dashboard/finance/overview`)

| Card                                                          | API field                                            | Status                                            |
| ------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| Total Assets / Liabilities / Net Worth tiles                  | canonical `total_assets`/`total_debt`/`net_worth`    | OK                                                |
| Monthly Cash Flow tile                                        | analytics `cash_flow.net_cash_flow`                  | OK but **rolling 30d, labeled "Monthly"** (Gap 7) |
| AccountsSummary list                                          | **`/api/plaid/accounts`** (`AccountsSummary.tsx:55`) | **SPLIT SOURCE** (Gap 2)                          |
| AccountsSummary totals                                        | canonical                                            | OK                                                |
| CashFlow / SpendingTrends / UpcomingBills / FinancialInsights | analytics nested fields                              | OK                                                |

## Per-card — legacy dashboard (`/dashboard/finance/page.tsx`)

| Card                                            | Status                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Net Worth / Bank / Retirement tiles             | OK (canonical)                                                                                               |
| Investments tile                                | **MISLABEL** — caption "Investment & retirement balances" but value is investments-only (`page.tsx:360-368`) |
| Spending/Investment charts, Recent Transactions | **EMPTY under proxy** (Gap 3)                                                                                |
| Financial Insights                              | **hardcoded placeholder** (`page.tsx:643-648`) (Gap 5)                                                       |

## Prioritized gaps

- **Gap 1 (P1)** — Two engines disagree on net worth. Resolver excludes account-mirror assets + classifies RE/vehicle/business separately (`financial_resolver.py:149-195`); `FinanceService` does `assets_total − debt_total` with a different liability set (`finance.py:154-157`). Surfaces reading different engines show divergent net worth.
- **Gap 2 (P1)** — AccountsSummary **list** = `/api/plaid/accounts` (filters `is_active=true`, `plaid/accounts/route.ts:30`) but **totals** = canonical. If `is_active` is null/false on rows canonical still counts, the list shows "No accounts connected" while Total Assets shows a number — visible contradiction. List also renders credit-card balances as positive green "assets" (`AccountsSummary.tsx:163-169`).
- **Gap 3 (P0 IF `CORE_API_URL` set)** — `/api/financial` proxy returns the DomainViewModel shape (`route.ts:68-90`); `normalizeFinancePayload` **forces** `transactions: EMPTY_TX`, `investments: EMPTY_INV` (`domainViewModel.ts:195-196`). → Spending Trends, Spending-by-Category, Investment Performance, Recent Transactions on the legacy dashboard are **always empty**; the Transactions page reads `data.accounts`/`data.transactions.recentTransactions` which don't exist in that shape → empty. **Live check needed:** is `CORE_API_URL` set in Vercel? (absent from repo `.env*`, but `_helper.ts` defaults `CORE_API` to the Fly URL; the proxy gates specifically on `process.env.CORE_API_URL`).
- **Gap 4 (P2)** — Retirement page: hardcoded "Optimization Opportunities" (Roth conversion etc.) shown regardless of data (`retirement/page.tsx:619-665`); tax-free/taxable buckets structurally always $0 (forces `TAX_DEFERRED`, `byTaxStatus.taxFree=0`, `:267,276`); contributions/match/projection hardcoded 0 (`:264-267`).
- **Gap 5 (P2)** — Legacy "Financial Insights" card = static placeholder text, never wired to analytics insights.
- **Gap 6 (P3)** — `transaction_type` classification: analytics + transaction-summary treat only `=== 'income'` as income, so `'transfer'`/`'investment'` rows count as **expenses** (`analytics/route.ts:57`), inflating spend / depressing savings rate. `FinanceService` additionally accepts `'debit'/'credit'` → cross-surface disagreement.
- **Gap 7 (P3)** — "Monthly" cash-flow tile is a rolling 30-day window (`analytics/route.ts:62`).
- **Gap 8 (P3)** — Backend-computed `savings_rate`, `emergency_reserve_months`, `top_opportunities/risks`, `next_best_action` (`finance.py:159-182`) and resolver's `real_estate_total`/`vehicle_assets_total`/`business_assets_total` are **never displayed** on the overview.

## Recommended fix order (low-risk, mapping-only)

1. **Gap 3** (verify `CORE_API_URL`; if set, fix `normalizeFinancePayload` to not blank tx/investments, or point the legacy dashboard + transactions page at canonical + analytics). Highest user-visible impact.
2. **Gap 2** (single source for AccountsSummary list+totals; classify liabilities so cards aren't green).
3. **Gap 1** (pick canonical everywhere; retire `FinanceService.summary` from the proxy).
4. **Gaps 4–5** (remove hardcoded placeholders or wire real sources — honest empty states per the no-mock-data rule).
5. **Gap 6–8** (classification + labels + surface computed fields).
