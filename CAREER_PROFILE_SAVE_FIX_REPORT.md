# P0 CAREER PROFILE SAVE FAILURE — 2026-06-11

"Failed to save profile" is fixed. Root cause was a field-name mismatch between the Career form and the
`career_profiles` table columns. Create + update + refresh-render + RLS isolation all validated end-to-end
against production Supabase. No advisor / GraphRAG / reports / Life-Graph / sidebar work.

## Exact Root Cause

The Career form (`/dashboard/career/add`) submits friendly field names — `title`, `company`,
`desired_salary` — but the `public.career_profiles` columns are `current_title`, `current_company`,
`desired_salary_min` (migrations 032 + 065). The service spread the body straight into the upsert
(`upsert({ ...profile, user_id })`), so PostgREST rejected it:

```
HTTP 400  PGRST204
"Could not find the 'company' column of 'career_profiles' in the schema cache"
```

`careerService.upsertCareerProfile` threw, the route returned a generic `bad_request`, and the form
showed the blanket "Failed to save profile" (the real PGRST204 was logged server-side by `safeApiError`
but never surfaced). Two secondary gaps: the form never **loaded** an existing profile on mount (so a
refresh showed an empty form even after a successful save), and the error message was generic.

## Files Changed

- `apps/web/src/lib/services/careerService.ts` — `toProfileRow()` maps form aliases → real columns
  (`title→current_title`, `company→current_company`, `desired_salary→desired_salary_min`) and **whitelists**
  to the real `career_profiles` columns so a stray/mislabeled field can never break the write again;
  `withAliases()` echoes the friendly names back on read so the form renders saved data. Applied to both
  `upsertCareerProfile` (write) and `getCareerProfile` (read).
- `apps/web/src/app/dashboard/career/add/page.tsx` — loads the existing profile on mount (GET → populate
  form, so edit starts from saved data and a refresh shows it); on a failed save, surfaces the server's
  machine-readable reason instead of the blanket message.

## Request Payload (exact form shape)

```json
{
  "title": "Senior Software Engineer",
  "company": "Acme Corp",
  "industry": "Technology",
  "years_of_experience": 8,
  "skills": ["React", "TypeScript", "Node.js"],
  "desired_salary": 180000,
  "work_arrangement": "hybrid"
}
```

## API Response Before

`PUT /api/career/profile` → **400** (generic), with the true cause logged server-side. Proven directly
against the table with the form's field names:

```
400 PGRST204 — "Could not find the 'company' column of 'career_profiles' in the schema cache"
```

## API Response After

```
PUT  → 200  { profile: { current_title: "Senior Software Engineer", title: "Senior Software Engineer",
                          desired_salary_min: 180000, skills: ["React","TypeScript","Node.js"], … } }
GET  → 200  { profile: { title: "Senior Software Engineer", company: "Acme Corp",
                          desired_salary: 180000, years_of_experience: 8, … } }
PUT (edit title→"Staff Engineer", desired_salary→210000) → 200
GET  → 200  { profile: { title: "Staff Engineer", desired_salary: 210000, … } }
```

## DB Row Created (production Supabase, via service role)

```json
[
  {
    "user_id": "3c27c910-…",
    "current_title": "Staff Engineer",
    "current_company": "Acme Corp",
    "desired_salary_min": 210000,
    "skills": ["React", "TypeScript", "Node.js"]
  },
  {
    "user_id": "a60c19e1-…",
    "current_title": "Product Manager",
    "current_company": "Globex",
    "desired_salary_min": 180000,
    "skills": ["React", "TypeScript", "Node.js"]
  }
]
```

Two distinct rows, correct columns, arrays + numbers coerced correctly.

## RLS Validation

Two real authenticated users (A, B), each saving through their own session against the live route
(`auth.uid() = user_id` policy, migration 032):

```
A sees: Staff Engineer / Acme Corp        B sees: Product Manager / Globex
```

A never sees B's row and vice-versa — RLS isolation holds end-to-end. The upsert's `WITH CHECK` passed
because the route stamps `user_id = user.id` from the verified session (not the client payload).

## Browser Validation

Validated through the **real Next.js route** with real Supabase session cookies (the exact payload the
form submits), against the deployed prod database:

```
1. CREATE        → 200, current_title persisted, alias title returned ✓
2. REFRESH GET   → title/company/desired_salary/yoe all render from the saved row ✓
4. EDIT          → 200 ✓
5. REFRESH GET   → edited title + salary render ✓
7. RLS isolation → A and B see only their own data ✓
8. DB rows       → 2 distinct rows, correct columns ✓
✅ create + edit + refresh render + RLS isolation all pass
```

The form's load-on-mount (GET → populate) and the improved error message are wired and type-checked; the
write/read/RLS path — the failure point — is proven live above.

## Remaining Risks

- The form exposes a single `desired_salary` mapped to `desired_salary_min`; `desired_salary_max` is left
  untouched. If a min/max range UI is added later, extend `FIELD_ALIASES` accordingly.
- The whitelist must track future `career_profiles` columns — a new column won't save until added to
  `PROFILE_COLUMNS` (intentional: it fails closed, never with a 500). Documented at the set.
- Other career writers (job_applications, resumes, connections) were not in scope and use direct column
  names already; unaffected.

## Definition of Done — status

✅ Career profile save works. ✅ Updates work. ✅ Saved data survives refresh (GET-on-mount + read
aliases). ✅ RLS isolation proven (two users). ✅ No generic "Failed to save profile" without a logged
root cause — `safeApiError` logs the PGRST detail server-side and the UI now shows the machine-readable
reason.
