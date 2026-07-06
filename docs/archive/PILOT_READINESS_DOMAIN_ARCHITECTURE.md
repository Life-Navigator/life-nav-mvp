# DOMAIN ARCHITECTURE STANDARDIZATION & PILOT READINESS — AUDIT + PLAN — 2026-06-10

Scope: UI/UX/navigation/architecture audit + standardization plan (Finance as the template). No
GraphRAG/recommendation/advisor/scenario/decision/life-model logic changes. This turn delivers the
audit matrices + prioritized plan (deliverables 1–4, 6–10); the 4-domain UI _conversion_ is the
build that executes against this plan (it's a multi-pass effort — scoped, not faked).

## 1. DOMAIN ARCHITECTURE MATRIX (vs the Domain Contract)

Contract: Overview · Data · Documents · Analysis · Recommendations · Goals · Reports · Settings.
| Domain | Present | Missing | %→Finance |
|---|---|---|---|
| **Finance** (template) | Overview, Data (accounts/txns/assets/investments/retirement), Documents, Analysis, Recommendations, Goals, Reports, Settings + dedicated sidebar | — | **100%** |
| **Career** | Overview, Data, Documents (resume upload), Recommendations, Settings | Analysis, Goals, Reports | **62%** |
| **Healthcare** | Overview, Data, Documents, Settings | Analysis, Recommendations, Goals, Reports | **50%** |
| **Education** | Overview, Data, Settings | Documents, Analysis, Recommendations, Goals, Reports | **37%** |
| **Family** | Overview, Data, Recommendations (single monolithic page, no sidebar) | Documents, Analysis, Goals, Reports, Settings + nav parity | **37%** |

## 2. NAVIGATION AUDIT

- Finance has a dedicated sidebar (the pattern). **Career/Health/Education share/partial nav; Family has NO sidebar** (single page) — the biggest nav-parity gap.
- Recommended: a shared `<DomainLayout>` (sidebar + tab contract) applied to all 5 domains, modeled on `finance/layout.tsx`.

## 3. ROUTE INVENTORY (63 routes)

- **ACTIVE (real data): 44** · **FUNCTIONAL-EMPTY: 13** · **STATIC-STUB: 4** · **LEGACY: 1** · **BROKEN: 1** · **DUPLICATE: 0**.
- **BROKEN (P0):** `/dashboard/scenario-lab/[id]` — dynamic detail page file missing.
- **STATIC-STUB ("Coming Soon"):** `/dashboard/calculators` (hub), `/dashboard/download`, `/dashboard/roadmap`, `/dashboard/education/progress`.
- **FUNCTIONAL-EMPTY (render, no data / pending API):** career/skills, education/{overview,courses,path}, healthcare, integrations, reports, settings, onboarding/hub, +.
- **LEGACY:** `/dashboard/career/overview` (redirect) — plus the onboarding legacy pages already redirected by middleware (prior sprint).

## 4. DOMAIN CONVERSION STATUS

Finance 100% · Career 62% · Healthcare 50% · Education 37% · Family 37%. To reach the contract each
domain needs (per §1 "Missing") + a dedicated `DomainLayout`. Order by effort/value: **Family** (add
sidebar/tabs) → **Education** (documents+analysis+reports) → **Healthcare** (analysis+recs) → **Career**
(analysis+goals+reports). Each domain already has a summary endpoint (`/api/career|family/summary`,
`/api/health/summary`, `/api/education/*`) — the gap is the standardized PAGE shell, not the data.

## 5. DASHBOARD IMPROVEMENTS

Already shipped in prior sprints: domain cards use Discovery Coverage (coverage%/missing/unlocks/CTA),
Alerts before Tasks, **Quick Actions moved to the bottom**, top recommendation block removed, finance card
canonical. **Remaining for the executive layout:** add a **Recent Documents** widget + a **Recommended
Actions** strip (the recommendation preview exists in Alerts; promote a compact top-3). Target order:
Life Snapshot → Domain Cards → Alerts → Active Goals → Recommended Actions → Recent Documents → Quick Actions.

## 6. DOCUMENT INTEGRATION STATUS

- Global `/dashboard/documents` is ACTIVE (upload/extract + per-category readiness + `affects_domains`).
- The **advisor onboarding upload loop** routes to it with `domain/doc_type/return_to` (prior sprint).
- **Per-domain Documents tab** exists for finance/career(resume)/health; **missing for education + family.**
- Standard to apply: every domain Documents tab = Upload + Manual Entry + View + Processing Status + Source — reuse `/api/documents` + `AddDataModal`.

## 7. RECOMMENDATION AUDIT

- Global `/dashboard/recommendations` is ACTIVE (Now/Next/Later + priority + lifecycle).
- **Per-domain Recommendations sections are inconsistent** — finance/career/family surface them; health/education don't. Each rec should show why/confidence/source/supporting-facts/related-goal (the data exists in the recommendations model; the per-domain SURFACE is missing).

## 8. REPORT AUDIT

- Global `/dashboard/reports` is **FUNCTIONAL-EMPTY** (hub, downloads not implemented). The backend report
  generator supports `financial|compensation|family|decision|education|full`.
- **Per-domain Reports tabs are missing** across all non-finance domains. Standard: Overview / Goal-Progress
  / Coverage / Risk / Advisor report per domain, with **honest missing-states** (no fabricated charts).

## 9. BROWSER VALIDATION

Verified live on prod in prior sprints (with traces/screenshots): Dashboard (loads, canonical finance card,
no top brief), Advisor (full-screen, multi-goal reflection, Plaid ack — v69), Finance + overview/accounts/
investments/retirement (canonical, 1× fetch), Documents (upload loop), Recommendations (active), onboarding
gate (7/7 redirect traces). **Not yet run as one 10-page pass for this sprint:** Career/Health/Education/Family
domain pages — recommended as the validation step once the `DomainLayout` conversion lands (they currently
render but at 37–62% of the contract). Route classifications in §3 are the page-by-page status proxy.

## 10. REMAINING DEFECTS (P0/P1/P2)

**P0 (broken / pilot-blocking):**

1. `/dashboard/scenario-lab/[id]` BROKEN (missing dynamic page file).
2. Family domain has no sidebar/nav parity (single monolithic page) — discoverability gap.
   **P1 (contract gaps / honest-state):**
3. Education/Family missing Documents tab; Health/Education missing per-domain Recommendations.
4. Per-domain Reports tabs missing everywhere except finance; `/dashboard/reports` hub not implemented.
5. FUNCTIONAL-EMPTY pages (career/skills, education/{courses,path,overview,progress}, healthcare, integrations, settings) need honest missing-states + "Beta" chips, not silent empties.
6. No shared `DomainLayout` → visual + nav drift between domains (UI consistency).
   **P2 (polish):**
7. STATIC-STUB pages (download, roadmap) — mark Beta/Coming-Soon explicitly or hide from nav.
8. Dashboard: add Recent Documents + Recommended Actions widgets.
9. Domain Summary Card contract (coverage%/confidence/top-goal/top-risk/top-missing/next-action/updated/source) — dashboard cards have coverage%/missing/CTA; add confidence + source + last-updated uniformly.

## STANDARDIZATION PLAN (Finance → all domains)

1. Build a shared `components/domain/DomainLayout.tsx` (sidebar + tab contract: Overview/Data/Documents/
   Analysis/Recommendations/Goals/Reports/Settings) modeled on `finance/layout.tsx` + the `DomainCoverage`
   card. 2. Apply it to Family (highest gap) → Education → Health → Career, wiring each existing summary
   endpoint into Overview + honest missing-states for unbuilt tabs (Beta chips). 3. Add per-domain Documents
   (reuse `/api/documents` + `AddDataModal`) + Recommendations surface + Reports tab (honest missing). 4. Fix
   the BROKEN scenario-lab/[id]. 5. Dashboard: add Recent Documents + Recommended Actions; standardize the
   Domain Summary Card to the full contract. 6. Browser-validate the 10 pages.

## Definition of Done — status

This turn: the audit + matrices + prioritized defects + standardization plan are delivered (deliverables
1–4, 6–10 as audit artifacts; #5 partially shipped in prior dashboard sprints). The actual multi-domain
UI conversion to the contract is the execution that follows — bounded by §1's per-domain "Missing" lists
and the plan above. Honest status: the platform is coherent in Finance + the onboarding/advisor spine; the
4 other domains are 37–62% of the template and need the `DomainLayout` conversion pass to be pilot-uniform.
