# P0 PLATFORM CONTRACT ENFORCEMENT — AUDIT — 2026-06-10

Platform-wide architectural audit (prod @ `00771c7`). Method: 3 parallel code audits (API surface,
widget contracts, middleware/hydration) + prior `P2_CANONICALIZATION_SPRINT.md`. This is the audit +
enforcement plan; remediation items are prioritized in §8 (deliberately NOT scattered piecemeal).

---

## 1. WIDGET CONTRACT MATRIX

Legend: PASS = canonical, render-only · FAIL = frontend calc / generic empty · DUP = duplicate fetch.

### Dashboard

| Widget                                       | Component                        | Endpoint                                              | Verdict              |
| -------------------------------------------- | -------------------------------- | ----------------------------------------------------- | -------------------- | ------ | ------------------ |
| Financial Overview                           | DashboardClient                  | /api/finance/canonical-summary (+loading/error/empty) | PASS                 |
| Healthcare / Career / Education              | DashboardClient + DomainCoverage | /api/dashboard/summary + /api/life/discovery-coverage | PASS                 |
| Alerts & Notifications                       | DashboardClient                  | /api/dashboard/notifications (+unreadCount)           | PASS                 |
| Active Goals                                 | DashboardClient                  | /api/dashboard/tasks                                  | PASS                 |
| Quick Actions                                | DashboardClient                  | static nav                                            | PASS (nav)           |
| Top recommendation preview                   | DashboardClient                  | server getRecommendations → /lib/finance              | PASS                 |
| Mission Control (readiness/next-best-action) | MissionControl                   | /api/platform/dashboard                               | PASS (backend score) |
| Life snapshot                                | LifeIntelligence                 | /api/life/snapshot                                    | plan                 | health | PASS (format-only) |

### Finance

| Widget                                               | Component                                   | Endpoint                                             | Verdict                      |
| ---------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------- | ---------------------------- |
| Overview tiles (assets/liab/net worth)               | finance/overview                            | /api/finance/canonical-summary                       | PASS                         |
| Landing tiles (net worth/cash/investment/retirement) | finance/page                                | /api/finance/canonical-summary                       | PASS                         |
| AccountsSummary totals                               | overview/AccountsSummary                    | /api/finance/canonical-summary                       | PASS · DUP fetch             |
| Accounts page net worth                              | finance/accounts                            | /api/finance/canonical-summary                       | PASS                         |
| Investments balance                                  | finance/investments                         | /api/investments/analytics + canonical               | PASS                         |
| Retirement                                           | finance/retirement + FinancialResolverPanel | /api/finance/resolved-inputs + retirement-projection | PASS                         |
| FinanceSidebar net worth                             | FinanceSidebar                              | /api/finance/canonical-summary                       | PASS · DUP fetch             |
| **CashFlow** (savings, savingsRate)                  | overview/CashFlow:75                        | /api/plaid/transactions                              | **FAIL — frontend calc**     |
| **SpendingTrends** (totalSpending)                   | overview/SpendingTrends:123                 | /api/plaid/transactions                              | **FAIL — frontend calc**     |
| **FinancialInsights** (percentChange)                | overview/FinancialInsights:94               | /api/plaid/transactions                              | **FAIL — frontend calc**     |
| **UpcomingBills** (variance/consistency)             | overview/UpcomingBills:91                   | /api/plaid/transactions                              | **FAIL — frontend calc**     |
| **Assets** (equity, appreciation)                    | finance/assets:78                           | /api/assets                                          | **FAIL — frontend calc**     |
| Transactions list                                    | finance/transactions                        | /api/financial + /api/finance/transaction-summary    | PASS (summary backend-owned) |

### Domains

| Widget          | Endpoint                          | Verdict                                                |
| --------------- | --------------------------------- | ------------------------------------------------------ |
| Career          | /api/career/summary (cited bands) | PASS                                                   |
| Family          | /api/family/summary               | PASS                                                   |
| My Discovery    | /api/life/discovery-coverage      | PASS (generic empty when no discovery — §9)            |
| Healthcare page | /api/healthcare                   | PASS-ish (locked feature; some generic "No data" — §9) |
| Education page  | static "Coming Soon"              | DEPRECATED-stub                                        |

