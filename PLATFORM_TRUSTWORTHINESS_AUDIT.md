# PLATFORM TRUSTWORTHINESS AUDIT — 2026-06-09

From-scratch audit (existing _\_REPORT.md/_\_AUDIT.md treated as UNVERIFIED). 8 parallel auditors,
each verifying from source against the 7 Trust Rules. Evidence is `file:line` under `apps/web/src`
unless noted. Backend = `apps/lifenavigator-core-api` (Fly).

## SCORES (0–100, 100 = trustworthy)

| Dimension                  | Score  | One-line basis                                                                             |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| Platform Architecture      | 45     | 3–4 net-worth formulas, 3 parallel data planes, 2 recommendation engines, many dead routes |
| Dashboard                  | 40     | 4 of ~13 widgets permanently broken; finance card bypasses canonical                       |
| UX                         | 45     | many blank stubs, intelligent-but-inert pages, dead CTAs, fake success states              |
| Data Integrity             | 30     | multiple fabricated-data pages shown as real; net-worth falls back to fake                 |
| Beta Readiness             | 30     | onboarding gate skips advisor; core finance pages empty/wrong                              |
| Single-Source (Redundancy) | 35     | net worth + recommendations each computed in multiple disagreeing places                   |
| **Trust (composite)**      | **33** | a fresh user cannot currently rely on what the platform shows                              |

Bright spots (where the model is _right_ and should be the template): `family`, `family-office`,
`benefits`, `education/certifications`, `wellness`, `health-intelligence`, `my-life`, `my-discovery`,
finance `overview`, the recommendation trust-API layer, and the `FinancialResolverPanel` —
all read a single canonical source, show lineage, and render honest MISSING states.

---

## TOP 25 FAILURES (ranked Impact × Risk × User Visibility)

### Tier A — Fabricated data shown as real (Rule 3 / Rule 1)

1. **`dashboard/roadmap/finance/page.tsx:266,422-487`** — fetches real roadmap then renders a hardcoded `mockRoadmap` ("Financial Freedom Plan"). Every user sees the same fake plan. _Fix: render fetched state; MISSING when null; delete mock._
2. **`dashboard/finance/page.tsx:300`** — `displayNetWorth = canonicalNetWorth ?? core?.netWorth ?? totals.netWorth`: on canonical failure silently shows a _client-computed_ net worth. The highest-trust number falls back to fake. _Fix: drop `?? totals.netWorth`; render MISSING._
3. **`dashboard/healthcare/page.tsx:54,131-200`** — domain landing page fetches non-existent `/api/healthcare` (404) and renders hardcoded zeros (0 score, 0/0 mmHg, 0 bpm, 0 lbs). _Fix: point at `/api/health/summary`; use Prompt pattern from `wellness`._
4. **`dashboard/healthcare/settings/page.tsx:87-114`** — fabricated emergency contact (`Jane Doe / jane@example.com / (555) 123-4567`) + fake privacy settings shown as the user's own (fake `setTimeout` latency, no fetch). _Fix: real fetch; empty state._
5. **`dashboard/healthcare/documents/[id]/page.tsx:56-73`** — any document id renders the same fake `Health_Insurance_Policy.pdf, AES-256`. _Fix: fetch by id; 404/MISSING._
6. **`dashboard/finance/connections` → `components/finance/FinancialIntegrations.tsx:44`** — Plaid `isConnected: true` hardcoded; every user sees "Plaid · Connected" + "Connected: 1" regardless of reality. _Fix: derive from `/api/integrations/plaid/accounts`._
7. **`dashboard/finance/risk/page.tsx:584,190,912`** — `humanCapitalValue = 2000000` hardcoded → "$2M need", "Risk Score: Low — Well protected" with no data source. _Fix: derive from canonical income or render MISSING._
8. **`dashboard/finance/legacy/page.tsx:61`** — `demoMode = true` hardwired; estate-tax tab presents "$2M ILIT saves $800k"-style math as analysis. _Fix: real fetch or label illustrative._
9. **`components/health/overview/components/MedicationTracker.tsx:78,143`** — `const adherenceRate = 95` shown as "95% Adherence Rate" for any user with ≥1 med. _Fix: compute from dose logs or show "—"._
10. **`dashboard/page.tsx` Future-Modules voting (`DashboardClient.tsx:124-146,899`)** — fabricated vote totals (127/95/203/78) + client increment, presented as real engagement. _Fix: remove or back with real table._
11. **`dashboard/healthcare/documents/scan/page.tsx:95-103`** — `processDocument()` fakes 2.5s OCR/encryption, marks complete, persists nothing. Deceptive success. _Fix: wire real upload/extract or disable._

