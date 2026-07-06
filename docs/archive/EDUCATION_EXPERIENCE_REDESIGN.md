# Education Experience Redesign — From Records List to Decision Center

> **Grounded finding.** Education's information architecture today is built around _recording credentials you already have_ — `dashboard/education/page.tsx` counts records/certs/courses, `degrees/page.tsx` is a CRUD list of earned degrees, and the two decision-oriented tabs (`roi-analysis/page.tsx`, `career-alignment/page.tsx`) are inert `EducationTabEmpty` stubs (`apps/web/src/components/domain/education/EducationTabEmpty.tsx`). Meanwhile the backend is built around _making a forward-looking education decision_: `EducationService` (`apps/lifenavigator-core-api/app/domains/education.py`) + `EducationROIEngine` (`education_roi.py`) + `EducationReportBuilder` (`education_report.py`) rank candidate programs with cited ROI, scenarios, and five recommendation families, exposed over six `/v1/education/*` endpoints (`routers/education_domain.py`) and a working branded PDF (`pdf_renderer.py:render_education_pdf`, "the first production report"). The frontend and backend are pointed in **opposite directions**. The web app cannot even _create_ the `education.programs`/`education.schools` rows the engine consumes (migration `127_education_schema.sql`), so the decision engine is structurally unreachable. This redesign re-points the experience at the decision the backend was built to support — surfacing-first, no new infrastructure.

---

## 1. IA: before → after

### Before (records-centric, decision tabs dark)

```
/dashboard/education
├── Overview        → readiness + counts + snapshot (works)
├── degrees         → earned degrees/certs/licenses CRUD (works)
├── courses         → course CRUD (works)
├── goals           → future goals CRUD (works)
├── skills          → SkillGapAnalysis (partial)
├── roi-analysis    → EducationTabEmpty   ❌ engine exists, unrendered
├── career-alignment→ EducationTabEmpty   ❌ engine exists, unrendered
├── recommendations → list (partially wired)
├── reports         → DomainReports → /api/reports/education/pdf (works, PDF only)
├── documents       → doc intelligence handoff
└── add / settings
```

### After (decision-centric, records as inputs)

```
/dashboard/education
├── Overview            → readiness + snapshot + "Compare programs & ROI" CTA (new prominent CTA)
├── Decision Center     → NEW primary surface: reads /v1/education/comparison + /report
│     ├── Recommended Path (hero: best_program + verdict + radar)
│     ├── Program comparison grid (net_cost/income_lift/breakeven/scores/composite)
│     ├── Scenario bands (worst/expected/best)
│     ├── Funding & debt impact (report §6)
│     ├── Career impact (report §5 + career_alignment_gap rec)
│     └── Recommendations rail + Evidence/Assumptions drawer
├── Programs            → NEW CRUD for candidate programs (the missing input surface)
├── My Education        → degrees/courses/goals (renamed records hub — inputs, not the point)
├── Recommendations     → recommendations[] (already produced by engine)
├── Reports             → interactive Decision Center + downloadable PDF (same data, same content_hash)
└── Documents           → transcript/aid-letter ingestion → ROI inputs
```

The reframe: **records are _inputs_ to a decision**, not the destination. The destination is "which program, and is it worth it?" — which the backend already answers.

---

## 2. Surfacing changes (concrete, code-level)

| Change                     | File                                                             | Action                                                                                                                                                                                          | Infra?                                        |
| -------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Wire ROI tab to engine     | `apps/web/src/app/dashboard/education/roi-analysis/page.tsx`     | Replace `EducationTabEmpty` with a fetch of `/v1/education/comparison` + render grid/hero/scenarios                                                                                             | None                                          |
| Wire career tab            | `apps/web/src/app/dashboard/education/career-alignment/page.tsx` | Render `career_context` + `career_alignment_gap` rec from `/summary`                                                                                                                            | None                                          |
| Add programs input surface | NEW `apps/web/src/app/dashboard/education/programs/page.tsx`     | `EntityCrudSection apiBase="/api/education" slug="programs"` (mirror `degrees/page.tsx`); fields = `name, school_id, tuition, duration_months, median_salary, graduation_rate, major, modality` | None (table + `EducationService.write` exist) |
| Thin web proxy             | NEW `apps/web/src/app/api/education/comparison/route.ts`         | Forward auth'd request to core `/v1/education/comparison` (mirror `api/reports/[type]/pdf/route.ts`)                                                                                            | None                                          |
| Overview CTA               | `apps/web/src/app/dashboard/education/page.tsx`                  | Add prominent "Compare programs & ROI" link into the Decision Center                                                                                                                            | None                                          |
| Decision-framed empties    | `EducationTabEmpty.tsx` ROI/career entries                       | Re-copy from passive "we need X" to "add a program, get a cited ROI verdict"; CTA → `/dashboard/education/programs`                                                                             | None                                          |

