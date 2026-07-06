# HEALTH_SURFACING_AUDIT.md — Sprint B surfacing pointer

**Concise pointer doc.** The full surfacing spec already exists — do NOT regenerate it. This adds the
**Sprint B angle**: how the Health domain should render extracted `life.facts` values (per
`LIFE_FACTS_RENDERING_MAP.md`). One source: `life.facts`, read-only, RLS-scoped,
`confirmation_status in ('confirmed','inferred')`.

## (a) Existing surfacing spec — REUSE

- **`HEALTH_COMMAND_CENTER.md`** — the health Overview + readiness/biomarker layout. Primary spec.
- **`HEALTH_EXPERIENCE_REDESIGN.md`** — the IA/visual redesign that hosts the lab + plan evidence.

This audit does not restate those. It only specifies where extracted lab / health-doc values land.

## (b) Biggest built-but-hidden engine

**`HealthIntelligenceService`** (`apps/lifenavigator-core-api/app/services/health_intelligence.py`, class
at line 52) served by **`GET /v1/health/intelligence`** (`app/routers/health_domain.py:21`, prefix
`/v1/health`). It computes health readiness scores + status bands (`_status`, line 48) and parses
multi-value fields (`_split`, line 42). The engine is the moat — but the page renders a score without the
**actual extracted biomarker values** behind it. The missing wire is showing the lab numbers it scored
over, with the document they came from.

> Safety note: the health domain has a deterministic safety net (chest-pain / red-flag) that runs ahead of
> any LLM. Surfacing facts is read-only display; it does NOT change the safety gate or constitute medical
> advice. Render values, ranges, and source — never diagnose.

## (c) Sprint B life.facts rendering — Health domain

`life.facts.fact_type` is `"<doc_type>.<field_key>"`. Health doc types + exact field keys from the
taxonomy in `app/services/documents.py`. Render under the existing Command-Center biomarker panel
(filter `domain='health'`):

### Lab biomarkers (Lab Report, `documents.py:137`)

| fact_type                      | Render as                                              |
| ------------------------------ | ------------------------------------------------------ |
| `lab_report.total_cholesterol` | Lipid panel value + reference range, trend if repeated |
| `lab_report.hdl`               | "HDL" value chip                                       |
| `lab_report.ldl`               | "LDL" value chip                                       |
| `lab_report.triglycerides`     | Triglycerides value chip                               |
| `lab_report.glucose`           | Fasting glucose value                                  |
| `lab_report.a1c`               | A1c value (diabetes-range banding)                     |
| `lab_report.vitamin_d`         | Vitamin D value                                        |
| `lab_report.tsh`               | Thyroid (TSH) value                                    |

### Benefits-side health coverage (Medical Plan, `documents.py:108`)

| fact_type                        | Render as                    |
| -------------------------------- | ---------------------------- |
| `medical_plan.premium`           | Plan premium chip            |
| `medical_plan.deductible`        | Deductible chip              |
| `medical_plan.out_of_pocket_max` | OOP-max chip (cost-exposure) |
| `medical_plan.coverage_type`     | Coverage-tier label          |

### Regimen (native-text health docs)

- `medication_list.*` (Medication List), `supplement_list.*` (Supplement List), `fitness_plan.*`,
  `nutrition_log.*` — render as regimen chips when present; honest-empty otherwise. LTC overlap:
  `ltc_insurance.daily_benefit` may also surface under Family (`documents.py:118`, domains `family,health`).

Surfacing the **lab values with their reference ranges and source date** is the highest-trust win: the
readiness score becomes legible instead of opaque.

## Trust + provenance rules (uniform)

- Confirmed/inferred only; never render `candidate`.
- Each value shows source document + confidence tier + draw date; inferred = "pending confirmation" with
  one-click confirm (migration-165 review lifecycle).
- Numeric biomarkers are number-gate eligible — never present an unconfirmed value as authoritative.
- Click-through to Evidence drawer via `provenance.document_id` → `documents.document_fields` (since 165).
- Never overwrite a user-confirmed health value with a document fact — read-before-write.
- Display only; the deterministic health-safety net is unchanged.

## Honest empty states

- No lab/health docs: "Upload a lab report and your biomarkers appear here with their reference ranges."
- Panel present but a marker missing: show "Not found in this report" — never infer a value.

## Wire (highest ROI, no new infra)

Add `LifeFactsService.facts(ctx, domain='health')` over `life.facts`; consume via a thin proxy and feed
extracted biomarkers into the existing `HealthIntelligenceService` display inputs. Reuse the advisor's
inline read (`advisor_facts.py:224`) — extract, do not duplicate.