### Tier B — Single-source / consistency violations (Rule 2 / Rule 6)

12. **Four disagreeing net-worth formulas.** `financial_resolver.py:142-143` (canonical) vs `domains/finance.py:139` (`sum(ALL accounts) − asset_loans` — **counts credit/loan/mortgage balances as positive assets → inflates**) vs `domains/finance.py:245-250` (third formula) vs client `finance/page.tsx:225-257` & `NetWorthSummary.tsx:12-20`. _Fix: delete the two backend formulas; everything delegates to the resolver._
13. **`components/financial/accounts/NetWorthSummary.tsx:12-20`** — net worth computed entirely client-side with its own formula (Rule 1+2+6). _Fix: accept canonical value as a prop._
14. **`api/dashboard/summary/route.ts:64-72`** — dashboard finance card re-implements net-worth math instead of reading canonical-summary. _Fix: read canonical._
15. **Two recommendation engines for one concept.** Dashboard preview uses `lib/finance/recommendations.ts` (`dashboard/page.tsx:32`, finance-only) while `/dashboard/recommendations` uses Core API `/v1/recommendations/roadmap`. Top action can contradict. _Fix: dashboard preview slices the same Core API roadmap._

### Tier C — Permanently broken core pages (Rule 5)

16. **Accounts page empty for every user.** `dashboard/finance/accounts/page.tsx:35` reads top-level `data.accounts`, but `/api/financial` proxies a DomainViewModel with accounts nested at `data.accounts` (note: nested under the VM). Page not run through `normalizeFinancePayload`. _Fix: normalize, or read `data?.data?.accounts ?? data?.accounts`._ (This is the live-reported "accounts broken" that prior audits called healthy — they tested with `CORE_API_URL` unset.)
17. **Investments page dead.** `dashboard/finance/investments/page.tsx:217` calls non-existent `/api/investments/analytics` (no `app/api/investments/` dir). Add/sync also 404. Plus `growthProjection` compounds hardcoded `1.07` (page:417-420). _Fix: create route → canonical `investment_balance`; strip 1.07._
18. **Retirement page dead + fabricated defaults.** `dashboard/finance/retirement/page.tsx:235` calls non-existent `/api/retirement/*`; dormant fake inputs `traditionalIRABalance ||400000`, `rothIRABalance ||100000`, `currentTaxableIncome:100000` (321-323). _Fix: wire routes (or remove); strip literals; use resolver's MISSING pattern._
19. **Assets page dead.** `dashboard/finance/assets/page.tsx:594` calls non-existent `/api/assets`; separately, canonical folds `finance.assets.current_value` into `investment_balance` (mislabels home equity as investments — `financial_resolver.py:139`). _Fix: add route + give assets their own canonical line._
20. **Career Opportunities + Networking dead.** `lib/api/career.ts:190-250,124-181` call ~12 routes that don't exist (`/api/career/jobs/all`, `/gigs/all`, `/linkedin/*`, dead OAuth URLs). Both pages permanently empty/non-functional. _Fix: repoint to real `/api/jobs/matches`/`/api/career/applications` or build routes._
21. **Goals page shows 0% for everything.** `dashboard/goals/page.tsx:139,144,148` reads camelCase `progressPercentage`/`targetDate` and compares `=== 'HIGH'`/`'COMPLETED'`, but API returns snake_case `progress_percent`/`target_date` and lowercase status. Every goal renders 0%, no date, grey badge. _Fix: read snake_case; case-insensitive compare._

### Tier D — Dashboard widget contracts (Rule 5)

22. **Healthcare card can never show data.** `api/dashboard/summary/route.ts:187-190` hardcodes `health.hasData:false`; no health read exists. _Fix: real health read._
23. **Today's Tasks always "No calendar connected."** `api/dashboard/tasks/route.ts` returns `{tasks: goals}` with no `hasCalendarConnection`; client gates on it (`DashboardClient.tsx:311`). Permanently dead. _Fix: return the flag or render goals._

### Tier E — Onboarding gate + invisible lineage