Everything reuses the shared `DomainOverview`/`DomainEmptyState`/`EntityCrudSection`/`DomainReports` framework already in `apps/web/src/components/domain/framework`.

---

## 3. Coverage table — every section to a real data source

| Decision Center section      | Data source (real)                                                                                  | Today                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Education Readiness          | `apps/web/src/lib/readiness/education.ts` via `/api/education/readiness`                            | Surfaced                            |
| Programs Under Consideration | `education.programs` (mig 127) via `_scored_programs`                                               | **No input UI** — add Programs page |
| ROI (cost/lift/breakeven)    | `ProgramScore.net_cost/opportunity_cost/income_lift/breakeven_months`                               | Dark                                |
| Time cost                    | `_time_score` + `duration_months`/`opportunity_cost`                                                | Dark                                |
| Career impact                | `_career_score`, `career_context`, `career_alignment_gap` rec                                       | Dark                                |
| Funding options / debt       | `high_debt_warning` rec + report §6 `est_monthly_payment_120mo`; `finance.debts` join in `_context` | Dark                                |
| Scenario comparison          | `scenarios.{worst,expected,best}` + `roi_scenario_range` chart                                      | Dark                                |
| Recommended path             | `best_program` + report §2 + `best_program_match` rec                                               | Dark                                |
| Evidence & assumptions       | report `9_evidence_appendix` (`citations`, `assumptions`, per-metric `evidence`)                    | Dark                                |
| PDF report                   | `render_education_pdf` via `/api/reports/education/pdf`                                             | Surfaced (download only)            |

---

## 4. Visual & decision design

- **Decision-first hierarchy:** the Recommended Path hero (verdict sentence + composite ring + 6-axis `score_radar`) is the top of the page, above the grid. The first thing a user sees is _the answer_, then the supporting comparison.
- **Cited-by-default:** every dollar and score is a click-target opening its `evidence` row (`source_table` + `explanation`). The assumptions drawer is always one tap away. This is the moat made visible — show it, don't bury it.
- **Honest confidence:** confidence rings read `scores.confidence` (present-inputs/4 × 100); cells with `None` values render "—" plus the specific `missing[]` field and an "add it" CTA. No fabricated placeholders, ever (per the no-mock-data rule).
- **Scenario as a band, not a point:** worst──expected●──best range bar communicates uncertainty honestly — the engine already risk-adjusts by completion probability.
- **One dataset, two renders:** the interactive Decision Center and the downloadable PDF read the same `EducationReportBuilder` output, so they cannot disagree (`content_hash` reproducibility).

---

## 5. Honest states (engine-driven)

- **Empty** — `comparison.count == 0`: _"Add a program you're considering and we'll compare cost, breakeven, income lift, and career fit — every figure cited."_ CTA → `/dashboard/education/programs`. (Replaces today's passive `EducationTabEmpty`.)
- **In-Progress** — programs exist, `missing_data_prompts`/per-row `missing` non-empty: full grid with computed cells, "—" + missing-input badges on the rest, banner nudging the highest-leverage missing input (usually `career_profiles` → unblocks income lift + breakeven).
- **Complete** — programs scored + `current_median` present: hero + grid + scenarios + recommendations + evidence drawer + PDF.

No state is a dead end: every empty/partial surface routes to the exact input that unlocks the next computation, named from the engine's own `missing[]`.

---

## 6. Definition of done

1. Education's primary surface is a **Decision Center** reading live `/v1/education/comparison` + `/report`, not a records list.
2. Users can **add candidate programs** (the missing input) and immediately see them scored, ranked, and cited.
3. `roi-analysis` and `career-alignment` render real engine output; `EducationTabEmpty` is removed from those routes.
4. Every figure shows provenance (`source_table` + `explanation`); assumptions are visible; missing inputs are honest and actionable.
5. Interactive view and PDF share one backend dataset (same `content_hash`).
6. **Zero new tables, endpoints, models, or AI calls.** Net new code is UI + one thin proxy + one CRUD page over an engine that already exists.

The redesign does not build intelligence — it points the experience at the intelligence already built.
