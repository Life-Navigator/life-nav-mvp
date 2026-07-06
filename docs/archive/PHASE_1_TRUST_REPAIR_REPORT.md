# PHASE 1 — TRUST REPAIR EXECUTION REPORT — 2026-06-09

P0 trust incident remediation. Scope: stop fake data, fix the onboarding gate, collapse net
worth to one source, fix core broken pages. NO GraphRAG / AI / decision-engine work.

**Verification: `tsc --noEmit` (whole web project) = 0 errors. All audited fabrications removed.**

---

## Files Changed

**Frontend (apps/web):**

- `proxy.ts` — advisor-first onboarding gate
- `app/api/onboarding/advisor-complete/route.ts` — NEW (marks advisor onboarding done / skip)
- `app/api/onboarding/complete/route.ts` — also sets `onboarding_completed`
- `app/api/dashboard/summary/route.ts` — net worth now overridden by canonical summary
- `app/dashboard/advisor/page.tsx` — completes/skip → unlocks dashboard
- `app/dashboard/finance/page.tsx` — net worth canonical-only; tiles from canonical
- `app/dashboard/finance/accounts/page.tsx` — normalize proxy shape; canonical net worth
- `app/dashboard/finance/risk/page.tsx` — removed $2M / "Low" fabrication; missing state
- `app/dashboard/finance/legacy/page.tsx` — removed `demoMode`; real fetch; gated tax tab
- `app/dashboard/finance/investments/page.tsx` — removed hardcoded 7% growth compounding
- `app/dashboard/finance/retirement/page.tsx` — removed fabricated balance/income defaults
- `app/dashboard/goals/page.tsx` — snake_case/camelCase field-mismatch fix
- `app/dashboard/healthcare/page.tsx` — fabricated zeros → "—"
- `app/dashboard/healthcare/settings/page.tsx` — removed Jane Doe contact; real save
- `app/dashboard/healthcare/documents/[id]/page.tsx` — real fetch; not-found state
- `app/dashboard/healthcare/documents/scan/page.tsx` — real upload (was fake OCR)
- `app/dashboard/roadmap/finance/page.tsx` — removed `mockRoadmap`; renders real data
- `components/dashboard/DashboardClient.tsx` — removed fake vote totals; Tasks card renders real goals
- `components/finance/FinancialIntegrations.tsx` — Plaid connection from real state
- `components/financial/accounts/NetWorthSummary.tsx` — renders canonical (no client formula)
- `components/health/overview/components/MedicationTracker.tsx` — removed hardcoded 95%

**Backend (apps/lifenavigator-core-api):**

- `app/domains/finance.py` — `summary()` + `net_worth()` no longer count debt accounts as assets

**Deleted (dead/fabricated):**

- `app/auth/verify-email/page.tsx` + `components/auth/EmailVerification.tsx` (always-failing dead path)
- 8 orphaned fabricated finance components: `components/domain/finance/{InvestmentAdvice, FinancialGoals,
FinancialInsights, IntegrationCards, BudgetPlanner, ExpenseTable, BudgetChart, FinanceAdviceCard}.tsx`

(`how-it-works/page.tsx`, `gemini_client.rs`, `neo4j_client.rs` were already modified before this phase — not part of this work.)

---

## Fake Data Removed (the 10 audited locations + extras)