24. **Advisor-first onboarding NOT enforced (reported bug, confirmed).** `proxy.ts:107-125` gates only on `profiles.setup_completed`; `activate-persona/route.ts:191-213` sets it `true` at persona activation, before any advisor turn. Advisor is reachable only via a client `router.push` (`SampleFinancialProfile.tsx:67`) and fully skippable. _Fix: gate on a separate `advisor_onboarding_completed`; do not set `setup_completed` in activate-persona._ Also delete the dead/contradictory `/auth/verify-email` + `EmailVerification.tsx` (posts to a non-Supabase `?token=` endpoint → always "Verification Failed").
25. **Recommendation lineage built but never surfaced (Rule 4).** `/why`, `/evidence`, `/assumptions`, `/audit-trail`, `/counterfactuals` are correct, user-scoped, deterministic — but the only caller is a governance test. `recommendations/page.tsx` shows none of it. _Fix: add a "Why / Evidence" expander per card._

### Honorable mentions (not in top 25 but fix in passing)

- **Intelligent-but-inert pages that ignore working backends:** `education/courses` (ignores live `/api/education/courses`), `career/skills`, `education/path` — nice empty UI, `console.log` CTAs, never fetch.
- **Blank stub pages (no data, no intelligent state):** `roadmap/career`, `roadmap/education`, `roadmap/healthcare`, `education/overview`, `education/progress`, `dashboard/roadmap` (+ `insights`, `comprehensive`).
- **`career/resume`** shows "Coming Soon" banner over a fully working backend (Rule 6 contradiction).
- **Orphaned fabricated finance components** (0 imports, one wire-up from prod): `components/domain/finance/{InvestmentAdvice,FinancialGoals,FinancialInsights,IntegrationCards,BudgetPlanner,...}.tsx`. Delete.
- **`budget` page** never fetches (`setBudgets([])` TODO) — honest empty state, but no truth path.
- **`getSession()` on ~30 proxy routes** instead of `getUser()`. Low live risk (Core API re-validates the forwarded JWT) but a systematic deviation; standardize `api/life/_helper.ts` and proxy `token()` helpers.

### REFUTED prior claims

- "Recommendations render at top of dashboard" — **false.** Dashboard shows only a single top brief (`FirstInsightCard`) + NeedsAttention (1 NBA + ≤3 alerts); full list is on `/dashboard/recommendations`. `RecommendationsCard.tsx` is dead code.
- "`health/summary` fabricates data" — **false.** It is a pass-through proxy; the grep hit was a comment ("never fake data"). Its only defect is `getSession()`.
- "Accounts page healthy" — **false** (see #16).

---

## REPAIR PLAN — platform only (NO GraphRAG / AI / Decision-engine work)

### PHASE 1 — Stop showing fake data + fix the money number (trust-critical, ~1 sprint)

Goal: a user never sees fabricated data, and net worth is identical everywhere or honestly MISSING.

1. Delete/replace all fabricated-data renders: failures #1, #3, #4, #5, #6, #7, #8, #9, #10, #11. Each becomes an intelligent MISSING state.
2. Collapse net worth to one source: failures #2, #12, #13, #14. Backend `/summary` & `/net-worth` delegate to `FinancialInputResolver.summary()`; remove client formulas; remove the fallback-to-client chain.
3. Fix the onboarding gate: failure #24 (advisor-first enforced; `setup_completed` no longer set at persona activation; delete dead email-verify path).
4. Delete orphaned fabricated finance components so they can't be wired in.

### PHASE 2 — Make core pages render real data (functionality, ~1 sprint)

5. Fix the dead/empty core finance pages: #16 (accounts), #17 (investments), #18 (retirement), #19 (assets) — wire to real/canonical endpoints, strip dormant fake inputs.
6. Fix dashboard widget contracts: #22 (health card), #23 (tasks), notifications badge.
7. Fix goals display mismatch (#21) and career opportunities/networking dead routes (#20).
8. Reconcile recommendations to one engine (#15) and surface lineage (#25).

### PHASE 3 — UX cohesion + missing states (polish, ~1 sprint)

9. Replace every blank stub with an intelligent missing state that links to the right `/dashboard/*/add` flow (roadmap/\*, education/overview+progress).
10. Wire the intelligent-but-inert pages to their existing backends (education/courses, career/skills, education/path); remove `console.log` CTAs and the `career/resume` "Coming Soon" banner.
11. Standardize auth: `getUser()` on all data/proxy routes.
12. Add a lineage chip to every visible metric (source: Plaid persona / advisor / uploaded doc / tool run / user-entered), using the `family`/`my-life` pattern as the template.

### Cross-cutting principle for all phases

Every fix follows the existing **good** template (`family`, `my-life`, `FinancialResolverPanel`):
read ONE canonical source → show lineage → render an honest MISSING state with why/what-unlocks/how.
Frontend renders truth; it never computes it.