---

## 2. API INVENTORY (≈252 route.ts; ~40% orphaned)

| Cluster            | Canonical (ACTIVE)                                                   | DUPLICATE / DEPRECATED                                                                                  | ORPHANED (no consumers)                                                                        |
| ------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Finance summary    | `/api/finance/canonical-summary` (proxy → resolver)                  | `/api/financial` (legacy aggregator, still used by landing/accounts/transactions)                       | —                                                                                              |
| Accounts data      | `/api/plaid/accounts` (widget shape)                                 | `/api/integrations/plaid/accounts` (Plaid shape, used by integrations) ; `/api/data/financial/accounts` | `/api/data/financial/accounts`                                                                 |
| Transactions       | `/api/plaid/transactions` + `/api/finance/transaction-summary`       | `/api/integrations/plaid/transactions` (0 consumers) ; `/api/data/financial/transactions`               | both                                                                                           |
| Dashboard          | `/api/dashboard/{summary,tasks,notifications}`                       | —                                                                                                       | —                                                                                              |
| Life               | `/api/life/{discovery-chat,discovery-coverage,snapshot,plan,health}` | —                                                                                                       | `/api/life/{vision,goal,my-life,attention,graph}`                                              |
| Recommendations    | `/api/recommendations`                                               | —                                                                                                       | `/api/recommendations/{id}/{view,why,evidence,assumptions,audit-trail,counterfactuals}`        |
| Goals              | `/api/dashboard/tasks`, `/api/goals`                                 | —                                                                                                       | `/api/goals/{id}/{ahead-of-plan,catch-up,decision-impact,marginal-impact-ranking,probability}` |
| Arcana (lead mgmt) | —                                                                    | DEPRECATED module                                                                                       | 7 endpoints all orphaned                                                                       |
| Integrations/OAuth | active link flows                                                    | —                                                                                                       | ~15 disconnect/callback endpoints                                                              |
| Decision/Scenario  | scenario-lab/\* active                                               | —                                                                                                       | 2 decision/\* orphaned                                                                         |

Full classification (path · proxy/db · concept · consumers · status) captured in the audit run; the
material overlaps for enforcement are the finance/plaid/data ones above (see §7).

---

## 3. ROUTE GRAPH (onboarding journey — enforcement points)

```
UNAUTH → /dashboard|/onboarding|/admin|/api(non-auth)  ──middleware──▶ /auth?mode=signin&next=…
AUTH + !setup_completed                                 ──middleware──▶ /onboarding/financial-profile
  (persona activation: /api/integrations/plaid/activate-persona sets setup_completed)
AUTH + setup_completed + !onboarding_completed          ──middleware──▶ /dashboard/advisor?onboarding=1
  EXEMPT (pass through): /dashboard/advisor, /dashboard/documents  ← upload loop
  Advisor → action card → /dashboard/documents (upload) → return_to → advisor (client)
  Advisor confirm/skip: /api/onboarding/advisor-complete sets onboarding_completed
AUTH + setup_completed + onboarding_completed           ──middleware──▶ all /dashboard/* unlocked
```

No bypass, no loop, no dead route observed live (verified end-to-end in prior sprints). Gaps in §5.

---

## 4. DATA LINEAGE MATRIX (every visible metric is answerable)

