# FAMILY DOMAIN — GAP ANALYSIS (pre-pilot) — 2026-06-10

The Family domain now has the shared-framework UI: 13 standardized tabs, honest missing-states, legal
boundaries, and the Overview wired to `/api/family/summary`. What it does NOT yet have are the data-capture
forms and the analysis ENGINES behind the strategic tabs. Ranked below. (UI architecture only — engines are
out of scope for the framework sprint; this is the backlog they unblock.)

## What exists today

- ✅ Standardized sidebar + 13 tabs (Members/Dependents/Goals/Estate/Beneficiaries/Guardianship/Trusted
  Advisors/Emergency Contacts/Documents/Recommendations/Reports/Settings).
- ✅ Overview mapped to the Core API family summary (protection coverage, dependents, guardianship status,
  estate flags, college plans) — real data, honest empty state.
- ✅ Legal-boundary language on Overview + Estate/Guardianship/Beneficiaries/Documents.
- ✅ Document upload routes to the canonical uploader (`/dashboard/documents?domain=family`).

## P0 — pilot-blocking (build before/early in pilot)

1. **Estate readiness engine** — compute an estate-readiness state from will/trust/POA/executor/beneficiary
   inputs. Today the Estate tab is an honest empty-state with no scoring (correct, but inert).
2. **Beneficiary engine** — detect accounts that lack beneficiaries (cross-refs finance accounts) and run a
   beneficiary audit. Today Beneficiaries is a static missing-state; the "accounts needing beneficiaries"
   list needs the finance ↔ family join.
3. **Per-tab data-entry forms** — Members/Dependents/Emergency Contacts currently route to the document
   uploader or profile; they need real add/edit forms to capture spouse/children/dependents/contacts.
4. **Guardian workflow** — detect children (dependents > 0) → prompt guardian + backup designation capture.
   Today Guardianship explains _why it matters_ but can't capture a selection.

## P1 — important (pilot-quality)

5. **Trust analysis** — parse/track trust documents + surface trust-vs-will guidance (with the attorney note).
6. **Insurance integration** — pull life/disability coverage into the protection-gap analysis (some exists
   via the summary's `protection`; deepen it).
7. **Attorney / trusted-advisor integration** — a real directory + invite/share flow (today: "none added yet").
8. **Family reports generation** — wire the Reports tab to actual generated reports (Family Protection /
   Estate Readiness / Beneficiary Audit / Guardian Planning / Legacy) with honest missing-states until inputs exist.
9. **Family-specific recommendations** — surface review-life-insurance / update-beneficiaries / create-will
   / guardian-planning from the recommendation engine, scoped to family (not generic/finance recs).

## P2 — polish / future

10. **Document processing for family doc types** — extract structured fields from Will/Trust/POA/Beneficiary
    forms (the 26-type taxonomy already exists; add the family types end-to-end).
11. **Legacy planning** — long-horizon legacy/inheritance modeling + the Legacy Planning Report.
12. **Per-tab Source/Confidence cards** — exercise the has-data path (today mostly empty-state) once forms land.
13. **Refactor remaining bespoke pages** (`/dashboard/family-office`) onto the framework primitives.

## Foundation value

Because Family now shares the one architecture, each engine above only needs to (a) populate the
`/api/family/summary` (or a per-tab endpoint) and (b) feed a `CoverageModel` — no new UI architecture. The
same is true for the future Legal/Insurance/Estate/Business/Military domains: a `DomainConfig` + data.
