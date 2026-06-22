# FAMILY_SURFACING_AUDIT.md — Sprint B surfacing pointer

**Concise pointer doc.** The full surfacing spec already exists — do NOT regenerate it. This adds the
**Sprint B angle**: how the Family domain should render extracted `life.facts` values (per
`LIFE_FACTS_RENDERING_MAP.md`). One source: `life.facts`, read-only, RLS-scoped,
`confirmation_status in ('confirmed','inferred')`.

## (a) Existing surfacing spec — REUSE

- **`FAMILY_COMMAND_CENTER.md`** — the family-office Overview + pillars layout. Primary surfacing spec.
- **`ESTATE_READINESS_ENGINE.md`** — the estate scoring + readiness pillars the facts attach under.
- **`FAMILY_EXPERIENCE_REDESIGN.md`** — the visual/IA redesign that hosts the pillar evidence chips.

This audit does not restate those. It only specifies where extracted document values land inside them.

## (b) Biggest built-but-hidden engine

**`FamilyOfficeService`** (`apps/lifenavigator-core-api/app/services/family_office.py`, class at line 32)
served by **`GET /v1/family/office`** (`app/routers/family_domain.py:48`). It computes the estate /
beneficiary / survivor readiness scores and status bands (`_status`, line 28) but the page underexposes
it — the pillars render scores without the **document-extracted facts that justify them**. The engine is
the moat; the missing wire is showing the trustee/beneficiary/coverage values it scored over.

## (c) Sprint B life.facts rendering — Family domain

`life.facts.fact_type` is `"<doc_type>.<field_key>"`. Family-domain doc types and the exact field keys
come from the document taxonomy in `app/services/documents.py`. Render the following under the existing
Command-Center pillars (filter `domain='family'`):

### Estate pillar

| fact_type                                                       | Source doc                       | Render as                                          |
| --------------------------------------------------------------- | -------------------------------- | -------------------------------------------------- |
| `will.executor`                                                 | Will (`documents.py:129`)        | "Executor: <name>" chip                            |
| `will.guardian`                                                 | Will                             | "Guardian named" chip (or honest empty)            |
| `will.beneficiaries`                                            | Will                             | Beneficiary list under Estate pillar               |
| `will.last_updated`                                             | Will                             | "Will last updated <date>" — staleness flag if >3y |
| `trust.successor_trustee`                                       | Trust (`documents.py:128`)       | "Successor trustee: <name>"                        |
| `trust.trustee` / `trust.grantor`                               | Trust                            | Trust-structure mini-card                          |
| `trust.beneficiaries`                                           | Trust                            | Beneficiary list (dedupe vs will)                  |
| `trust.revocable_status`                                        | Trust                            | "Revocable / Irrevocable" tag                      |
| `trust.estimated_value`                                         | Trust                            | Funded-value figure (number-gate eligible)         |
| `estate_plan.has_will` / `has_poa` / `has_healthcare_directive` | Estate Plan (`documents.py:130`) | Three readiness checkmarks                         |

### Beneficiary / Survivor (coverage) pillar

| fact_type                                                      | Source doc                          | Render as                               |
| -------------------------------------------------------------- | ----------------------------------- | --------------------------------------- |
| `life_insurance_policy.coverage_amount`                        | Life Insurance (`documents.py:116`) | "Coverage: $X" headline figure          |
| `life_insurance_policy.beneficiaries`                          | Life Insurance                      | Beneficiary chips under Survivor pillar |
| `life_insurance_policy.insurer` / `policy_type` / `term_years` | Life Insurance                      | Policy detail line                      |
| `disability_insurance.monthly_benefit`                         | Disability (`documents.py:117`)     | "Income protection: $X/mo"              |
| `umbrella_policy.coverage_amount`                              | Umbrella (`documents.py:119`)       | Liability-coverage chip                 |
| `ltc_insurance.daily_benefit`                                  | LTC (`documents.py:118`)            | LTC coverage chip                       |

These are exactly the values the advisor reader already cites (`advisor_facts.py:220-239` notes the
"trust on file but couldn't cite the successor trustee" gap) — the Family page must now show them too.

## Trust + provenance rules (uniform)

- Confirmed/inferred only; never render `candidate`.
- Each chip shows source document + confidence tier; inferred = "pending confirmation" with one-click
  confirm (migration-165 review lifecycle).
- Click-through to Evidence drawer (page/section/char-span) via `provenance.document_id` →
  `documents.document_fields` (live since 165).
- Never overwrite a user-confirmed family value with a document fact — read-before-write is already
  enforced in `_bridge_family` / `_upsert_estate` (`documents.py:598`).

## Honest empty states

- No estate docs: "Upload a will or trust and your executor, guardian, and beneficiaries appear here."
- Policy on file but a field missing: show the field as "Not found in document" — never infer a value.

## Wire (highest ROI, no new infra)

Per the rendering map's shared primitive: add `LifeFactsService.facts(ctx, domain='family')` over
`life.facts` and consume it from the Family page through a thin proxy. Reuse the advisor's existing
inline read (`advisor_facts.py:224`) — extract, do not duplicate.
