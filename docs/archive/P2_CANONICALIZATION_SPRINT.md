# P2 PLATFORM CANONICALIZATION SPRINT — 2026-06-10

Branch `fix/platform-trust-stabilization`. Full platform mapped via parallel domain audits, then the
safe high-value canonical fixes applied + browser-verified. This documents the architecture, what was
fixed this sprint, and what remains (with exact files) so the rest is a known, bounded plan.

---

## DELIVERABLE 1 — Canonical Architecture Map (DB → Service → API → Hook → Component)

### Finance (canonical — the model is correct)

```
finance.financial_accounts / assets / retirement_plans / transactions   (DB)
  → Core API financial_resolver.summary()                               (Service)
  → GET /v1/finance/canonical-summary                                   (Backend)
  → GET /api/finance/canonical-summary  (Next proxy, force-dynamic)     (Canonical API)
  → inline fetch in each component                                      (Hook)
  → DashboardClient finance card · finance/overview tiles · accounts NetWorthSummary ·
    investments banner · FinanceSidebar · AccountsSummary footer        (Components)
```

Net worth / assets / debt / cash / investment / retirement now originate ONLY here.

### Life / readiness / domains (canonical)

```
Core API  → /v1/platform/dashboard         → /api/platform/dashboard       → MissionControl (readiness index, next best action)
          → /v1/life/snapshot|plan|health  → /api/life/snapshot|plan|health → LifeIntelligence (vision, objectives, model quality)
          → /v1/life/discovery/coverage    → /api/life/discovery-coverage   → /dashboard/my-discovery (coverage %, missing, unlocks, cta)
          → /v1/career/summary             → /api/career/summary            → career page (DomainViewModel: data, recs, missing, confidence)
          → /v1/family/summary             → /api/family/summary            → family page (DomainViewModel)
```

All readiness/risk/confidence scores are BACKEND-computed (verified: no score arithmetic in
LifeIntelligence/MissionControl/DashboardClient).

### Dashboard cards (mixed — see defects)

```
goals (DB)            → /api/dashboard/tasks          → DashboardClient "Active Goals"   ✅ real
user_notifications    → /api/dashboard/notifications  → DashboardClient "Alerts"         ✅ real (+unreadCount now)
career/courses/health → /api/dashboard/summary        → DashboardClient domain cards     ⚠️ legacy aggregator (not the canonical DomainViewModels)
health_meta.*         → /api/dashboard/summary        → Healthcare card                  ✅ reads real source; globally locked (is_health_enabled=false)
```

---

## DELIVERABLE 2 — Legacy Elimination Matrix

| Legacy path                                                                        | Replacement (canonical)                                                              | Used by                                       | Safe to delete?                                                              |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------- | ---------------------------------------------------------------------------- |
| `components/dashboard/FirstInsightCard.tsx`                                        | (none; preview lives in Alerts)                                                      | nothing                                       | ✅ **DELETED this sprint**                                                   |
| `components/dashboard/RecommendationsCard.tsx`                                     | `/dashboard/recommendations`                                                         | nothing                                       | ✅ **DELETED this sprint**                                                   |
| `/api/integrations/plaid/transactions`                                             | `/api/data/financial/transactions`                                                   | 0 consumers                                   | ✅ yes (orphan) — not yet deleted                                            |
| `/api/plaid/accounts` · `/api/plaid/transactions`                                  | `/api/data/financial/*` (after shape-adapter)                                        | AccountsSummary + 4 overview widgets          | ⚠️ risky — widgets depend on the shape; consolidate behind one adapter first |
| `/api/integrations/plaid/accounts`                                                 | `/api/data/financial/accounts`                                                       | FinancialIntegrations connectivity check      | ⚠️ risky (Plaid-native shape)                                                |
| `/api/financial?timeframe=` (legacy aggregator)                                    | `/api/finance/canonical-summary` (money) + `/api/data/financial/transactions` (rows) | finance landing, accounts, transactions pages | ⚠️ risky — actively used; migrate page-by-page                               |
| `/api/financial/retirement-calculator/*` (404)                                     | Core `/v1/finance/retirement-projection`                                             | `useRetirementCalculator` hook                | build or repoint (currently silent-fails)                                    |
| `/api/financial/{goals,budget,investments/insights,risk,performance,legacy}` (404) | Core API equivalents                                                                 | roadmap/investment subcomponents              | build or return honest "unavailable" (currently graceful-empty)              |

---

## DELIVERABLE 3 — Widget Contract Matrix (PASS/FAIL)

