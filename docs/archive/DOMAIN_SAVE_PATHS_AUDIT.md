# DOMAIN SAVE-PATH AUDIT — field-name / column mismatch class — 2026-06-11

After fixing the Career "Failed to save profile" bug (form field names ≠ DB columns), I swept the other
domain save paths for the same class. Two domains had the bug (Career — fixed; Education — fixed here);
Family is clean; Health is structurally exposed but feature-gated off; Finance has a **larger** problem
than a field mismatch and needs its own sprint.

## Summary

| Domain        | Verdict                       | Action                                                                                            |
| ------------- | ----------------------------- | ------------------------------------------------------------------------------------------------- |
| **Career**    | MISMATCH (fixed prior)        | `title→current_title`, `company→current_company`, `desired_salary→desired_salary_min` + whitelist |
| **Education** | **MISMATCH — FIXED HERE**     | `institution→institution_name` (NOT NULL) + whitelist + empty→null                                |
| **Family**    | CLEAN                         | none — already uses a field whitelist + load-on-mount                                             |
| **Health**    | No mismatch, but no whitelist | hardening recommended; feature gated OFF by default (not an active bug)                           |
| **Finance**   | BROKEN (worse than mismatch)  | dead POST endpoints + wrong backend URL + field mismatch — needs a dedicated fix                  |

## Education — FIXED (this commit)

**Root cause:** `/dashboard/education/add` submits `institution`, but `public.education_records` has
`institution_name TEXT NOT NULL` (migration 033). `createRecord` spread the body into the insert →
`400 PGRST204 "Could not find the 'institution' column"` → generic "Failed to save record".

**Fix** (`lib/services/educationService.ts`): `toRecordRow()` maps `institution→institution_name`,
whitelists to the real `education_records` columns, and coerces `'' → null` (so empty gpa/date casts
don't fail). Applied to `createRecord` + `updateRecord`. The form now surfaces the server's reason.

**Validated live (2 users):**

```
BEFORE: raw form-named insert → 400 PGRST204 "Could not find the 'institution' column"
1. CREATE → 201, institution_name="MIT", field_of_study + gpa persisted
2. LIST (refresh) → 1 record, institution_name="MIT"
3. RLS → A sees [MIT], B sees [Stanford]   (isolated)
✅ create + list-on-refresh + RLS isolation all pass
```

## Family — CLEAN (no action)

`familyService` writes via `createEntity()`, which iterates **only** over a per-entity field whitelist
(`FAMILY_ENTITIES[slug].fields`), so stray keys are dropped and form keys already match columns
(emergency_contacts / beneficiaries / trusted_advisors / dependents). `FamilyDependents` builds the row
explicitly. Both load existing data on mount. RLS `user_id = auth.uid()`. This is the safest pattern of
the five — it's the model the others should converge on.

## Health — LATENT (no active bug; recommend hardening)

No field-name mismatch: the onboarding/health-intake + manual-entry routes use keys that match the
`training_profile` / `body_measurements` / `daily_wellbeing` / `vitals_log` / `nutrition_profile`
columns (migration 063). **But** the routes spread the request body directly with **no column
whitelist**, so a future stray/renamed field would reproduce the PGRST204 class. Also: no edit/load-on-
mount, and `body_measurements`/`vitals_log` use `.insert()` (append-only, no upsert). Mitigating factor:
the health feature is **gated off** (`is_health_enabled()` defaults FALSE), so this is not live for
pilots. Recommended (separate, low-priority): add a `HEALTH_COLUMNS` whitelist per table like Career.

## Finance — BROKEN (needs a dedicated sprint, NOT a field-only fix)

`/dashboard/finance/add` is a **dead/legacy surface**, not a simple mismatch:

1. It POSTs to `${NEXT_PUBLIC_API_URL || http://localhost:8000}/api/v1/finance/accounts` and
   `/transactions` — but the Core API only exposes those as **GET**; the only finance POST routes are
   `/goals`, `/manual-asset`, `/manual-liability`. So every save hits a non-existent endpoint (404/405)
   or a localhost URL that isn't the prod backend.
2. Even if the endpoints existed, the field names mismatch: form `name`/`institution`/`balance` →
   columns `account_name`/`institution_name`/`current_balance` (migration 031), and the form omits
   required `transaction_type`.

This is out of scope for a surgical field-mapping fix and would be a half-measure to "alias and hope."
Recommendation: a dedicated Finance manual-entry sprint that either (a) wires the form to the real
`/manual-asset` / `/manual-liability` endpoints with correct field mapping, or (b) routes manual finance
entry through a new Next API route + `financeService` (alias + whitelist) writing to
`finance.financial_accounts` / `finance.transactions`. Note: per the beta design, financial account data
is sourced from the **Plaid sandbox persona** (manual account entry is "Coming Soon"), so this surface may
be intentionally inactive — confirm product intent before building.

## Files Changed (this commit)

- `apps/web/src/lib/services/educationService.ts` — `toRecordRow()` (alias + whitelist + empty→null) on
  `createRecord` + `updateRecord`.
- `apps/web/src/app/dashboard/education/add/page.tsx` — surface the server's machine-readable save reason.

## Definition of Done

✅ All four domains audited. ✅ Education mismatch fixed + validated live (create / refresh / RLS).
✅ Family confirmed clean. ✅ Health flagged (latent, gated off) with a concrete hardening recommendation.
✅ Finance flagged as a larger, separate issue (dead endpoints) rather than a misleading partial fix.