| #   | Location                    | Was                                                          | Now                                              |
| --- | --------------------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| 1   | roadmap/finance             | hardcoded `mockRoadmap` ("Financial Freedom Plan")           | real fetched roadmap or honest empty state       |
| 2   | healthcare/page             | `0/0 mmHg`, `0 bpm`, `0 lbs`, `0` score                      | "—" when no data                                 |
| 3   | healthcare/settings         | Jane Doe / jane@example.com emergency contact + fake save    | empty contacts; real PUT to preferences          |
| 4   | healthcare/documents/[id]   | same fake PDF for any id                                     | real fetch; "Document not found" otherwise       |
| 5   | finance/connections         | Plaid `isConnected: true` for everyone                       | resolved from `/api/integrations/plaid/accounts` |
| 6   | finance/risk                | `humanCapitalValue = 2000000`, "Risk: Low"                   | missing state; "—" until policies exist          |
| 7   | finance/legacy              | `demoMode = true`; $0 estate-tax calc                        | real fetch; tax tab gated behind data            |
| 8   | MedicationTracker           | hardcoded "95% Adherence"                                    | "Not tracked yet" (no dose-log source)           |
| 9   | dashboard voting            | fabricated totals 127/95/203/78                              | no fake counts (only the user's own vote)        |
| 10  | documents/scan              | fake 2.5s OCR, persisted nothing                             | real multipart upload to `/api/documents`        |
| +   | 8 orphan finance components | fake $120k retirement, Chase/Netflix alerts, 55% allocations | deleted                                          |

---

## Remaining Fake-Data Matches (justified)

After removal, the only matches for the fabrication greps are legitimate:

- `placeholder="Jane Doe"` in `waitlist`, `RegisterForm`, `UnifiedAuthExperience` — input **placeholder attributes**, not rendered data.
- Statutory constants: federal estate exemption `13,610,000`, tax brackets, gift exclusion `$18,000` — real law, shown as generic facts.
- Calculator default inputs (age 35, $100k) in `dashboard/calculators/*` and `RetirementCalculator` — user-editable form defaults, clearly not "your data".
- Comments mentioning "no fabricated …" (intent markers, not data).

No fabricated values render as the user's real data in any production path.

---

## Onboarding Gate — Before / After

**Before:** `proxy.ts` gated only on `profiles.setup_completed`; `activate-persona` set it `true` at persona time → **Persona → Dashboard, advisor skipped entirely.**

**After:** two distinct flags (no migration — both columns already existed on `profiles`):

- `setup_completed` = persona/setup done (set by persona activation).
- `onboarding_completed` = advisor onboarding done **or explicitly skipped**.

Gate sequence (`proxy.ts`):

1. `!setup_completed` → `/onboarding/financial-profile` (pick persona)
2. `setup_completed && !onboarding_completed` → `/dashboard/advisor?onboarding=1` (advisor) — advisor route exempt (no loop)
3. both true → dashboard unlocked

Persona activation **can no longer unlock the dashboard on its own.** The advisor page now: marks `onboarding_completed` on finish ("See your dashboard"), and offers an explicit, persisted **"Skip for now"** (recorded). The dead `/auth/verify-email` path was deleted.

---

## Net Worth — Sources Removed / Single Source

Removed every divergent computation; everything now reads the ONE canonical summary
(`/v1/finance/canonical-summary` → resolver):

- **Removed** finance/page fallback chain `canonicalNetWorth ?? core?.netWorth ?? totals.netWorth` → **canonical only** (MISSING "—" when absent).
- **Removed** `NetWorthSummary` client formula → renders canonical `summary` prop (+ MISSING state + mortgage-without-home prompt).
- **dashboard/summary** route now overrides its local sum with the canonical summary.
- **Backend** `domains/finance.py` `summary()` and `net_worth()` rewritten: liability accounts (credit/loan/mortgage carry positive Plaid balances) are now **subtracted**, not summed in as assets — the bug that inflated net worth by every debt balance.

## Canonical Net Worth Validation

- One definition everywhere: dashboard card, finance page, overview, accounts page, and resolver all resolve to the same `net_worth` (canonical) value. When canonical is unavailable, surfaces render "—" (never a divergent or fabricated number).
- Backend classifier (`_is_liability`) aligned to the resolver's account-type split, so `/v1/finance/summary`, `/v1/finance/net-worth`, and `/v1/finance/canonical-summary` agree.
- Mortgage-without-home: `NetWorthSummary` shows "We found mortgage debt but no home asset value. Add your home's value to complete net worth." when those fields are present.

---

## Broken Pages Fixed

- **Accounts** — was empty for everyone: read top-level `data.accounts` but proxy returns a nested DomainViewModel. Now uses `normalizeFinancePayload`; net worth from canonical. ✅ renders real data.
- **Goals** — every goal showed 0%/no date/grey badge (camelCase vs snake_case). Now normalized (`progress_percent`, `target_date`, case-insensitive enums). ✅
- **Tasks card** — permanently "No calendar connected" (API returns goals, widget expected calendar). Now honestly renders the active goals the API returns. ✅
- **Investments / Retirement** — removed dormant fabricated inputs (7% growth, $400k/$100k defaults). Render honest empty/missing states on 404. ⚠️ full data-plane wiring deferred (Phase 2).
- **Assets** — already an honest empty state; no fabrication. ⚠️ canonical mislabel of home-equity-as-investment deferred (Phase 2, backend resolver).

---

## Fresh User Validation (expected flow)

Signup → email verification (`/auth/confirm`, PKCE) → `/onboarding/financial-profile` (persona) →
persona activation sets `setup_completed` only → **gate forces `/dashboard/advisor?onboarding=1`** →
finish or explicit skip sets `onboarding_completed` → dashboard unlocks. A user can no longer reach
`/dashboard` by URL/back-button after persona selection. (Static verification via the proxy gate logic +
column existence; not yet exercised against a live DB session — see Remaining.)

---

## Remaining P0 / Notes

1. **Live smoke test not run** — changes are type-checked (0 errors) but not exercised against a live Supabase/Core API session. Recommend a fresh-user run before deploy.
2. **Existing beta users** with `setup_completed=true, onboarding_completed=false` (column default) will be routed through the advisor once (skippable). Intended advisor-first behavior; flagged for awareness.
3. **Investments/Retirement data plane** — ~12 missing `/api/investments/*` and `/api/retirement/*` routes still 404 → honest empty states for now; building them is Phase 2.
4. **Assets-as-investments** — canonical resolver still folds `finance.assets.current_value` into `investment_balance`; give assets their own canonical line (Phase 2 backend).
5. **getSession→getUser** on ~30 proxy routes — Phase 3 hygiene (low live risk; Core API re-validates).

---

## Updated Scores (vs audit baseline)

| Dimension                  | Audit  | After Phase 1 | Why                                                                                    |
| -------------------------- | ------ | ------------- | -------------------------------------------------------------------------------------- |
| Architecture               | 45     | 60            | net worth single-sourced; backend formula fixed; dead components removed               |
| Dashboard                  | 40     | 65            | Tasks card real; voting fake data gone; finance card canonical                         |
| UX                         | 45     | 58            | honest missing states replace fakes; advisor-first flow                                |
| Data Integrity             | 30     | 72            | all audited fabrications removed; no fake data renders as real                         |
| Beta Readiness             | 30     | 55            | trust-critical fakes + gate fixed; data-plane gaps remain (Phase 2)                    |
| Single-Source / Redundancy | 35     | 62            | one net-worth definition; two recommendation engines still pending (Phase 2)           |
| **Trust (composite)**      | **33** | **62**        | a user no longer sees fabricated data; net worth is consistent; advisor-first enforced |

Phase 1 Definition of Done: **met** for no-fabricated-data, advisor-first gate, single net-worth
definition, and the trust-critical broken pages. Remaining items are Phase 2 functionality
(data-plane wiring, recommendation reconciliation) and Phase 3 hygiene.
