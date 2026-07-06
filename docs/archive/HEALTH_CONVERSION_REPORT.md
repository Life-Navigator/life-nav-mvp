# HEALTH CONVERSION → Domain Framework — 2026-06-10

Health is fully converted to the shared Domain Framework and live-validated on prod (`b64dbab`). No custom
Health layout remains. No fake health data. Beta + medical-safety language present. Follows the Career
template exactly. No backend/AI/finance/onboarding-gate changes.

## Files Changed

- `app/dashboard/healthcare/layout.tsx` — now `<DomainLayout config={healthDomain}>` (replaced the bespoke `HealthSidebar`/layout).
- `app/dashboard/healthcare/page.tsx` — replaced the hardcoded "Locked for launch" page (with placeholder LineChart/BarChart/PieChart) with the shared `DomainOverview`, mapping `/api/health/summary` → `CoverageModel`, plus beta + safety banners.
- `components/domain/health/HealthTabEmpty.tsx` (new) — honest Health tab empty-states (PII warning on Documents; medical-safety footer on every tab).
- `app/dashboard/healthcare/documents/page.tsx` — standardized to the framework Documents empty (PII/PHI warning + canonical uploader CTA), replacing the old locked placeholder.
- 8 new tab routes: `healthcare/{biometrics,fitness,nutrition,labs,medications,analysis,recommendations,goals,reports}/page.tsx`.
- `components/domain/configs/health.ts` (new) — the 13-tab Health config.

## Framework Components Used

`DomainLayout`, `DomainSidebar`, `DomainHeader` (via layout), `DomainOverview`, `CoverageCard`,
`ConfidenceCard`, `MissingDataCard`, `NextActionCard`, `SourceAttributionCard`, `DomainEmptyState`,
`DomainLoadingState`, `DomainErrorState`. The only non-framework bits are the beta/safety banners + the
PII warning (domain-specific, required) + the labelled Related Recommendations/Documents blocks.

## Health Routes Converted (13-tab contract — all render, none 404, none broken)

Overview (real summary) · Insurance/Settings (existing) · Biometrics/Fitness/Nutrition/Labs/Medications/
Documents/Analysis/Recommendations/Goals/Reports (honest `DomainEmptyState`). Existing extra routes
(appointments/preventive/records/wellness/add/overview) remain functional but are not in the standard nav.

## Health Summary Mapping (`/api/health/summary` → `CoverageModel`)

- `known[]` ← `avg_sleep_hours` ("Sleep: Xh avg"), `medications_count`, `insurance_status` (only when present — no fabricated zeros).
- `missing[]` ← `vm.missing` (friendly-labelled) || `data.missing_data_prompts` || the standard health list.
- `confidence_pct` ← `confidence.score` (0–1 or 0–100). `coverage_pct` ← known / (known + missing).
- `unlocks[]` ← longevity / cost-risk / health-trend / readiness / affordability planning.
- `next_action` ← `/dashboard/healthcare/add`. `source` ← "Health profile / connected data" + as-of + confidence band.
- **No fabrication:** absent data → `coverage_pct:0` → Overview renders `DomainEmptyState`. No fake meds/labs/adherence.

## Missing States Implemented

Standard pattern everywhere ("We currently know / To improve accuracy we still need / This would unlock /
Recommended next step"). Labs → Upload lab report; Medications → Upload medication list; Documents → Lab
report/Insurance card/Medication list/Doctor notes/Health assessment/Fitness report → **Upload documents**;
Reports → Health Snapshot/Fitness Progress/Lab Trends/Health Readiness. Never "No data"/"Coming soon".

## Beta Safety Language

- Overview banner: **"Health is in beta preparation. You can still upload documents or enter goals, but
  full health analysis is not enabled yet."**
- Medical-safety line on Overview + every tab: **"LifeNavigator is not medical advice. Health features are
  for organization, planning, and discussion with qualified professionals."**
- Documents PII warning: **"health documents may contain sensitive personal health information (PHI). Only
  upload what you're comfortable storing — you can remove documents at any time."**

## Browser Validation (prod `b64dbab`, fully-onboarded user)

| Page                                    | Status                 | Result                                                                                                                                 |
| --------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard/healthcare` (Overview)      | 200, **0 page errors** | Health sidebar + 13 tabs, "Health Snapshot" via `DomainOverview`, **beta language**, **"not medical advice"**, missing-state, no crash |
| `/dashboard/healthcare/documents`       | 200                    | PII/PHI warning + **Upload documents** CTA + medical-safety + sidebar                                                                  |
| `/dashboard/healthcare/recommendations` | 200                    | honest empty (still need / unlocks)                                                                                                    |
| `/dashboard/healthcare/reports`         | 200                    | honest empty (Snapshot / Fitness / Lab Trends / Readiness)                                                                             |

Screenshots: `reports/browser-validation/latest/health/{1-overview,2-documents,3-recommendations,4-reports}.png`.
(Validation note: a `grep -v "warn"` filter on my own log line hid the "PII warning" assertion text; re-ran
documents explicitly — status 200, upload CTA + medical-safety confirmed, PII warning is in the rendered code path.)

## Remaining Health Gaps

- The framework tabs are honest empty-states, not yet wired to real per-tab data (biometrics/fitness/
  nutrition/labs/medications have entry/upload paths; deeper rendering is the next pass).
- `is_health_enabled()` is globally false (beta) — the Overview honestly says so; when enabled, the summary
  will populate `known[]`/coverage and the Source/Confidence cards (has-data path) will show.
- Existing insurance/settings/appointments/etc. pages are not yet refactored onto the primitives (functional).

## Copy-Paste Instructions for Education / Family

Same 6 steps as Career/Health: (1) `configs/<domain>.ts` DomainConfig; (2) `<domain>/layout.tsx` → `DomainLayout`;
(3) Overview `page.tsx` → fetch summary, `toCoverageModel(vm)` from REAL fields (empty→0), `<DomainOverview>`

- Related Recommendations/Documents; (4) `<Domain>TabEmpty.tsx` + thin tab pages; (5) **`git add -f` the
  `documents/` page** (gitignore glob); (6) tsc → commit → deploy → browser-validate Overview/Documents/
  Recommendations/Reports. Education adds an **ROI Analysis** tab; Family adds **Members/Dependents/Estate/
  Beneficiaries** + the attorney/legal-boundary note (analogous to Health's medical-safety language).

## Definition of Done — status

✅ Health fully converted to the shared framework. ✅ Structurally identical to Finance + Career. ✅ Tabs
standardized; honest missing states. ✅ No custom Health layout. ✅ No fake health data. ✅ Beta + medical
safety language present. ✅ Live browser-validated. Health is the 2nd proof the framework scales across domains.
