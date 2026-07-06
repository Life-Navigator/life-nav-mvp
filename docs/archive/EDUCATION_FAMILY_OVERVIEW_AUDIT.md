# Education + Family Overview — read-path / save-path audit — 2026-06-12

Proactive audit only (no blind edits). Goal: confirm every field the overview renders is read from the
same schema.table.column where the app's save form writes. **Result: no read/save mismatches** beyond the
`career_profiles` cross-schema bug already fixed (`e3dbb63`). Validated live against Core API v77.

## Method

Traced each overview field: UI → frontend save route → API/backend → save `schema.table.column` vs the
overview read function → read `schema.table.column`. Verified real schemas in `supabase/migrations`. Then
seeded a real record per domain, called the deployed summary, and confirmed the saved value renders +
RLS isolates.

## Education overview

The education overview (`/dashboard/education`) renders via the shared `DomainOverview` (coverage/counts)
and reads from the **frontend** routes — it does not call the Core API summary for its counts. The Core
API `/v1/education/summary` powers the ROI/comparison context.

| UI field                                 | save route                           | save schema.table                                          | saved column                                                      | read fn                   | read schema.table                            | read column                | status                                                                                |
| ---------------------------------------- | ------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------- | -------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------- |
| Degrees / records (count)                | POST `/api/education/records`        | `public.education_records`                                 | institution_name, degree_type, field_of_study, gpa, dates, status | `listRecords()`           | `public.education_records`                   | \*                         | **MATCH**                                                                             |
| Certifications (count)                   | POST `/api/education/certifications` | `public.courses`                                           | course_name, certificate_url, completion_date, status             | `listCertifications()`    | `public.courses` (status=completed)          | \*                         | **MATCH** (save BLOCKED by the NEW.topic trigger — see matrix; not a schema mismatch) |
| Courses (count)                          | POST `/api/education/courses`        | `public.courses`                                           | course_name, provider, …                                          | `listCourses()`           | `public.courses`                             | \*                         | **MATCH** (same trigger blocker on save)                                              |
| Programs / schools / goals (ROI context) | n/a (Core-API analysis)              | `education.programs/schools/education_goals`               | —                                                                 | `education.py _context()` | `education.programs/schools/education_goals` | \*                         | **MATCH** (read schema = save schema = `education`)                                   |
| Career-income cross-read (ROI)           | career forms                         | `public.career_profiles`                                   | current_title, current_company, years_of_experience               | `education.py _context()` | `public.career_profiles` (schema="public")   | current_title (+ optional) | **MATCH** (fixed `e3dbb63`; was `career` schema)                                      |
| education_intake / education_credentials | onboarding routes                    | `public.education_intake` / `public.education_credentials` | …                                                                 | not read by the overview  | —                                            | —                          | not rendered (by design; not a mismatch)                                              |

## Family overview

The family overview (`/dashboard/family`) renders from `/api/family/summary` → Core API
`/v1/family/summary` → `family.py`. Per-entity CRUD pages render their own `GET /api/family/[entity]`.

| UI field                               | save route                            | save schema.table           | saved column                                     | read fn                                        | read schema.table                          | read column   | status                                               |
| -------------------------------------- | ------------------------------------- | --------------------------- | ------------------------------------------------ | ---------------------------------------------- | ------------------------------------------ | ------------- | ---------------------------------------------------- |
| Dependents (count)                     | POST `/api/family/dependents`         | `family.dependents`         | relationship, birth_year                         | `family.py _context()`                         | `family.dependents`                        | count         | **MATCH** (validated live: count=1)                  |
| Emergency contacts                     | POST `/api/family/emergency-contacts` | `family.emergency_contacts` | name, relationship, phone, email                 | CRUD list `GET /api/family/emergency-contacts` | `family.emergency_contacts`                | \*            | **MATCH** (not in summary; rendered on its own page) |
| Beneficiaries                          | POST `/api/family/beneficiaries`      | `family.beneficiaries`      | name, relationship, account_type, allocation_pct | CRUD list                                      | `family.beneficiaries`                     | \*            | **MATCH**                                            |
| Trusted advisors                       | POST `/api/family/trusted-advisors`   | `family.trusted_advisors`   | name, advisor_type, firm, email, phone           | CRUD list                                      | `family.trusted_advisors`                  | \*            | **MATCH**                                            |
| Life coverage / disability             | family insurance form                 | `family.insurance_profiles` | life_coverage, disability_coverage               | `family.py _context()`                         | `family.insurance_profiles`                | life_coverage | **MATCH**                                            |
| Estate (will/POA/beneficiaries/status) | family estate form                    | `family.estate_plans`       | has_will, has_poa, has_beneficiaries, status     | `family.py _context()`                         | `family.estate_plans`                      | same          | **MATCH**                                            |
| Guardianship status                    | family guardianship form              | `family.guardianship_plans` | status                                           | `family.py _context()`                         | `family.guardianship_plans`                | status        | **MATCH**                                            |
| College plans                          | family college form                   | `family.college_planning`   | target_year, projected_cost, saved_amount        | `family.py _context()`                         | `family.college_planning`                  | same          | **MATCH**                                            |
| Career-income cross-read               | career forms                          | `public.career_profiles`    | current_title, …                                 | `family.py _context()`                         | `public.career_profiles` (schema="public") | current_title | **MATCH** (fixed `e3dbb63`; was `career`)            |
| Total debt cross-read                  | finance forms                         | `finance.debts`             | balance                                          | `family.py _context()`                         | `finance.debts` (schema="finance")         | balance       | **MATCH**                                            |

## Live validation (Core API v77, 2 users)

```
seed (user A): dependent → 201 (family.dependents) · education_record → 201 (public.education_records)
GET /v1/family/summary   → 200 · readiness.dependents = 1   ✓ saved dependent renders
GET /v1/education/summary → 200 · context returns (no schema error; career cross-read reads public) ✓
RLS: user B /v1/family/summary → readiness.dependents = 0   ✓ isolated
```

## Informational (not a mismatch — no fix)

`public.career_profiles` exposes `current_title`, `current_company`, `years_of_experience`, but NOT
`current_income`, `seniority_level`, or `location` (those columns exist only on the `career`-schema copy /
migration 065). The career/education/family domains read those optional refinements via `dict.get()`, so
they return `None` and default gracefully (seniority→"mid", geo→"US"); income is derived from
`current_title` via the compensation engine, not a stored figure. **No save form writes those fields**, so
there is nothing the user saves that the overview fails to render — it is not the reported bug class. If a
direct-income input is added later, add `current_income` to `public.career_profiles` (or read the `career`
copy) at that time.

## Conclusion

- Every overview field that maps to a user save reads from the **same schema.table.column** as the save.
- The only real mismatch (the `career_profiles` cross-schema read) was already fixed and deployed
  (`e3dbb63`, Core API v77) and is re-verified here.
- **No new fixes required.** Health untouched. No Tax/Calendar/Retirement/Account-Security work.
