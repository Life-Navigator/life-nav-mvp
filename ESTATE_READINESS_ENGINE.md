# ESTATE_READINESS_ENGINE.md — Sprint A

**Status:** The engine **already exists and is correct.** This document specifies how to **surface** it. No engine changes, no new infra.

## What exists today (grounded)

`apps/lifenavigator-core-api/app/services/family_office.py` → `FamilyOfficeService`, exposed at **`GET /v1/family/office`**. It reads `family.estate_plans`, `family.insurance_profiles`, `family.dependents`, and document-extracted JSON (`will`, `trust`, `estate_plan`, `life_insurance_policy`) and computes five pillars:

| Pillar          | Formula (verbatim from audit)                                   | RED / ORANGE / YELLOW / GREEN             |
| --------------- | --------------------------------------------------------------- | ----------------------------------------- |
| **Estate**      | (will + POA + healthcare_directive + beneficiaries) / 4 × 100   | <2 docs / 2 / 3 / all 4                   |
| **Trust**       | has_trust=90; warranted(dependents>0 OR need>$500k)=25; else=60 | absent-but-warranted / … / funded+current |
| **Beneficiary** | (life_insurance_beneficiary + retirement_beneficiary) / 2 × 100 | neither / — / one / both named            |
| **Survivor**    | (coverage / insurance_need) × 100, capped                       | <0.3 / 0.3–0.6 / 0.6–0.8 / ≥0.8           |
| **Legacy**      | average of the 4 pillars above                                  | composite GREEN/YELLOW/ORANGE/RED         |

Each pillar already returns: score, status color, **evidence**, a **recommendation**, and a **legal boundary** (`"…require a licensed attorney. This is planning readiness, not legal advice."`). The `insurance_need` = 10× income (from `CompensationIntelligenceEngine`) + total debt (`finance.debts`); `coverage_gap` = need − coverage.

## The gap: it's invisible

- **No `/api/family/office` proxy** wired from the web app, and **no component renders the pillars.** The Estate tab (`/dashboard/family/estate/page.tsx`) is an empty `FamilyTabEmpty` stub that tells the user to "upload estate documents" but never shows the score the backend already computed.
- The Overview shows only the flat `summary()` flags (`has_will/has_poa/has_beneficiaries`) — not the scored, color-coded, evidence-backed pillars.

## Surfacing specification (the only work)

1. **Proxy:** add `GET /api/family/office` → forwards JWT to `/v1/family/office` (mirrors `/api/family/summary`).
2. **Estate tab → real:** replace the stub with a **5-pillar board**. Each pillar card shows the score ring (reuse the existing `_ring` SVG pattern from the advisor PDF renderer), status chip, the evidence line, the per-pillar recommendation, and the legal disclaimer (already in the payload).
3. **Overview hero:** Legacy composite becomes the Family Readiness score; the **weakest pillar** is the headline call-out ("Estate is your weakest pillar — will and POA missing").
4. **Honest states per pillar:**
   - RED/ORANGE → show the exact missing object + the recommendation's escalation path (attorney).
   - YELLOW → show what's partial (e.g., "3 of 4 estate docs").
   - GREEN → show the maintenance nudge the pillar already emits ("review every 3 years").
5. **Provenance link:** when a pillar's evidence came from an uploaded document, link to that document's Evidence drawer (now live via migration 165) — closes "where did this score come from?" in one click.

## Change visibility (ties to Sprint B)

Because pillars are pure functions of the underlying rows, **any document upload or CRUD edit recomputes them on next fetch.** The experience requirement: render the **delta**. Capture the pre-upload pillar snapshot (client-side or via a readiness snapshot) and, after processing, show "Estate 50→75, Beneficiary 50→100" with the triggering document named. (Mechanism detailed in DOCUMENT_CHANGE_VISIBILITY.md.)

## Explicitly NOT in scope (no feature inflation)

Disability-gap scoring, elder-care/Medicaid readiness, special-needs-trust analysis, estate-tax-threshold modeling, document-staleness alerts — all confirmed ABSENT in the audit. They are **future engine work**, not surfacing, and are deferred. This sprint ships the five pillars that already exist.

## Acceptance

`GET /v1/family/office` renders as a five-pillar board on the Estate tab and a composite hero on Overview, every score color-correct and evidence-linked, with the weakest pillar driving the next-action call-out — using zero new backend.
</content>
