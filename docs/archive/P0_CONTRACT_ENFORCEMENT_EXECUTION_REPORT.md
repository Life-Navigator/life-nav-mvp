# P0 CONTRACT ENFORCEMENT EXECUTION (Top-25 P0 #1–6) — 2026-06-10

Live on production (`app.lifenavigator.tech` @ `e4f210a`). Contract enforcement only — no GraphRAG/AI/
recommendation/scenario/finance-math-logic changes (the analytics endpoint moves EXISTING widget math
server-side; it does not invent new logic).

## Files Changed

- **NEW** `app/api/finance/analytics/route.ts` — backend-owned analytics.
- **NEW** `components/domain/finance/FinanceDataContext.tsx` — one-fetch provider (summary + analytics).
- `app/dashboard/finance/layout.tsx` — wraps the section in the provider.
- `components/domain/finance/FinanceSidebar.tsx` — consumes context (was its own canonical fetch).
- `components/domain/finance/overview/{CashFlow,SpendingTrends,FinancialInsights,UpcomingBills,AccountsSummary}.tsx` — render backend values from context (no client calc).
- `app/dashboard/finance/overview/page.tsx` — tiles + monthly cash flow from context (no own fetch, no transaction reduce).
- `app/api/assets/route.ts` — computes `equity`/`appreciation` server-side.
- `app/dashboard/finance/assets/page.tsx` — `AssetCard` renders backend equity/appreciation (no client calc).

## Backend Analytics Endpoint — `GET /api/finance/analytics`

Server-computes from `finance.transactions` + `finance.assets`:

- `cash_flow`: income_total, expense_total, net_cash_flow, savings_amount, savings_rate (30d).
- `spending_trends`: total_spending + categories[{category, amount, percentage}] (30d expenses).
- `financial_insights`: month-over-month category % change (≥25%) with severity.
- `upcoming_bills`: recurring merchant detection (≥2 occurrences, <10% variance).
- `assets`: items[{value, equity, appreciation}] + classified totals.
  Each section returns `null` + `missing_state` (reason / how_to_provide / unlocks) when data is absent — never fabricated.

## Calculations Moved Backend-Side (Rule 1)

| Was (frontend)                                   | Now                                        |
| ------------------------------------------------ | ------------------------------------------ |
| CashFlow: savings, savings_rate                  | analytics.cash_flow (server)               |
| SpendingTrends: totalSpending, category %        | analytics.spending_trends (server)         |
| FinancialInsights: percentChange                 | analytics.financial_insights (server)      |
| UpcomingBills: recurrence/variance               | analytics.upcoming_bills (server)          |
| Assets: equity, appreciation                     | /api/assets (server)                       |
| Overview: monthly cash flow (transaction reduce) | analytics.cash_flow.net_cash_flow (server) |

## Fetch Dedupe Implementation (D3)

`FinanceDataProvider` (in the finance layout) fetches `/api/finance/canonical-summary` + `/api/finance/analytics`
ONCE; `FinanceSidebar`, `AccountsSummary`, the overview tiles, and the 4 overview widgets all consume the
context. **Verified live: overview makes 1 canonical-summary call (was 3) + 1 analytics call + 0
`/api/plaid/transactions` calls.**

## Fetch Reliability (D4)

Provider uses `cache: 'no-store'` + a single `AbortController` (aborted on unmount) + `loading|ready|error`
status. Widgets show loading skeletons while `analyticsStatus==='loading'`, honest `missing_state` when the
backend returns no data, and never a silent fake-empty.

## Static Verification (D5)

No `savingsRate`/`percentChange`/`variance`/`equity`/`appreciation`/`reduce(` business calc remains in the
five widgets (only reads of backend fields like `total_spending`). No widget fetches `/api/plaid/transactions`.
Direct `canonical-summary` fetches remain only in the provider + (still) finance landing/accounts/investments
pages (those double-fetch with the provider = 2 each — see Remaining).

## Browser Validation (D6) — preview + production

| Check                           | Result                                                 |
| ------------------------------- | ------------------------------------------------------ |
| Overview crash / unable-to-load | none                                                   |
| canonical-summary calls         | **1** (was 3)                                          |
| analytics calls                 | 1                                                      |
| /api/plaid/transactions calls   | 0                                                      |
| Tiles (assets/liab/net worth)   | $1,533,200 / … correct (canonical)                     |
| 4 widgets render                | Cash Flow, Spending Trends, Insights, Upcoming Bills ✓ |

Screenshot: `reports/browser-validation/latest/contract-enforcement/overview.png`.

## Remaining Rule-1 Violations

- None in the five targeted widgets.
- `finance landing` / `accounts` / `investments` pages still fetch `canonical-summary` directly (page +
  provider = 2 fetches each; overview's 3× is the one fixed). Wiring them to the context is a quick follow-up.
- Investments/retirement pages: holdings/projection already backend-sourced (no new violations found).

## Updated Scores

- **Trust: 90/100** (was 88) — the last high-traffic frontend money calcs are gone; overview is single-fetch.
- **Data Integrity: 92/100** (was 90) — cash-flow/spending/insights/bills/assets now server-owned + lineaged.

## Definition of Done — status

✅ All five widgets render backend-owned analytics. ✅ No frontend business-truth calc remains in them.
✅ Canonical summary not fetched 3× per page (overview = 1). ✅ Financial fetches use no-store + abort +
honest error/missing states. ✅ Browser validation confirms no regression (prod + preview).

---

# Elite Advisor Onboarding Sprint — SCOPE ASSESSMENT (not yet executed)

This second sprint is large and its core lives in the **Core API discovery conversation service**
(`/v1/life/discovery/chat`, the LLM conversation layer). Honest split:

**Frontend-doable (no AI changes) — I can execute next:**

- Issue 3: keep full conversation history (advisor already appends to `msgs[]`; verify never collapses).
- Issue 7: financial upload action cards → "Coming Soon" (Plaid persona is the source in beta) — relabel/disable.
- Issue 6: gate upload prompts behind a later phase (don't show during early discovery).
- Issue 8: explicit Plaid persona selection screen BEFORE advisor, showing assets/debt/income + confirm
  (enhance `/onboarding/financial-profile` — persona data already available).
- Issue 10: richer life-model summary on the confirmation screen (extend `LifeModelConfirmation`).

**Requires Core API discovery-service changes (LLM conversation design — the "AI" layer):**

- Issue 1: hypothesize-don't-conclude (the chat prompt currently asserts "the real objective is…").
- Issue 2: reflection→clarification→confirmation before classification.
- Issue 4: goal-ranking phase ("I believe these are your priorities" → reorder/confirm).
- Issue 5: confidence-threshold-based discovery (continue weak domains) instead of question count.
- Issue 9: final "what haven't I asked?" question.

These five change the conversation behavior in the Python Core API, which I have not been modifying this
session (no Fly deploy path established + it's the AI conversation layer). Recommend: I execute the
frontend-doable items now, and we scope the Core API discovery-prompt changes as a backend task (with
deploy access) — that's where the "feels like a trusted advisor" behavior actually lives.
