# FAMILY_COMMAND_CENTER.md — Sprint A

**Thesis:** The Family backend is already a family office. The UI hides it. This sprint **surfaces** existing intelligence into one command center — no new tables, no new engines, no new models.

## The core finding (grounded audit, 2026-06-21)

- **Built but hidden:** `FamilyOfficeService` (`apps/lifenavigator-core-api/app/services/family_office.py`) computes a 5-pillar readiness model — **Estate, Trust, Beneficiary, Survivor, Legacy** — each scored GREEN/YELLOW/ORANGE/RED with evidence + per-pillar recommendations + legal boundary. Exposed at **`GET /v1/family/office`**. **No frontend reads it.**
- **Built and shown:** 11 CRUD pages (members, pets, dependents, beneficiaries, guardianship, emergency-contacts, trusted-advisors, documents, recommendations, reports, overview) reading real RLS data; `/api/family/summary` → protection (life coverage, 10×-income+debt need, coverage gap), readiness, college, recommendations.
- **Stubs / missing in UI:** Estate / Goals / Settings tabs are empty (`FamilyTabEmpty`). **No Family Timeline. No Family Opportunities. No "what changed after upload."** The office pillars and the 5 computed recommendation types (insurance_gap, guardianship_gap, estate_gap, college_funding, survivor_scenario) are under-surfaced.

## What "Family Command Center" means

A single `/dashboard/family` Overview that answers, at a glance: **If something happened to me tomorrow, what happens to my family — and what should I do next?** It composes existing data into 12 zones, each with honest Empty / In-Progress / Complete states.

| Zone                       | Data source (EXISTS today)                                                             | Surfacing action                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Family Readiness**       | `family_office.legacy` composite (avg of 4 pillars) + `/api/family/summary` confidence | Hero score ring + one-line "weakest pillar" call-out. Wire `/v1/family/office` (currently unused).                                    |
| **Dependents**             | `family.family_members` / `family.dependents`                                          | Roster card with ages + dependency level (built; lift onto Overview).                                                                 |
| **Beneficiaries**          | `family.beneficiaries` (+ doc-extracted beneficiary forms)                             | Coverage-map card: which accounts have named beneficiaries vs not (Beneficiary pillar already computes this).                         |
| **Guardians**              | `family.guardianship` + `guardianship_gap` rec                                         | Status chip (Not started→Filed) + gap alert when dependents>0 and undesignated.                                                       |
| **Trust Status**           | `family_office.trust` pillar + extracted `trust` docs                                  | Surface the Trust pillar (warranted/absent/funded) — today invisible.                                                                 |
| **Estate Readiness**       | `family_office.estate` pillar (will+POA+directive+beneficiaries /4)                    | Fill the empty Estate tab with the real checklist + score.                                                                            |
| **Insurance Coverage**     | `family.insurance_profiles` + `insurance_gap` rec + Survivor pillar                    | Coverage vs need bar with the quantified gap (`coverage_gap`).                                                                        |
| **Family Risks**           | The 5 recommendation types (high-priority = risks)                                     | Risk strip derived from active high-priority recs (estate/guardianship/survivor gaps).                                                |
| **Family Opportunities**   | college_funding rec + adequate-coverage positives + tradeoffs_json                     | **New surface, existing data** — frame non-gap items (529 headroom, "coverage adequate — revisit on income change") as opportunities. |
| **Document Vault**         | `documents` schema (will/trust/estate_plan/life_insurance) + provenance (165)          | Existing Documents page → add "drives these pillars" linkage.                                                                         |
| **Family Recommendations** | `family.family_recommendations` (evidence/assumptions/tradeoffs/governance)            | Already built; elevate with Sprint F recommendation card.                                                                             |
| **Family Timeline**        | Derived from existing timestamps (see FAMILY_TIMELINE.md)                              | **New surface, no new table** — change feed of uploads/recs/readiness deltas.                                                         |

## Empty / In-Progress / Complete (no dead ends)

Every zone renders one of three states, reusing `DomainEmptyState`/`FamilyTabEmpty`'s "what you know → what's missing → what it unlocks → next action" pattern:

- **Empty:** name the single highest-leverage next action (e.g., "Name a guardian for your 2 dependents" — sourced from `guardianship_gap`).
- **In-Progress:** show the partial score + the specific missing object (e.g., "Estate 50% — will ✓, POA ✗, directive ✗, beneficiaries ✓").
- **Complete:** show GREEN + a maintenance nudge ("Review every 3 years" — already produced by the Estate pillar).

## "Show value" requirements (Success Criteria 3–7)

1. **What exists** — every populated zone reflects real rows (no fabrication; the audit confirms all numbers are API-sourced).
2. **What is missing** — driven by `missing_data_prompts` (summary) + ORANGE/RED pillars (office). Never inferred silently.
3. **What should happen next** — the highest-priority active recommendation, with its escalation path (attorney / licensed advisor).
4. **What changed after a document upload** — see FAMILY_TIMELINE.md + DOCUMENT_CHANGE_VISIBILITY.md (Sprint B): a will upload must visibly move the Estate + Beneficiary pillars and clear/raise recs.

## Build scope (reuse-first; honors "no new infra / no feature inflation")

- **Wire** `/v1/family/office` → new `/api/family/office` proxy (route file already noted in audit) → Overview pillar cards. _(highest leverage; pure surfacing)_
- **Fill** the Estate stub with the Estate-pillar checklist (data exists).
- **Add** Opportunities + Timeline surfaces from existing data (no schema).
- **Do NOT build** (out of scope, flagged for later): disability-gap engine, elder-care scoring, special-needs-trust analysis, pet-care continuation, dynamic reassessment triggers — all confirmed ABSENT in the audit; explicitly deferred to respect the no-inflation rule.

## Acceptance

A user with a spouse, 2 kids, a life-insurance policy uploaded, and no will sees: Readiness ORANGE with "Estate is your weakest pillar"; an Estate card showing will ✗/POA ✗/directive ✗/beneficiaries ✓; a guardianship risk; a quantified insurance gap or "adequate"; and a Timeline entry for the policy upload that moved the Survivor pillar. Every claim traces to a real row or a cited recommendation.
</content>
