# P0 WIDGET CONTRACT AUDIT — 2026-06-10

Branch `fix/platform-trust-stabilization` @ `f1fd7d1`. Chain: Widget → Component → Hook → API route →
Backend → DB. Verified against code + the live preview (married_family + executive personas, headless Chromium).

## DASHBOARD WIDGETS

| Widget                          | Component                             | Hook/fetch                                       | API                              | Backend                              | DB                                                 | Canonical?                                    | Failure type                                     | Status/Fix                                             |
| ------------------------------- | ------------------------------------- | ------------------------------------------------ | -------------------------------- | ------------------------------------ | -------------------------------------------------- | --------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| Financial Overview              | `DashboardClient.tsx` (card ~490)     | inline `fetch('/api/finance/canonical-summary')` | `/api/finance/canonical-summary` | Core `/v1/finance/canonical-summary` | finance.financial_accounts/assets/retirement_plans | ✅ canonical                                  | **E (empty shown during loading/fetch-failure)** | **FIXED f1fd7d1**: loading/error/empty states          |
| Healthcare Overview             | `DashboardClient.tsx` (~590)          | `/api/dashboard/summary`                         | `/api/dashboard/summary`         | (Next route, direct Supabase)        | health: **hardcoded `hasData:false`**              | ❌ legacy + dead                              | **B + F (never returns health data)**            | P1: point at a real health summary; today always empty |
| Career Overview                 | `DashboardClient.tsx` (~633)          | `/api/dashboard/summary`                         | `/api/dashboard/summary`         | Next route                           | career_profiles, job_applications                  | ⚠️ real via legacy summary                    | B (legacy summary, not canonical)                | P2: empty is correct for personas w/o career data      |
| Education Overview              | `DashboardClient.tsx` (~685)          | `/api/dashboard/summary`                         | `/api/dashboard/summary`         | Next route                           | courses; **studyStreak hardcoded 0**               | ⚠️ real via legacy + F                        | F (studyStreak literal 0)                        | P2                                                     |
| Alerts & Notifications          | `DashboardClient.tsx` (~740)          | `/api/dashboard/notifications`                   | `/api/dashboard/notifications`   | Next route                           | user_notifications                                 | ⚠️ real, but **`unreadCount` never returned** | D (shape: badge never shows)                     | P2                                                     |
| Tasks → "Active Goals"          | `DashboardClient.tsx` (~848)          | `/api/dashboard/tasks`                           | `/api/dashboard/tasks`           | Next route                           | goals                                              | ✅ real                                       | (was D, FIXED earlier)                           | renders real goals                                     |
| Quick Actions                   | `DashboardClient.tsx` (~430)          | none                                             | none                             | none                                 | none                                               | n/a (static nav)                              | F (hardcoded)                                    | acceptable (nav, not data)                             |
| Top recommendation (was at top) | `FirstInsightCard.tsx` via `page.tsx` | server `getRecommendations`                      | n/a (server)                     | `lib/finance/recommendations`        | finance.\*                                         | n/a                                           | **mounted at top (uncommitted removal)**         | **FIXED 4918486**: removed; preview only in Alerts     |

## FINANCE WIDGETS

| Widget                                      | Component                                                | Hook/fetch                                                            | API                                  | Backend                    | DB                                           | Canonical?          | Failure type                              | Status/Fix                                            |
| ------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------ | -------------------------- | -------------------------------------------- | ------------------- | ----------------------------------------- | ----------------------------------------------------- |
| Overview tiles (assets/liab/net worth)      | `finance/overview/page.tsx`                              | `fetch('/api/finance/canonical-summary')`                             | same                                 | Core canonical             | finance.\*                                   | ✅ canonical        | —                                         | OK                                                    |
| Overview · AccountsSummary                  | `overview/AccountsSummary.tsx`                           | `/api/plaid/accounts`                                                 | **NEW** `/api/plaid/accounts`        | Next route                 | finance.financial_accounts                   | ✅ canonical tables | was **C (404)** + classify-by-sign        | **FIXED**: route created + classify-by-type           |
| Overview · CashFlow/Spending/Bills/Insights | `overview/*.tsx`                                         | `/api/plaid/transactions`                                             | **NEW** `/api/plaid/transactions`    | Next route                 | finance.transactions                         | ✅                  | was **C (404)**                           | **FIXED**: route created; "No data" honest if no txns |
| Accounts page                               | `finance/accounts/page.tsx` + `AccountCard`              | `/api/financial` + `/api/finance/canonical-summary`                   | both                                 | Core summary / canonical   | finance.financial_accounts                   | ✅                  | was **crash** (shape)                     | **FIXED**: normalize + defensive AccountCard          |
| Transactions page                           | `finance/transactions/page.tsx`                          | `/api/financial`                                                      | `/api/financial`                     | Core `/v1/finance/summary` | finance.transactions                         | ✅                  | —                                         | OK (empty if no txns)                                 |
| Assets page                                 | `finance/assets/page.tsx`                                | `/api/assets`                                                         | **NEW** `/api/assets`                | Next route                 | finance.assets (classified, mirror-dedup)    | ✅                  | was **C (404)**                           | **FIXED**                                             |
| Investments page                            | `finance/investments/page.tsx`                           | `/api/investments/analytics` + canonical                              | **NEW** `/api/investments/analytics` | Next route                 | finance.financial_accounts (type=investment) | ✅                  | was **C (404)**                           | **FIXED**                                             |
| Retirement page                             | `finance/retirement/page.tsx` + `FinancialResolverPanel` | `/api/finance/resolved-inputs` + `/api/finance/retirement-projection` | both                                 | Core resolver              | finance.financial_accounts (type=retirement) | ✅                  | —                                         | OK                                                    |
| Finance sidebar "Connected Accounts"        | `FinanceSidebar.tsx`                                     | was `/api/plaid/accounts` sum                                         | now `/api/finance/canonical-summary` | Core canonical             | finance.\*                                   | ✅                  | was **C (404 → "No accounts connected")** | **FIXED 1502b4a**: net worth + count                  |

