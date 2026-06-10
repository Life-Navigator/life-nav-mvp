# CAREER CONVERSION → Domain Framework — 2026-06-10

Career is fully converted to the shared Domain Framework and live-validated on prod (`77e053a`). No
custom Career layout remains. No fake career data. No backend/AI/finance changes.

## Files Changed

- `app/dashboard/career/layout.tsx` — now `<DomainLayout config={careerDomain}>` (replaced the bespoke `CareerSidebar`/layout).
- `app/dashboard/career/page.tsx` (Overview) — rewritten to render the shared `DomainOverview`, mapping `/api/career/summary` → `CoverageModel`.
- `components/domain/career/CareerTabEmpty.tsx` (new) — shared honest empty-states for Career tabs.
- 9 new tab routes: `career/{experience,certifications,compensation,documents,analysis,recommendations,goals,reports,settings}/page.tsx` (thin wrappers over `CareerTabEmpty`).
- `components/domain/configs/career.ts` — the 13-tab Career config (built in the framework sprint).

## Framework Components Used

`DomainLayout`, `DomainSidebar`, `DomainHeader` (via layout), `DomainOverview`, `CoverageCard`,
`ConfidenceCard`, `MissingDataCard`, `NextActionCard`, `SourceAttributionCard`, `DomainEmptyState`,
`DomainLoadingState`, `DomainErrorState`. **Zero one-off Career cards** (only two small labelled
"Related recommendations / Related documents" blocks as Overview children, per the 11-point standard).

## Career Routes Converted (13-tab contract — all render, none 404, none broken)

Overview (real data) · Skills/Opportunities/Networking (existing) · Experience/Certifications/
Compensation/Documents/Analysis/Recommendations/Goals/Reports/Settings (honest `DomainEmptyState`).

## Career Summary Mapping (`/api/career/summary` → `CoverageModel`)

- `known[]` ← `current_state.title/employer`, `years_experience`, `target_state.role`, `market_position.demand_level` (when not "unknown"), `skill_gaps.length`.
- `missing[]` ← `vm.missing` (friendly-labelled) || `data.missing_data_prompts`.
- `confidence_pct` ← `confidence.score` (handles 0–1 or 0–100). `coverage_pct` ← known / (known + missing).
- `unlocks[]` ← compensation benchmark / role transition plan / skill-gap analysis / opportunity matching / career roadmap.
- `next_action` ← `/dashboard/career/add`. `source` ← "Career profile + cited market data" + as-of + confidence band.
- **No fabrication:** when the summary has no data, `coverage_pct=0`/`known=[]` → the Overview renders `DomainEmptyState`.

## Missing States Implemented

Every unbuilt tab + the empty Overview use the standard pattern: **"We currently know / To improve
accuracy we still need / This would unlock / Recommended next step."** Examples: Documents → Resume,
Offer letter, Contract, Performance reviews → unlocks auto-filled experience/comp verification/skill
extraction → **Upload documents** CTA. Reports → unlocks Career Snapshot / Skill Gap / Compensation /
Readiness reports. Never "No data" / "Coming soon".

## Browser Validation (prod `77e053a`, fully-onboarded user)

| Page                                | Status                 | Result                                                                                                      |
| ----------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `/dashboard/career` (Overview)      | 200, **0 page errors** | shared sidebar (Career + 13 tabs), "Career Snapshot" via `DomainOverview`, missing-state language, no crash |
| `/dashboard/career/documents`       | 200                    | honest empty: Resume mentioned + **Upload documents** CTA + sidebar                                         |
| `/dashboard/career/recommendations` | 200                    | honest empty (still need / unlocks)                                                                         |
| `/dashboard/career/reports`         | 200                    | honest empty (Snapshot / Skill Gap / …)                                                                     |

Screenshots: `reports/browser-validation/latest/career/{1-overview,2-documents,3-recommendations,4-reports}.png`.
Note: Source/Confidence cards render in the **has-data** path of `DomainOverview`; for a no-career-data user
the Overview correctly shows the empty state (which omits them) — honest, not a defect.

## Bug found + fixed during validation

`/dashboard/career/documents` first returned **404** — the repo `.gitignore:83 documents/` glob silently
dropped the file from the commit (the known Document-Intelligence gotcha). Fixed with `git add -f`.
**This applies to Health/Education/Family too — their `documents/` tab files must be force-added.**

## Remaining Career Gaps

- The 9 framework tabs are honest empty-states, not yet wired to real per-tab data (Experience/Certifications/
  Compensation have endpoints to wire next; Skills/Opportunities/Networking are still their original pages —
  not yet refactored onto the framework primitives, but functional).
- Source/Confidence cards only exercised on the empty path here (a data-rich persona would show them).
- Dashboard `DomainCoverage` card still predates the framework (migrate to `CoverageCard`/`MissingDataCard`).

## Copy-Paste Instructions for Health / Education / Family

1. Add `components/domain/configs/<domain>.ts` exporting a `DomainConfig` (label, basePath, 13-tab `nav`, Beta flags) — copy `career.ts`.
2. Replace `app/dashboard/<domain>/layout.tsx` with `<DomainLayout config={<domain>Domain}>{children}</DomainLayout>`.
3. Rewrite the Overview `page.tsx`: fetch the domain summary, write a `toCoverageModel(vm)` mapper (known/missing/confidence/source/next-action from REAL fields, empty → `coverage_pct:0`), render `<DomainOverview config model>` with Related Recommendations/Documents children.
4. Add `components/domain/<domain>/<Domain>TabEmpty.tsx` (copy `CareerTabEmpty`, domain-specific copy) + thin `page.tsx` for every unbuilt contract tab.
5. **`git add -f` the `<domain>/documents/page.tsx`** (gitignore glob).
6. tsc → commit → deploy → browser-validate Overview + Documents + Recommendations + Reports.

## Definition of Done — status

✅ Career fully converted to the shared framework. ✅ Structurally identical to Finance (sidebar + tabs).
✅ Tabs standardized; honest missing states. ✅ No custom Career layout. ✅ No fake career data. ✅ Live
browser-validated. Career is now the proven template for Health → Education → Family.
