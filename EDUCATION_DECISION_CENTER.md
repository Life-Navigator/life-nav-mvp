# Education Decision Center — Surfacing the Hidden ROI Engine

> **Grounded finding.** LifeNavigator already ships a complete, advisor-grade Education _decision engine_ in the FastAPI core API — and almost none of it reaches the user. `EducationROIEngine.score_program` (`apps/lifenavigator-core-api/app/services/education_roi.py`) computes seven cited 0–100 scores (fit/roi/career/family/risk/time/confidence), net cost, opportunity cost, income lift, breakeven months, and worst/expected/best income-lift scenarios — _every figure carries an evidence row with a `source_table` and an `explanation`_ (no uncited ROI). `EducationService` (`apps/lifenavigator-core-api/app/domains/education.py`) ranks candidate programs by a confidence-weighted composite, emits five evidence-backed recommendation families (`best_program_match`, `high_debt_warning`, `lower_cost_alternative`, `better_roi_path`, `career_alignment_gap`), and builds a 9-section report via `EducationReportBuilder` (`apps/lifenavigator-core-api/app/services/education_report.py`). Six endpoints expose all of it (`apps/lifenavigator-core-api/app/routers/education_domain.py`). The **web app reads none of them.** `apps/web/src/app/dashboard/education/roi-analysis/page.tsx` and `career-alignment/page.tsx` render `EducationTabEmpty` — a static "we need your inputs" card — while a working engine sits one HTTP call away. Worse, **there is no UI to add a `program` or `school`** (the exact inputs `_scored_programs` reads from `education.programs`/`education.schools`), so even a motivated user cannot feed the engine. This is the Family-domain hidden-moat pattern (Sprint A's `FamilyOfficeService -> GET /v1/family/office` with no reader) repeating verbatim in Education.

This document specifies how to turn Education from a **records list** into a **Decision Center** — a place where a user compares real programs and walks away with a recommended path — by surfacing what already exists. **No new backend, no new model, no new schema.**

---

## 1. What EXISTS vs what is MISSING

| Capability                   | Backend (EXISTS)                                                                                                                    | Frontend (state today)                                                                     | Gap                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------ |
| Education Readiness          | `apps/web/src/lib/readiness/education.ts` + `/api/education/readiness`                                                              | **Surfaced** — `ReadinessCard` on `dashboard/education/page.tsx`                           | None (works)                         |
| Programs Under Consideration | `education.programs`/`education.schools` tables (migration `127_education_schema.sql`); read by `EducationService._scored_programs` | **MISSING UI** — no add/list page for programs; `degrees/` only handles earned credentials | Add a Programs CRUD surface          |
| ROI (cost/lift/breakeven)    | `EducationROIEngine.score_program` → `net_cost`, `opportunity_cost`, `income_lift`, `breakeven_months`                              | **DARK** — `roi-analysis/page.tsx` = `EducationTabEmpty`                                   | Wire `/v1/education/comparison`      |
| Scenario comparison          | `scenarios = {worst, expected, best}` (risk-adjusted by completion prob.) in `ProgramScore`                                         | **DARK** — never rendered                                                                  | Surface scenario band                |
| Career impact                | `_career_score` + `career_alignment_gap` rec + `career_context` in summary                                                          | **DARK** — `career-alignment/page.tsx` = `EducationTabEmpty`                               | Wire career section                  |
| Funding / debt impact        | `high_debt_warning` rec; `_monthly()` 120-mo payment in report §6; `finance.debts` join in `_context`                               | **DARK** — no financing surface                                                            | Surface §6 Financial Impact          |
| Recommended path             | `best_program` + `2_recommended_path` report section + `best_program_match` rec                                                     | **DARK**                                                                                   | The headline of the Decision Center  |
| 9-section report (PDF)       | `EducationReportBuilder.build` + `render_education_pdf` (`pdf_renderer.py`) wired via `/api/reports/education/pdf`                  | **Surfaced (PDF only)** — `reports/page.tsx` → `DomainReports`                             | Works as a download; not interactive |

**Single biggest gap:** the _interactive_ comparison + recommended path. The PDF works; the live, explorable decision view does not exist, and the inputs that feed it cannot be entered.

---

## 2. Endpoints to surface (all already live)

From `apps/lifenavigator-core-api/app/routers/education_domain.py` (`prefix="/v1/education"`):

- `GET /summary` → `DomainViewModel` with `data.programs[]`, `data.best_program`, `data.comparison{ranked_by, weights, count}`, `data.career_context`, `data.missing_data_prompts`, plus `recommendations[]` and `confidence`.
- `GET /comparison` → `{programs, best_program, comparison}` (the lean shape the Decision Center grid wants).
- `GET /report` → the structured 9-section `EducationReportViewModel` + `charts` (cost comparison, salary uplift, breakeven timeline, confidence bands, ROI scenario range, score radar).
- `GET /recommendations` → summary with `recommendations[]` (evidence + assumptions + governance boundary).
- `POST /recommendations/generate` → persists recs to `education.education_recommendations`.
- `POST /report/generate` → persists report; returns reproducible `content_hash`.

**Web wiring task:** add a thin Next.js proxy `apps/web/src/app/api/education/comparison/route.ts` that forwards the authenticated request to the core API `/v1/education/comparison` (mirror the auth/forwarding pattern already used by `apps/web/src/app/api/reports/[type]/pdf/route.ts`). No business logic in the proxy — the engine is authoritative.

---

## 3. The Decision Center IA (surface, don't rebuild)

Replace the dark tabs with a single decision-first page at `/dashboard/education` (Overview keeps its readiness + snapshot; the new center lives behind a prominent "Compare programs & ROI" CTA, or replaces `roi-analysis`).

```
Education Decision Center  (reads GET /v1/education/comparison + /report)
├── Recommended Path (hero)        ← data.best_program + report §2_recommended_path
│     "Best match: {program_name} — pays back in ~{breakeven_months} mo"  ← _verdict()
│     composite score ring + 6-axis radar (score_radar chart spec)
├── Program Comparison grid        ← data.programs[] sorted by composite
│     columns: net_cost · income_lift · breakeven_months · roi/career/risk/time scores · confidence
├── Scenario band (per program)    ← scenarios.worst/expected/best.annual_income_lift
├── Funding & Debt impact          ← report §6_financial_impact (est_monthly_payment_120mo, debt_warning)
├── Career impact                  ← report §5_compensation_forecast + career_alignment_gap rec
├── Recommendations rail           ← recommendations[] (best_program_match, lower_cost_alternative, …)
└── Evidence & Assumptions drawer  ← report §9_evidence_appendix (citations[], assumptions[])
```

Every number rendered must show its `source_table`/`explanation` on hover or in the evidence drawer — the data is already shaped for it (`_ev(...)` rows in `education_roi.py`). This is the trust spine; do not strip it.

---

## 4. Honest states — zero dead ends

The engine itself tells you which state to render via `data.missing_data_prompts` and per-program `missing[]`:

- **EMPTY** (`missing` includes `"programs"`, i.e. `_scored_programs` returned `[]`): show a decision-framed empty state, **not** today's passive `EducationTabEmpty`. Copy: _"Add a program you're considering and we'll compare its ROI, cost, breakeven, and career fit against your real income — every number cited."_ Primary CTA → the new Programs add surface (see §5). Secondary → "Set a target role" (feeds `target_role`, unblocks fit + career scores).
- **IN-PROGRESS** (programs exist but `missing_data_prompts` includes `"career_profiles"`, or per-program `missing` includes `program_tuition`/`program_median_salary`/`current_market_value`): render the grid with the computed scores, but badge the affected cells "estimate — add {field} to firm this up" using the real `missing[]` list. Confidence ring reflects `_confidence_score` (present fields / 4). Never blank the row.
- **COMPLETE** (programs scored, `current_median` present): full Recommended Path hero + grid + scenarios + recommendations + downloadable PDF (existing `/api/reports/education/pdf`).

The `missing` arrays are produced honestly by the engine — surface them verbatim as the "what unlocks more" affordance. No fabricated placeholders.

---

## 5. The one genuinely-missing input surface (no new infra)

The blocker is that users can record earned degrees (`degrees/page.tsx` via `EntityCrudSection apiBase="/api/education"`) but cannot record a **program under consideration** (`education.programs`). The table, RLS, and `EducationService.write(table="programs")` already exist (migration 127; `write()` in `education.py`). The only missing piece is a CRUD surface, identical in pattern to `degrees/page.tsx`:

- New page `apps/web/src/app/dashboard/education/programs/page.tsx` → `EntityCrudSection apiBase="/api/education" slug="programs"` with fields mapping to the ROI inputs the engine reads: `name`, `school_id` (catalog pick), `tuition`, `duration_months`, `median_salary` (Scorecard, optional), `graduation_rate` (optional), `major`, `modality`.
- Confirm `apps/web/src/app/api/education/[entity]/route.ts` already routes `programs`/`schools` to `EducationService.write` (it is a generic entity router — verify, do not duplicate).

This is the single highest-leverage change: it turns the entire dark engine ON. It is data-entry plumbing, not a feature.

---

## 6. Definition of done

1. `/dashboard/education/roi-analysis` (or a renamed "Decision Center") renders the live comparison from `/v1/education/comparison` with the Recommended Path hero, the grid, scenario bands, and the evidence drawer.
2. A user can add a candidate program and watch it appear, scored and ranked, with cited numbers.
3. Empty / In-Progress / Complete states all resolve from the engine's real `missing` data — no `EducationTabEmpty`, no "coming soon," no dead CTA.
4. Career-alignment tab reads `career_alignment_gap` + `career_context` instead of `EducationTabEmpty`.
5. The downloadable PDF (already working) is reachable from the Decision Center, sharing the same `content_hash`-reproducible data.
6. Every displayed figure traces to a `source_table` — verified against `education_roi.py` evidence rows.

**No new tables, endpoints, models, or AI calls. The engine exists; this sprint connects the wire.**