## The three specific questions — exact code paths

### Why Dashboard said "No financial data yet" while Finance has data

`DashboardClient.tsx` finance card rendered `{canonicalFinance ? <data> : "No financial data yet"}`.
`canonicalFinance` starts `null` and is only set after `fetch('/api/finance/canonical-summary')` resolves
with a numeric `net_worth`. So the empty copy showed: (a) during the in-flight fetch, and (b) **permanently
if the fetch failed** (401/timeout/network) — the `.catch(()=>{})` swallowed it with no error/loading state.
The Finance page works because it has its own fetch + the `FinancialResolverPanel`. **Failure type E**
(fallback/empty shown despite valid data being one successful fetch away). **Fixed in `f1fd7d1`**: added
`financeStatus: loading|ready|error` → spinner while loading, "Open Financial Overview" on error, and the
empty state ONLY after a successful fetch with no accounts.

### Why Investments showed $0

`finance/investments/page.tsx` → `/api/investments/analytics` → `finance.financial_accounts WHERE
account_type='investment'`. The screenshot persona is **married_family, which has ZERO investment
accounts** → `investment_balance = 0` → "$0 / No Investment Holdings Yet" (the honest empty state). **This
is the CORRECT value for that persona**, not a bug. The "investment fixed" claim was for the **executive**
persona, where the same path now returns **$920,000** (validated live: `total=920000`, `holdings=[]`). So:
married_family $0 = correct; executive $920K = correct. Failure type: none (correct per-persona state).

### Why "No accounts connected" rendered while accounts exist

`FinanceSidebar.tsx` previously did `fetch('/api/plaid/accounts')` and summed balances — but
`/api/plaid/accounts` **did not exist** (404) → `count:0` → "No accounts connected". **Failure type C
(dead endpoint).** **Fixed in `1502b4a`**: now `fetch('/api/finance/canonical-summary')` → renders
"Net Worth · {accounts_count} accounts · {net_worth}" (verified live: "Net Worth · 5 accounts · −$376,940").

## BROKEN WIDGET MATRIX (remaining, after fixes)

| Priority | Widget                          | Current source                                    | Correct source                 | Failure | Fix                                 |
| -------- | ------------------------------- | ------------------------------------------------- | ------------------------------ | ------- | ----------------------------------- |
| **P0**   | Dashboard Financial Overview    | canonical (no loading state)                      | canonical + loading/error      | E       | DONE f1fd7d1                        |
| **P1**   | Dashboard Healthcare card       | `/api/dashboard/summary` (health hardcoded false) | a real health summary endpoint | B+F     | TODO: wire health read or hide card |
| P2       | Dashboard Education studyStreak | hardcoded `0`                                     | courses/study_logs             | F       | compute or drop the metric          |
| P2       | Dashboard Alerts badge          | `/api/dashboard/notifications` (no `unreadCount`) | add `unreadCount`              | D       | return + render unread count        |
| P2       | Dashboard Career card           | `/api/dashboard/summary` (legacy)                 | canonical career VM            | B       | migrate to canonical career summary |

## Why the screenshots vs my validation differed

Two real reasons: (1) my dashboard Finance card fix + the `page.tsx` top-block removal were **committed only
in `4918486`/`f1fd7d1`** — earlier per-commit preview URLs (or a cached bundle) show the old UI; test the
**latest** preview with a hard refresh. (2) `married_family` legitimately has $0 investments / no retirement.

## Definition of Done — status

Finance widgets read canonical (no dead endpoints, no client business math for net worth): ✅ on latest.
Dashboard Financial Overview no longer shows empty during load/error: ✅ (f1fd7d1). Remaining: P1 Healthcare
card (legacy summary), P2 education/alerts/career legacy fields. No widget renders empty when canonical data
exists **after a successful fetch** ✅.
