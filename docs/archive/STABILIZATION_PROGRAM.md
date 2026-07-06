# LIFENAVIGATOR — ARCHITECTURE STABILIZATION PROGRAM

Status as of 2026-06-09. Supersedes the phase plan in PLATFORM_TRUSTWORTHINESS_AUDIT.md.
AI/intelligence feature development is FROZEN until this program completes.

## Freeze (in effect)

No new work on: GraphRAG, recommendation intelligence, Decision Brain, multi-agent,
new deterministic tools, new dashboards, new reports, new AI capabilities — unless required
to fix a platform bug. The intelligence layer is ahead of the platform; the platform is the bottleneck.

## Core principle

- **Frontend owns presentation only** — render, format, sort, filter, paginate, charts, status.
- **Backend owns all truth** — net worth, cash flow, readiness, risk, retirement, debt, goal %,
  insurance gaps, connection/account status, recommendations, projections, onboarding state,
  document extraction, OCR, asset valuation, report values.
- If a value can affect a decision, it comes from the backend. No frontend business math.

## ARCHITECTURAL RULE #1 — a page may not exist unless ALL of these exist

1. Canonical source table(s)
2. Canonical service
3. View model
4. API route
5. Lineage metadata (source / confidence / last-updated)
6. Missing-state behavior
7. Acceptance test

If any are missing, the page is **HIDDEN** — not partially rendered, not placeholder, not
"coming soon". Hidden. (This directly addresses the "UI built before the data plane" inversion:
~12 investments/retirement routes have pages but no backend contract.)

## Canonical chain (frontend never bypasses)

User input (persona / advisor / documents / forms)
→ Supabase (canonical persistence)
→ Canonical services (resolvers / domain services / tools)
→ View models (per page)
→ Frontend rendering (display only)

## Phase order (revised — DO NOT skip 0.5)

### Phase 0.5 — Founder Journey Validation (BEFORE any new code)

Run a real, end-to-end journey for 3 fresh users (A/B/C). No type-checks. Actual usage only.
Matrix per user — each step Pass/Fail with evidence (status code / screenshot / rendered value):

| Step                 | A   | B   | C   |
| -------------------- | --- | --- | --- |
| Signup               |     |     |     |
| Verify Email         |     |     |     |
| Select Persona       |     |     |     |
| Advisor Starts       |     |     |     |
| Advisor Completes    |     |     |     |
| Dashboard Loads      |     |     |     |
| Finance Loads        |     |     |     |
| Accounts Loads       |     |     |     |
| Transactions Load    |     |     |     |
| Investments Load     |     |     |     |
| Retirement Load      |     |     |     |
| Recommendations Load |     |     |     |
| My Life Loads        |     |     |     |

Gate: Phase 1.5+ does not start until this matrix is filled from real runs.

### Phase 1.5 — Widget-by-widget Hydration Audit

For EVERY visible widget: API · backend service · Supabase table · data present? · renders? ·
source label? · Pass/Fail. Finance first, then Family, Career, Health, Education.

### Phase 2 — Domain Hydration Rebuild

Every visible widget hydrates from real data via the canonical chain. Build the missing route
contracts (investments, retirement, assets, then career/health/education). Apply Rule #1:
anything without a complete contract is hidden, not faked.

### Phase 3 — Single ViewModel Architecture

One page → one view model → one source of truth. `/v1/view-model/{dashboard,finance,
finance/accounts,finance/investments,finance/retirement,career,health,family,education,
recommendations,my-life}`. Frontend consumes view models only; remove residual frontend composition.

### Phase 4 — Recommendation Lineage + Dashboard Cohesion

Reconcile the two recommendation engines to one; surface the already-built why/evidence/
assumptions lineage; dashboard = preview + alerts, full experience on its page.

### Phase 5 — Intelligence Reconnection

Only now resume GraphRAG / recommendation / decision / multi-agent improvements, on top of a
trustworthy platform (multiplicative, not compensatory).

## Definition of Done (architectural integrity)

frontend renders only · backend owns all truth · every concept one source · every page one
view model · onboarding enforced · no fake data · no duplicate calculations · no contradictory
values · every metric has lineage · every widget hydrates from canonical services · dashboard and
domains hydrate consistently.

## Status

- Phase 1 (trust repair) complete & type-checked — see PHASE_1_TRUST_REPAIR_REPORT.md.
- Phase 0.5 BLOCKED on execution environment: no live Supabase/Core-API/Plaid/Gemini credentials
  in the working shell; the app needs them for every authed step. Harness exists (Playwright e2e/
  - beta20 probe scripts) but the onboarding spec tests the OLD flow and must be rewritten for the
    persona→advisor gate. Awaiting an execution path (creds + base URL) to run A/B/C for real.