| Widget                                                  | Current source                                          | Canonical source                         | Status                                          |
| ------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------- |
| Dashboard · Financial Overview                          | `/api/finance/canonical-summary` (+loading/error/empty) | same                                     | ✅ PASS                                         |
| Dashboard · Healthcare                                  | `/api/dashboard/summary` → health_meta (locked)         | reads canonical source; honest empty     | ✅ PASS (computed, not hardcoded)               |
| Dashboard · Career                                      | `/api/dashboard/summary` (legacy)                       | `/api/career/summary` DomainViewModel    | ⚠️ FAIL — works but not canonical VM (P2)       |
| Dashboard · Education                                   | `/api/dashboard/summary` (studyStreak hardcoded 0)      | education summary (none yet)             | ⚠️ FAIL — `studyStreak:0` literal (P2)          |
| Dashboard · Alerts                                      | `/api/dashboard/notifications` (+unreadCount)           | same                                     | ✅ PASS                                         |
| Dashboard · Tasks/Active Goals                          | `/api/dashboard/tasks` → goals                          | same                                     | ✅ PASS                                         |
| Dashboard · Quick Actions                               | static nav (now bottom)                                 | n/a                                      | ✅ PASS (shortcuts)                             |
| Finance · Overview tiles                                | `/api/finance/canonical-summary`                        | same                                     | ✅ PASS                                         |
| Finance · AccountsSummary totals                        | **canonical** (was client-summed)                       | `/api/finance/canonical-summary`         | ✅ PASS (**fixed this sprint**)                 |
| Finance · landing net worth                             | `canonicalNetWorth` only (no fallback)                  | canonical                                | ✅ PASS                                         |
| Finance · landing sub-tiles (banking/investment/crypto) | client `.reduce` (`calculateTotals`)                    | canonical cash/investment fields         | ❌ FAIL — frontend sums (P1)                    |
| Finance · Accounts page                                 | `/api/financial` rows + canonical net worth             | canonical + rows                         | ✅ PASS (net worth canonical; rows are display) |
| Finance · Transactions page                             | `/api/financial` + client income/expense `.reduce`      | canonical cash-flow (rows OK for detail) | ❌ FAIL — frontend sums income/expenses (P1)    |
| Finance · Assets page                                   | `/api/assets` (server computes summary)                 | server summary                           | ✅ PASS                                         |
| Finance · Investments                                   | `/api/investments/analytics` + canonical balance        | canonical                                | ✅ PASS (married $0 / exec $920K)               |
| Finance · Retirement                                    | resolver `/api/finance/*`                               | canonical resolver                       | ✅ PASS                                         |
| Finance · Sidebar                                       | `/api/finance/canonical-summary`                        | same                                     | ✅ PASS                                         |

---

## DELIVERABLE 4 — Remaining Trust Defects (with files)

### P1

- **Finance landing sub-tiles compute totals in frontend** — `app/dashboard/finance/page.tsx`
  `calculateTotals()` (lines ~230-273) still sums banking/investment/crypto via `.reduce`. Net worth is
  already canonical-only; map these tiles to `canonicalSummary.cash_balance / investment_balance` and
  delete `calculateTotals`.
- **Transactions page computes income/expenses in frontend** — `app/dashboard/finance/transactions/page.tsx`
  (lines ~105-113) `.reduce` over rows for summary income/expense. Move to a canonical cash-flow field.
- **Domain cards not using Discovery Coverage (Rule 5)** — `components/dashboard/DashboardClient.tsx`
  Healthcare/Career/Education/Family empty states still say "No X data / Enter Data". The reusable system
  exists (`/api/life/discovery-coverage` → `{coverage_pct,status,confidence_pct,missing[],unlocks[],cta}`,
  already rendered by `/dashboard/my-discovery`). Wire each card's empty state to coverage %, missing
  inputs, unlocks, and a next-action CTA. (Bounded; recommend confirming the card layout first.)

### P2

- **Career card on legacy aggregator** — `/api/dashboard/summary` vs canonical `/api/career/summary`.
- **Education `studyStreak` hardcoded `0`** — `app/api/dashboard/summary/route.ts` return (compute or drop).
- **Healthcare empty-state copy** — says "Add your health information" while the feature is globally
  locked (`is_health_enabled()`=false); change to "Health tracking coming soon".
- **Route consolidation** — collapse `/api/plaid/*`, `/api/integrations/plaid/*`, `/api/data/financial/*`
  behind one source + shape adapters; migrate `/api/financial` callers to canonical; delete the orphan
  `/api/integrations/plaid/transactions`. (Risky — do behind tests, page-by-page.)
- **Missing `/api/financial/*` routes** (retirement-calculator, investments insights/risk/performance,
  goals, budget) — build against Core API or return honest "unavailable" instead of 404.
- **Lineage (Rule 7)** — finance surfaces show "Source: Plaid Sandbox Persona · Updated …"; extend the
  same Source/Updated/Confidence line to career/family/education cards.

---

## Fixed & browser-verified this sprint (commit cff3b26)

- Rule 1: AccountsSummary reads canonical totals (was client-summed) — verified $1,533,200 / $1,243,120
  matches the canonical tiles.
- Rule 4: deleted dead `FirstInsightCard` + `RecommendationsCard`.
- Rule 6: Quick Actions moved to the bottom — verified render order FinancialOverview → ActiveGoals → QuickActions.
- Notifications `unreadCount` returned (alerts badge can render).
- (Earlier this program: net worth single-source, dashboard finance card loading/error states, top-brief
  removal, healthcare card reads real source, /api/plaid/\* created, AccountCard defensive.)

## Honest status

The canonical finance MODEL is single-source and correct; net worth agrees across dashboard, overview,
accounts, investments, sidebar (browser-verified, both personas). The remaining FAILs are bounded and
listed above with files — chiefly: 2 frontend sum sites (finance landing sub-tiles, transactions),
Rule 5 discovery-coverage cards, and route consolidation. None fabricate data; none affect net worth.
