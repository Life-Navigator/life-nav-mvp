# EDUCATION CONVERSION → Domain Framework — 2026-06-10

Education is fully converted to the shared Domain Framework and live-validated on prod (`e013322`). No
custom Education layout remains. No fake education data, no fake ROI, no hardcoded study streak. Follows
the Career + Health template. No backend/AI/finance/onboarding-gate changes.

## Files Changed

- `app/dashboard/education/layout.tsx` — now `<DomainLayout config={educationDomain}>` (replaced the bespoke `EducationSidebar`/layout).
- `app/dashboard/education/page.tsx` — replaced the static "Education Features Coming Soon" hub with the shared `DomainOverview`. **No `/api/education/summary` exists**, so it aggregates the user's REAL records/certifications/courses counts → `CoverageModel`.
- `components/domain/education/EducationTabEmpty.tsx` (new) — honest Education tab empty-states (incl. the ROI Analysis copy).
- 9 new tab routes: `education/{degrees,skills,career-alignment,roi-analysis,documents,recommendations,goals,reports,settings}/page.tsx`.
- `components/domain/configs/education.ts` (new) — the 12-tab Education config.

## Framework Components Used

`DomainLayout`, `DomainSidebar`, `DomainHeader` (via layout), `DomainOverview`, `CoverageCard`,
`ConfidenceCard`, `MissingDataCard`, `NextActionCard`, `SourceAttributionCard`, `DomainEmptyState`,
`DomainLoadingState`, `DomainErrorState`. No one-off Education cards (only labelled Related Recommendations/
Documents blocks + the ROI intro line).

## Education Routes Converted (12-tab contract — all render, none 404, none broken)

Overview (aggregated real data) · Certifications/Courses (existing) · Degrees/Skills/Career Alignment/
ROI Analysis/Documents/Recommendations/Goals/Reports/Settings (honest `DomainEmptyState`). Existing extra
routes (overview/path/progress/add) remain functional but aren't in the standard nav.

## Education Summary Mapping (aggregated — no summary endpoint)

There is no `/api/education/summary`, so the Overview aggregates three real endpoints in parallel:
`/api/education/records`, `/api/education/certifications`, `/api/education/courses`.

- `known[]` ← non-zero counts ("N education record(s)", "N certification(s)", "N course(s)") — **only when present**.
- `missing[]` ← current education / target degree-or-cert / program preference / cost tolerance / timeline / transcript or credential docs / career reason.
- `coverage_pct` ← known / (known + missing). `confidence_pct` ← scaled by how many record types exist (capped low).
- `unlocks[]` ← ROI comparison / school-fit / financing / career-aligned plan / credential gap analysis.
- `next_action` ← `/dashboard/education/add`. `source` ← "Your education records".
- **No fabrication:** zero records → `coverage_pct:0`, `known:[]` → `DomainEmptyState`. No fake degrees/courses/streaks/ROI.

## Missing States Implemented

Standard "We currently know / still need / unlocks / next step" everywhere. Documents → Transcript/
Certifications/Degree plan/Tuition bill/Acceptance letter/Financial-aid letter/Training certs → **Upload
documents**. Reports → Education Snapshot/ROI Report/Credential Gap/Career Alignment/Financing. Never
"No data"/"Coming soon".

## ROI Analysis State

The ROI Analysis tab **exists** and renders the honest missing-state required:
**"We need your target program, estimated cost, timeline, and career goal before we can calculate education
ROI."** → unlocks: Payback period / Income lift estimate / Debt impact / Career alignment / Family-finance
tradeoff → CTA "Enter program details". **No fake ROI charts, no placeholder numbers** (validation confirmed
no `$`-figures rendered).

## Browser Validation (prod `e013322`, fully-onboarded user)

| Page                                   | Status                 | Result                                                                                                                                       |
| -------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard/education` (Overview)      | 200, **0 page errors** | Education sidebar + 12 tabs incl. ROI Analysis, "Education Snapshot" via `DomainOverview`, missing-state, **no fake study streak**, no crash |
| `/dashboard/education/roi-analysis`    | 200, 0 errors          | honest "…before we can calculate education ROI" + Payback-period unlock, **no fake $ chart**                                                 |
| `/dashboard/education/documents`       | 200, 0 errors          | Transcript + **Upload documents** CTA                                                                                                        |
| `/dashboard/education/recommendations` | 200                    | honest empty                                                                                                                                 |
| `/dashboard/education/reports`         | 200                    | honest empty (Snapshot / ROI / Credential Gap / …)                                                                                           |

Screenshots: `reports/browser-validation/latest/education/{1-overview,2-roi-analysis,3-documents,4-recommendations,5-reports}.png`.

## Remaining Education Gaps

- Tabs are honest empty-states, not yet wired to real per-tab data (Certifications/Courses keep their original pages — functional).
- No canonical `/api/education/summary`; the Overview aggregates counts. A real summary endpoint would enrich `known[]` + Source/Confidence (has-data path).
- ROI Analysis is a missing-state shell until a target program + cost + timeline + career goal are captured (by design — no fake ROI).

## Copy-Paste Instructions for Family (the last domain)

Same 6 steps: (1) `configs/family.ts` DomainConfig (tabs: Overview/Members/Dependents/Insurance/Estate/
Beneficiaries/Documents/Recommendations/Goals/Reports/Settings); (2) `family/layout.tsx` → `DomainLayout`
(Family currently has **no layout/sidebar** — this adds nav parity, its biggest gap); (3) Overview `page.tsx`
→ fetch `/api/family/summary`, `toCoverageModel(vm)` from REAL fields (empty→0), `<DomainOverview>` + Related
blocks; (4) `FamilyTabEmpty.tsx` + thin tab pages; (5) **`git add -f` the `documents/` page**; (6) tsc →
commit → deploy → browser-validate. Family needs an **attorney/legal-boundary note** on Estate/Beneficiaries
(analogous to Health's medical-safety language) — "not legal advice; consult a qualified attorney."

## Definition of Done — status

✅ Education fully converted. ✅ Structurally identical to Finance/Career/Health. ✅ Tabs standardized.
✅ ROI Analysis exists with honest missing-state. ✅ Intelligent missing states. ✅ No custom Education
layout. ✅ No fake education data. ✅ No hardcoded study streak. ✅ Live browser-validated. Education is the
3rd proof the framework scales — only Family remains.