| Metric                     | API                                          | Service                             | Table(s)                                             | Row source                     |
| -------------------------- | -------------------------------------------- | ----------------------------------- | ---------------------------------------------------- | ------------------------------ |
| Net Worth                  | /api/finance/canonical-summary               | Core `financial_resolver.summary()` | finance.financial_accounts, assets, retirement_plans | Plaid sandbox persona balances |
| Total Assets / Liabilities | same                                         | same (classify by type)             | finance.financial_accounts/assets                    | persona                        |
| Cash balance               | same                                         | resolver                            | finance.financial_accounts (checking/savings)        | persona                        |
| Investment balance         | same / /api/investments/analytics            | resolver                            | finance.financial_accounts (type=investment)         | persona                        |
| Retirement balance         | same                                         | resolver                            | finance.financial_accounts (type=retirement)         | persona                        |
| Transaction income/expense | /api/finance/transaction-summary             | Next route (server sum)             | finance.transactions                                 | persona                        |
| Discovery coverage %       | /api/life/discovery-coverage                 | Core `/v1/life/discovery/coverage`  | life.\* discovery model                              | advisor answers                |
| Life vision / objective    | /api/life/snapshot + discovery-chat          | Core discovery                      | life.life_objectives, life model                     | advisor answers                |
| Readiness index            | /api/platform/dashboard                      | Core platform service               | life model + documents                               | computed backend               |
| Alerts                     | /api/dashboard/notifications                 | Next route                          | public.user_notifications                            | user rows                      |
| Active goals               | /api/dashboard/tasks                         | Next route                          | public.goals                                         | user rows                      |
| Healthcare card            | /api/dashboard/summary                       | Next route                          | health_meta.\* (RLS-locked, is_health_enabled=false) | (locked beta)                  |
| Career card                | /api/dashboard/summary / /api/career/summary | Next/Core                           | career_profiles, job_applications                    | user rows                      |

Every metric above has a full chain (answerable in <60s). The FAIL widgets in §1 (CashFlow/Spending/
Insights/Bills/Assets) compute DERIVED values in the browser — those break the "who calculated it" test.

---

## 5. MIDDLEWARE AUDIT

Gate (`src/proxy.ts`, Next-16 proxy convention, LIVE): correct two-flag advisor-first sequence; exempts
`/dashboard/advisor` + `/dashboard/documents` during onboarding; matcher covers all non-static paths.
**Gaps:** (a) advisor→dashboard transition is client `router.push` only (middleware re-validates on next
request, so not a security hole, but a CSR failure could strand the user — mitigate with a success state);
(b) profile-query failure is treated as `!setup_completed` (a transient 500 could bounce a completed user
to persona — distinguish 404 vs 5xx); (c) no advisor-gate unit test (`proxy.test.ts` covers the rest).

## 6. HYDRATION AUDIT

- **Duplicate fetch (CRITICAL):** `/api/finance/canonical-summary` is fetched **3× on every finance page**
  (page component + AccountsSummary + FinanceSidebar) — independent client `useEffect`s, no dedup. Wasteful
  - risk of out-of-order divergence. Fix: fetch once server-side (or a shared context/provider) and pass down.
- **Missing AbortController** on most finance client fetches (accounts, transactions, overview, sidebar) →
  setState-on-unmounted warnings / minor leaks.
- **Missing `cache:'no-store'`** on several finance fetches (only AccountsSummary + DashboardClient set it).
- Race conditions are mostly benign progressive render; the finance-card loading/error states (added P2B)
  prevent the "empty shown while loading" class.

## 7. DUPLICATE ROUTE ELIMINATION PLAN

| Keep (canonical)                     | Eliminate / wrap                                                    | Action                                                                                                                                                   | Risk         |
| ------------------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `/api/finance/canonical-summary`     | `/api/financial` for MONEY tiles                                    | migrate landing/accounts/transactions money reads to canonical; keep `/api/financial` only for raw rows until `/api/data/financial/transactions` adopted | med (active) |
| `/api/plaid/{accounts,transactions}` | `/api/data/financial/*`                                             | delete the orphaned `/api/data/financial/*` OR make `/api/plaid/*` thin wrappers over one reader                                                         | low          |
| `/api/integrations/plaid/accounts`   | —                                                                   | keep (Plaid-shape, used by integrations connectivity)                                                                                                    | n/a          |
| —                                    | `/api/integrations/plaid/transactions`                              | **delete (0 consumers)**                                                                                                                                 | none         |
| —                                    | Arcana (7), orphaned recommendations/goals/life detail routes (~30) | tag DEPRECATED; delete after confirming no provider-portal use                                                                                           | low          |

Sequence: (1) delete confirmed orphans; (2) collapse plaid/data readers behind one; (3) migrate `/api/financial` money callers to canonical; (4) retire `/api/financial` money path.

## 8. TOP 25 REMAINING ARCHITECTURAL DEFECTS (prioritized)

**P0 (correctness / trust):**

