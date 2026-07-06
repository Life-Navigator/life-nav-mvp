# CAREER_SURFACING_AUDIT.md — Sprint B surfacing pointer

**Concise pointer doc.** The full surfacing spec already exists — do NOT regenerate it. This adds the
**Sprint B angle**: how the Career domain should render extracted `life.facts` values (per
`LIFE_FACTS_RENDERING_MAP.md`). One source: `life.facts`, read-only, RLS-scoped,
`confirmation_status in ('confirmed','inferred')`.

## (a) Existing surfacing spec — REUSE

- **`CAREER_COMMAND_CENTER.md`** — the career Overview + readiness/compensation layout. Primary spec.
- **`CAREER_EXPERIENCE_REDESIGN.md`** — the IA/visual redesign that hosts the comp + offer evidence.

This audit does not restate those. It only specifies where extracted offer-letter / pay-stub values land.

## (b) Biggest built-but-hidden engine

**`CompensationBenefitsEngine`** (`apps/lifenavigator-core-api/app/services/comp_benefits.py`, class at
line 46) served by **`GET /v1/benefits`** (`app/routers/benefits.py:16`, prefix `/v1/benefits`).
It models marginal tax (`marginal_rate`, line 38) and benefits value, and is paired with
`CompensationIntelligenceEngine` (`compensation.py:79`, with SOC-code mapping `soc_for`, line 75 and
band gaps `_missing_bands`, line 180). These compute market comp bands and total-comp figures — but the
career page renders the score without the **actual extracted offer/pay numbers** the engine reasons over.
The engine is the moat; the missing wire is grounding it in the user's real documents.

## (c) Sprint B life.facts rendering — Career domain

`life.facts.fact_type` is `"<doc_type>.<field_key>"`. Career doc types + exact field keys from the
taxonomy in `app/services/documents.py`. Render under the existing Command-Center comp section
(filter `domain='career'`):

### Compensation headline (offer / plan)

| fact_type                                            | Source doc                        | Render as                                           |
| ---------------------------------------------------- | --------------------------------- | --------------------------------------------------- |
| `offer_letter.base_salary`                           | Offer Letter (`documents.py:103`) | "Base: $X" — the number the band compares against   |
| `offer_letter.title`                                 | Offer Letter                      | Current/target title; feeds `soc_for` market lookup |
| `offer_letter.signing_bonus`                         | Offer Letter                      | One-time comp chip                                  |
| `offer_letter.annual_bonus`                          | Offer Letter                      | Variable-comp chip                                  |
| `offer_letter.equity_grant`                          | Offer Letter                      | Equity figure (number-gate eligible)                |
| `offer_letter.start_date`                            | Offer Letter                      | Tenure / vesting-clock anchor                       |
| `compensation_plan.base_salary`                      | Comp Plan (`documents.py:104`)    | Base figure                                         |
| `compensation_plan.target_bonus` (percent)           | Comp Plan                         | "Target bonus: X%"                                  |
| `compensation_plan.equity_grant` / `commission_rate` | Comp Plan                         | Variable-comp detail line                           |

### Title / trajectory (promotion)

| fact_type                          | Source doc                            | Render as                 |
| ---------------------------------- | ------------------------------------- | ------------------------- |
| `promotion_letter.new_title`       | Promotion Letter (`documents.py:106`) | Trajectory timeline event |
| `promotion_letter.new_base_salary` | Promotion Letter                      | Comp-progression delta    |
| `promotion_letter.effective_date`  | Promotion Letter                      | Promotion date marker     |

These extracted numbers are precisely what makes the comp comparison **trustworthy** — show the user's
real base/title next to the market band so the engine's verdict is grounded, not abstract.

## Trust + provenance rules (uniform)

- Confirmed/inferred only; never render `candidate`.
- Each comp chip shows source document + confidence tier; inferred = "pending confirmation" + one-click
  confirm (migration-165 review lifecycle).
- Money facts feed the number-gate path (same gate the advisor uses in `advisor_facts.py`) — never
  render an unconfirmed dollar figure as authoritative.
- Click-through to Evidence drawer via `provenance.document_id` → `documents.document_fields` (since 165).
- Never overwrite a user-confirmed career value with a document fact — read-before-write.

## Honest empty states

- No offer/pay docs: "Upload an offer letter or pay stub and your comp appears here, compared to market."
- Title present but salary missing: show "Salary not found in document" — never infer.

## Wire (highest ROI, no new infra)

Add `LifeFactsService.facts(ctx, domain='career')` over `life.facts`; consume via a thin proxy from the
career page and feed the extracted base/title into the existing `CompensationIntelligenceEngine` inputs.
Reuse the advisor's inline read (`advisor_facts.py:224`) — extract, do not duplicate.
