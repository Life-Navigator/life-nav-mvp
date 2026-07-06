# Education ROI Experience — Surfacing the Computed ROI/Cost/Breakeven/Scenario Engine

> **Grounded finding.** The ROI math is _done and cited._ `EducationROIEngine.score_program` (`apps/lifenavigator-core-api/app/services/education_roi.py`) returns a `ProgramScore` dataclass with concrete, named fields — `net_cost`, `opportunity_cost`, `income_lift`, `breakeven_months`, a `scenarios` dict (`worst`/`expected`/`best` each carrying `annual_income_lift`), a `scores` dict of seven 0–100 sub-scores, plus `evidence[]`, `assumptions[]`, and `missing[]`. `EducationReportBuilder.build` (`apps/lifenavigator-core-api/app/services/education_report.py`) packages these into `4_roi_analysis`, `5_compensation_forecast`, `6_financial_impact`, `8_risk_analysis` sections and six `charts` specs (`total_cost_comparison`, `expected_salary_uplift`, `breakeven_timeline`, `confidence_bands`, `roi_scenario_range`, `score_radar`). `EducationService._composite` (`apps/lifenavigator-core-api/app/domains/education.py`) ranks programs with config-sourced weights `{roi:.25, career:.20, fit:.15, risk:.15, time:.10, family:.10}` scaled by confidence. **The web app renders none of it** — `apps/web/src/app/dashboard/education/roi-analysis/page.tsx` is a six-line `EducationTabEmpty` stub. This spec defines the ROI _experience_ purely as a renderer over the existing fields. Every field cited below is real; nothing here adds computation.

---

## 1. The exact fields to surface (from `ProgramScore` / `_score_dict`)

`EducationService._score_dict` (`education.py`) emits each program as:

```jsonc
{
  "program_id", "program_name", "school",
  "net_cost",            // tuition (USD)                       — evidence: education.programs
  "opportunity_cost",    // current_median × yrs × 0.5 (part-time forgone)  — computed
  "income_lift",         // program median_salary − current_median          — education.programs + ln_central.compensation_bands
  "breakeven_months",    // total_invest ÷ (income_lift/12)                  — computed
  "scenarios": {
    "worst":    {"annual_income_lift": income_lift × 0.6 × completion},
    "expected": {"annual_income_lift": income_lift × completion},
    "best":     {"annual_income_lift": income_lift × 1.3}
  },
  "scores": {"fit","roi","career","family","risk","time","confidence"},  // each 0–100
  "composite": <_composite()>,   // weighted, confidence-scaled headline number
  "missing": [...]               // e.g. ["program_median_salary","current_market_value"]
}
```

These come over the wire from `GET /v1/education/comparison` → `{programs[], best_program, comparison}` and the richer `GET /v1/education/report` (sections + charts). **Do not recompute on the client.** The reproducibility guarantee (`content_hash` in `education_report.py` normalizes out timestamps) only holds if the backend is the single source.

---

## 2. The ROI experience — three views over one dataset

### A. Recommended Path (hero)

- Source: `best_program` (top of `programs[]`, already sorted by `_composite`) + report `2_recommended_path` + `_verdict()`.
- Render: program name, school, the `_verdict()` sentence (e.g. _"{name} pays back in ~{breakeven_months} months on cited estimates"_), the `composite` as a score ring, and the `score_radar` chart (`axes: fit/roi/career/family/risk/time`, `values` from `best.scores`).
- This is the one screen an investor demo should land on — it is the "advice, not records" moment.

### B. Comparison grid (the decision table)

One row per program in `programs[]`, columns mapping 1:1 to fields:

| Column           | Field                     | Format                                                         |
| ---------------- | ------------------------- | -------------------------------------------------------------- |
| Program / School | `program_name` / `school` | text                                                           |
| Total cost       | `net_cost`                | `$` (from `total_cost_comparison` chart)                       |
| Opportunity cost | `opportunity_cost`        | `$`, tooltip = `0.5 × current income × {duration}y` assumption |
| Income lift      | `income_lift`             | `$/yr` (from `expected_salary_uplift` chart)                   |
| Breakeven        | `breakeven_months`        | months → "~X.X yrs" (from `breakeven_timeline` chart)          |
| ROI score        | `scores.roi`              | 0–100 bar                                                      |
| Career score     | `scores.career`           | 0–100 bar                                                      |
| Risk score       | `scores.risk`             | 0–100 bar (lower risk = higher score)                          |
| Confidence       | `scores.confidence`       | 0–100 ring (from `confidence_bands` chart)                     |
| Composite        | `composite`               | headline rank                                                  |

Sort defaults to `composite` desc (backend already does this; preserve order). Allow client-side re-sort by any column without refetching.

### C. Scenario band (per program)

- Source: `scenarios.{worst,expected,best}.annual_income_lift` + report `roi_scenario_range` chart (`type: "range"` for `best_program`).
- Render a horizontal range bar: worst ── expected ●── best, labeled with dollar values. Caption from the real assumption: _"Range is the income-lift band risk-adjusted by completion probability (≈{completion}%)."_ — the assumption text is already in `ProgramScore.assumptions`.

---

## 3. Trust rendering (the data is built for it — don't drop it)

Each `ProgramScore.evidence[]` row is `{metric_name, metric_value, source_table, observed_at, confidence, explanation}`. The report's `9_evidence_appendix` aggregates `evidence`, deduped `assumptions`, and sorted `citations`. UX rules:

- **Every dollar/score is clickable** → opens the evidence row: value, `source_table` (e.g. `education.programs`, `ln_central.compensation_bands`, `computed`), and the plain-English `explanation` (e.g. _"program earnings minus current market value"_).
- **Assumptions are always visible** in a drawer: the three model assumptions (`50% income forgone`, `Scorecard earnings are cohort-level lagged bands`, `completion probability ≈ X%`) come straight from `assumptions[]`. Showing them is the difference between "trust me" and "advisor-grade."
- **Never invent.** When `missing[]` lists `program_median_salary` or `current_market_value`, the income-lift / breakeven cells render as "—" with "add {field} to compute" — the engine already declines to fabricate (`income_lift = None` when inputs absent). Mirror that honesty in the UI.

---

## 4. Empty / In-Progress / Complete

| State           | Trigger (from real data)                                                                              | ROI experience renders                                                                                                                                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Empty**       | `comparison.count == 0` / `missing` has `"programs"`                                                  | Decision-framed prompt: _"Add a program you're weighing — we'll compute cost, breakeven, income lift, and a worst/expected/best band, all cited."_ CTA → add-program surface (`EDUCATION_DECISION_CENTER.md §5`). No fake sample row. |
| **In-Progress** | programs exist but per-row `missing[]` non-empty or `data.missing_data_prompts` has `career_profiles` | Grid renders with computed cells; uncomputable cells show "—" + the specific missing input; confidence rings reflect `scores.confidence`. A banner: _"Add your current role/income to firm up income-lift and breakeven."_            |
| **Complete**    | programs scored + `current_median` present                                                            | Full hero + grid + scenario bands + radar + evidence drawer + PDF download (`/api/reports/education/pdf`).                                                                                                                            |

---

## 5. Definition of done

1. `roi-analysis/page.tsx` fetches `/v1/education/comparison` (via a thin web proxy mirroring `api/reports/[type]/pdf/route.ts`) and renders views A/B/C — no `EducationTabEmpty`.
2. Every dollar figure and score traces to an `evidence` row's `source_table` + `explanation` in the UI.
3. Scenario band reads `scenarios.worst/expected/best.annual_income_lift` verbatim — no client math.
4. Composite ranking order matches `_composite` (backend order preserved).
5. Missing inputs render honestly from `missing[]`; nothing fabricated.
6. The interactive view and the PDF share the same backend data (same `content_hash`).

**No new computation, schema, endpoint, or model — this is a renderer over `EducationService.summary()` / `build_report()`.**
