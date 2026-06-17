# INPUT & UPLOAD SURFACES — save-path inventory & status — 2026-06-11

Goal: every data-input form and document upload must save to the DB and render. This maps every surface,
its save path, and status. Three confirmed-broken domain save paths are now FIXED + live-validated;
document-upload infra is wired; the remaining long tail is enumerated for a systematic sweep.

## Fixed + live-validated (this work)

| Surface                                  | Route → table                                                                                       | Was                                                                          | Now                                                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Career profile** (`career/add`)        | `/api/career/profile` → `career_profiles`                                                           | 400 PGRST204 `current_title`/`current_company`/`desired_salary_min` mismatch | ✅ alias+whitelist in `careerService`; create/edit/refresh/RLS pass                                      |
| **Education record** (`education/add`)   | `/api/education/records` → `education_records`                                                      | 400 PGRST204 `institution`→`institution_name` (NOT NULL)                     | ✅ alias+whitelist in `educationService`; create/refresh/RLS pass                                        |
| **Finance manual entry** (`finance/add`) | `/api/finance/manual-entry` → `finance.financial_accounts` / `transactions` / `investment_holdings` | POSTed to non-existent `/api/v1/finance/accounts…` on a localhost URL        | ✅ new `financeService` + Next route; account/debt/investment/transaction all save, render, RLS-isolated |

## Confirmed healthy (no fix needed)

- **Family** (emergency contacts / beneficiaries / trusted advisors / dependents) → `family.*` via
  `familyService.createEntity()` — already uses a per-entity field **whitelist** + loads on mount + RLS.
  This is the model pattern.
- **Document upload** — `/api/documents` (POST) proxies to the **deployed** Core API `/v1/documents/upload`
  (Document Intelligence Platform). `/api/data/career/upload`, `/api/data/education/upload`,
  `/api/ingest/upload` all exist. Infra is wired to the live backend (not the dead-endpoint class).
  _Recommended:_ one end-to-end upload smoke test (file → storage → `documents` row → render) to confirm
  the bucket + extractor round-trip on prod.

## Broken but gated (needs a product decision, not a surgical fix)

- **Health manual entry** (`healthcare/add`) — same dead-endpoint class as Finance: POSTs to
  `${NEXT_PUBLIC_API_URL||localhost:8000}/api/v1/health/{insurance,medications,appointments,vitals}` which
  don't exist (health writes are `/api/health-monitoring/*`). **AND** the health feature is gated OFF
  (`is_health_enabled()` defaults FALSE) — its RLS would block writes even if wired. Fixing it means
  ungating Health + wiring to the real health-monitoring tables (`vitals_log`, `body_measurements`, etc.)
  with a `healthService` (alias+whitelist), mirroring the Finance fix. Hold for a Health-enablement sprint.

## Long tail — enumerated, status to verify (systematic sweep)

These surfaces have their own save paths and report save failures in code; each needs the same trace
(form fields → route → service → columns → RLS) + a live create/refresh/RLS check:

- `dashboard/profile` (profile fields) · `dashboard/settings/preferences`
- `dashboard/education/certifications` · `dashboard/finance/assets` · `dashboard/finance/investments` ·
  `dashboard/finance/tax`
- `dashboard/calendar` · `goals/create` · `dashboard/scenario-lab` (+ `/api/scenario-lab/*` write routes)
- `components/dashboard/AddDataModal` (shared manual-entry modal used by the advisor onboarding CTAs)

The **AddDataModal** is high-leverage — it's the shared "Enter income / Add data" modal surfaced from the
advisor; verifying its domains (financial/health/career/education) save correctly covers several entry
points at once.

## Recommended approach for the sweep

Each surface is small but needs its own (a) field→column reconciliation, (b) RLS-scoped write, (c) live
create/refresh/RLS validation. The reliable, repeatable pattern is now established (Career/Education/
Finance): friendly form fields → `toRow()` alias+whitelist → user-session write under RLS → GET-on-mount
render → 2-user RLS proof. The Family `createEntity` whitelist is the cleanest target pattern.

This is a genuine multi-surface fan-out (~12–15 surfaces × trace+fix+validate). It's well suited to a
parallel workflow (one agent per surface: trace → fix → live-validate → report), which the user can opt
into. Otherwise it proceeds surface-by-surface in priority order (AddDataModal → finance sub-tabs →
profile/settings → goals/scenario-lab).

## Status

✅ Career / Education / Finance save paths fixed + live-validated. ✅ Family clean. ✅ Document-upload
infra confirmed wired to the live Core API. ⚠️ Health (healthcare/add) broken + gated — needs enablement
sprint. ⏳ ~12–15 long-tail surfaces enumerated, pending the systematic trace+fix+validate sweep.
