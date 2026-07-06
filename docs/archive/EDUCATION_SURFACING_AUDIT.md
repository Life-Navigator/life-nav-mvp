# EDUCATION_SURFACING_AUDIT.md — Sprint B surfacing pointer

**Concise pointer doc.** The full surfacing spec already exists — do NOT regenerate it. This adds the
**Sprint B angle**: how the Education domain should render extracted `life.facts` values (per
`LIFE_FACTS_RENDERING_MAP.md`). One source: `life.facts`, read-only, RLS-scoped,
`confirmation_status in ('confirmed','inferred')`.

## (a) Existing surfacing spec — REUSE

- **`EDUCATION_DECISION_CENTER.md`** — the program-comparison / ROI decision layout. Primary spec.
- **`EDUCATION_EXPERIENCE_REDESIGN.md`** — the IA/visual redesign that hosts the program + credential
  evidence.

This audit does not restate those. It only specifies where extracted transcript / program values land.

## (b) Biggest built-but-hidden engine

**`EducationROIEngine`** (`apps/lifenavigator-core-api/app/services/education_roi.py`, class at line 49)
backing the comparison + ROI routes (`app/routers/education_domain.py`, prefix `/v1/education`:
`/comparison` line 46, `/report` line 53). It scores each program across fit/ROI/career/family/risk/time
(`_fit_score`…`_time_score`, lines 151-209), computes breakeven and income-lift scenarios (`_scn`,
line 145), and emits cited evidence (`_ev`, line 141). This is the flagship engine — every ROI figure is
cited — but the page underexposes it: it scores programs without anchoring on the user's **already-earned
credentials and real net cost** from their documents. The engine is the moat; the missing wire is
grounding the comparison in the user's transcript and aid letter.

## (c) Sprint B life.facts rendering — Education domain

`life.facts.fact_type` is `"<doc_type>.<field_key>"`. Education doc types + field keys from the taxonomy
in `app/services/documents.py`. Render under the existing Decision-Center comparison panel
(filter `domain='education'`):

### Earned credentials / current education

| fact_type                         | Source doc                           | Render as                                    |
| --------------------------------- | ------------------------------------ | -------------------------------------------- |
| `program_details.program`         | Program Details (`documents.py:126`) | "Current/considered program" header          |
| `program_details.tuition` (money) | Program Details                      | Tuition input to ROI breakeven (number-gate) |
| `program_details.duration_months` | Program Details                      | Time-to-complete → `_time_score` input       |

> Note: degree/transcript extraction is staged via the `resume` doc type (`documents.py`) and the
> education domain bridge. Render any `resume.*` degree/institution facts (when present) as earned-
> credential chips; honest-empty when the extractor has not populated them.

### Real cost (financial aid)

| fact_type                         | Source doc                                | Render as                                        |
| --------------------------------- | ----------------------------------------- | ------------------------------------------------ |
| `financial_aid_letter.net_cost`   | Financial Aid Letter (`documents.py:125`) | The true cost feeding ROI/breakeven              |
| `financial_aid_letter.grants`     | Financial Aid Letter                      | "Grants (free money): $X"                        |
| `financial_aid_letter.loans`      | Financial Aid Letter                      | Debt-load chip → `_family_score` / `_risk_score` |
| `financial_aid_letter.work_study` | Financial Aid Letter                      | Cost-offset chip                                 |
| `financial_aid_letter.school`     | Financial Aid Letter                      | School label on the compared program             |

Surfacing **net cost** and **loans** is the single highest-trust win: the ROI verdict is only credible
when it runs over the user's real aid letter, not a generic tuition assumption.

## Trust + provenance rules (uniform)

- Confirmed/inferred only; never render `candidate`.
- Each credential/cost chip shows source document + confidence tier; inferred = "pending confirmation"
  with one-click confirm (migration-165 review lifecycle).
- Money facts (net cost, loans, tuition) are number-gate eligible — never present an unconfirmed dollar
  figure as authoritative in the ROI math.
- Click-through to Evidence drawer via `provenance.document_id` → `documents.document_fields` (since 165).
- Never overwrite a user-confirmed education value with a document fact — read-before-write.

## Honest empty states

- No transcript/aid docs: "Upload a transcript or financial aid letter and your credentials and real
  program cost appear here."
- Program named but cost missing: "Net cost not found in document" — never infer it into the ROI.

## Wire (highest ROI, no new infra)

Add `LifeFactsService.facts(ctx, domain='education')` over `life.facts`; consume via a thin proxy and
feed `net_cost`/`loans`/`tuition` into the existing `EducationROIEngine` inputs. Reuse the advisor's
inline read (`advisor_facts.py:224`) — extract, do not duplicate.