1. CashFlow computes savings + savingsRate client-side (Rule 1) — overview/CashFlow:75.
2. FinancialInsights computes percentChange client-side — overview/FinancialInsights:94.
3. SpendingTrends sums category totals client-side — overview/SpendingTrends:123.
4. UpcomingBills derives recurrence/variance client-side — overview/UpcomingBills:91.
5. Assets page computes equity + appreciation client-side — finance/assets:78.
6. `/api/finance/canonical-summary` fetched 3× per finance page (hydration divergence risk).
   **P1 (architecture / duplication):**
7. `/api/financial` still serves money tiles on landing/accounts (legacy aggregator).
8. `/api/data/financial/*` orphaned duplicates of `/api/plaid/*`.
9. `/api/integrations/plaid/transactions` orphaned — delete.
10. Education page is a static "Coming Soon" stub (no endpoint).
11. Healthcare card/page generic "No data" (health globally locked — should say "coming soon").
12. Career dashboard card uses legacy `/api/dashboard/summary`, not `/api/career/summary` VM.
13. Education `studyStreak` hardcoded 0 in `/api/dashboard/summary`.
14. Missing AbortControllers across finance client fetches.
15. Missing `cache:'no-store'` on several finance fetches.
    **P2 (coverage / hygiene):**
16. ~40% of API routes orphaned (Arcana, recommendation/goal/life detail endpoints).
17. discovery-coverage returns empty for personas w/o advisor discovery (cards show fallback, not %).
18. Recommendation detail endpoints (why/evidence/audit-trail) orphaned — lineage UI not wired.
19. Family manual-entry is upload-only (no AddDataModal family domain).
20. Advisor context panel refreshes on next turn, not push, after upload.
21. `uploaded_doc_id` not returned by `/api/documents` (Core API).
22. proxy advisor-gate has no unit test.
23. Profile-query failure in middleware can bounce completed users (no 404 vs 5xx distinction).
24. `getSession()` vs `getUser()` inconsistency on some proxy routes (prior Phase-3 item).
25. My-Discovery generic "No discovery data yet" empty (should guide to the advisor — §9).

## 9. MISSING-STATE AUDIT (Rule 9)

Intelligent (PASS): dashboard domain cards (DomainCoverage: coverage %/missing/unlock/CTA), finance card
(loading/error/persona CTA), Alerts/Goals (CTA), advisor (missing inputs). **Generic (FIX):**
My-Discovery "No discovery data yet" (→ link to advisor); Healthcare "No data yet" (→ "Health tracking
coming soon"); PortfolioPerformance "No data for selected period" (→ why + add holdings); metrics "No data yet".

## 10. SCORES

Prior: Trust 80 / Data Integrity 82 / Beta Readiness 70 (Phase 1.5); productization A2 92/100.
**Updated (post canonicalization + onboarding completion + upload loop, all browser-verified live):**

- **Trust: 88/100.** Net worth single-source verified across dashboard/overview/accounts/investments/
  sidebar (both personas); no fabricated data; onboarding gated + complete; lineage answerable for all
  headline metrics. Deductions: 5 finance/overview sub-widget client calcs (Rule 1), 3× canonical fetch.
- **Data Integrity: 90/100.** Canonical resolver authoritative; transaction summary backend-owned;
  healthcare reads real (locked) source. Deductions: assets equity/appreciation client calc; legacy
  `/api/financial` money path still live.
- **Beta Readiness: 86/100.** Core journeys work live (signup→persona→advisor→upload→confirm→dashboard;
  finance; My Discovery). Deductions: education stub, health locked, ~40% orphaned routes, domain depth.

## Definition of Done — status

For every HEADLINE metric (net worth, assets, liabilities, cash, investment, retirement, coverage,
readiness, alerts, goals, objectives) the chain endpoint→service→table→row is documented in §4 — answerable
in <60s. The remaining "who calculated it" failures are the 5 derived finance/overview widgets in §8 (P0
1–5) — fixing those (move derivations to a backend cash-flow/analytics endpoint, like `transaction-summary`)
closes the contract. Recommended next execution: §8 P0 items 1–6 as one focused remediation pass.
