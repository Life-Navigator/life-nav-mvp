# Documents / Certifications / Calendar Sweep — Agent 5

Date: 2026-06-11
Area: Certifications, Document upload, Calendar
Owner files touched (working tree only — no git ops run):

- `apps/web/src/lib/services/educationService.ts` (extended for certs/courses — allowed)
- `apps/web/src/app/api/education/certifications/route.ts`
- `apps/web/src/app/dashboard/education/certifications/page.tsx`
- `supabase/migrations/20260611030000_fix_course_sync_topic.sql` (new corrective migration)

## Surfaces

| Name            | Route (UI)                          | Endpoint                                                                  | Table                      | Submit                              | Refresh                       | RLS-iso                           | Errors                 | Status                    |
| --------------- | ----------------------------------- | ------------------------------------------------------------------------- | -------------------------- | ----------------------------------- | ----------------------------- | --------------------------------- | ---------------------- | ------------------------- |
| Certifications  | /dashboard/education/certifications | POST/GET /api/education/certifications                                    | public.courses             | Mapper fixed; blocked by DB trigger | GET-on-mount (reader fixed)   | Yes (policy `auth.uid()=user_id`) | Surfaces server reason | BLOCKED (DB trigger)      |
| Courses         | /dashboard/education (course add)   | POST/GET /api/education/courses                                           | public.courses             | Mapper fixed; same trigger block    | GET-on-mount                  | Yes                               | safeApiError           | BLOCKED (same DB trigger) |
| Document upload | /dashboard/documents                | POST/GET /api/documents → Core API /v1/documents/upload                   | Core API (Fly) `documents` | PASS (200, doc stored, 5 fields)    | GET readiness reflects +1 doc | Per-JWT (Core API)                | Proxy forwards JWT     | PASS                      |
| Calendar        | /dashboard/calendar                 | /api/calendar/sources, /api/calendar/events, /api/integrations/oauth/init | (none)                     | No API routes exist                 | n/a                           | n/a                               | Blanket console errors | NOT_READY                 |

## Root causes & fixes

### 1. Certifications / Courses write path — TWO bugs (one app, one DB)

**App-layer bug (FIXED):** `public.courses` (migration 033) real columns are
`course_name` (NOT NULL), `provider`, `certificate_url`, `status`, `completion_date`,
`skills_learned`, `start_date`, `level`, `duration_hours`, `cost`, `notes`, `rating`,
`progress_percent`, `instructor`, `url`. The certifications POST route sent friendly names
that are NOT columns: `title`, `platform`, `completed_at`. There was no whitelist —
`createCourse` did `{ ...course, user_id }`, so a stray key (or the missing NOT-NULL
`course_name`) produced PGRST204 / 42703 "Failed to save". The reader
(`listCertifications` ordering by nonexistent `completed_at`, `mapCourseToCertification`
reading `course.title`/`course.completed_at`, stats reading `completed_at`) was also wrong.

Fix: added `toCourseRow()` to `educationService.ts` — alias map
(`title|name → course_name`, `certificateUrl → certificate_url`,
`certificateDate|completed_at|completedAt → completion_date`, `skills → skills_learned`),
column WHITELIST (drops `platform`, `credentialId`, etc.), `'' → null`, numeric coercion via
`Number()`, and strips client `user_id`/`id`. `createCourse`/`updateCourse` now route through
it and require `course_name`. Reader/stats now read the real columns
(`course_name`, `completion_date`). The certifications route now sends friendly names (the
mapper aliases) and returns an explicit 400 `{error, code:'missing_title'}` when title is empty.
The form surfaces `body.error` instead of a blanket "Failed to add certification".

**DB-layer bug (FIXED in a migration; NOT yet applied to prod — see Remaining):**
`graphrag.trigger_course_sync()` (migration 055, and again in the 075 "fix") references
`NEW.topic`, but `public.courses` has no `topic` column (that field lives on
`public.study_logs`). Therefore EVERY insert/update/delete on `public.courses` fails with:

```
ERROR 42703 record "new" has no field "topic"
```

This blocks BOTH Add-Course and Add-Certification regardless of payload shape. New migration
`supabase/migrations/20260611030000_fix_course_sync_topic.sql` recreates the function without
`NEW.topic` (keeps `course_name`, `provider`, `level`, `status`, `duration_hours`).

### 2. Document upload — works (no code change needed)

`/api/documents` is a thin proxy that forwards the Supabase JWT and streams multipart to
Core API `/v1/documents/upload`. Verified working end-to-end against prod Core API.
Minor gap (not fixed, out of the save-path scope): the UI "Other / Not listed" option posts
`doc_type:'other'`, which Core API rejects (`unknown doc_type`). Known catalog types (e.g.
`offer_letter`, `401k_statement`) work. Recommend hiding `other` or mapping it server-side.

### 3. Calendar — non-functional surface (NOT_READY, honest)

`/dashboard/calendar` fetches `/api/calendar/sources` and `/api/calendar/events`, and
"Connect Calendar" redirects to `/api/integrations/oauth/init`. NONE of these routes exist in
the app (`apps/web/src/app/api/calendar/*` is absent; only per-provider OAuth routes exist, not
`/init`). So sources/events always 404, the page shows "Unable to load calendar" / "No Calendars
Connected", and Create Event is permanently disabled (`calendarSources.length === 0`). This is a
missing-backend feature, not a save-path mapping bug. Left as NOT_READY rather than scaffolding a
calendar persistence layer + OAuth init out of scope for this sweep.

## Validation evidence (actual HTTP statuses, prod DB & Core API)

### Certifications DB-layer (2 users, PostgREST under user session)

- Admin-create userA/userB: 200/200
- INSERT into `public.courses` as userA with the EXACT row `toCourseRow()` produces
  (`course_name, provider, certificate_url, status, completion_date, skills_learned, user_id`):
  **400 — `42703 record "new" has no field "topic"`** (the trigger bug; not the mapper)
- Service-role INSERT of a perfectly-shaped row (all real columns): **400 — same `topic` 42703**
  → proves the ONLY remaining blocker is the DB trigger, and that the mapper's column set is correct.
- (RLS WITH CHECK confirmed working: an insert omitting `user_id` returned 403
  `42501 violates row-level security policy`, i.e. the policy is enforced.)
- Cleanup: users deleted 200/200.

End-to-end PASS for certifications is impossible until migration `20260611030000` is applied to
prod. The application layer is correct and ready.

### Document upload (prod Core API https://lifenavigator-core-api.fly.dev)

- Mint user + signIn: ok
- GET /v1/documents (baseline): **200**, `documents_on_file:0`
- GET /v1/documents/catalog: **200** (doc_types keyed object; `other` not a valid key)
- POST /v1/documents/upload (doc_type=`offer_letter`, small text file): **200** —
  `document_id` returned, `fields_extracted:5`, `confidence:0.85`, `status:"extracted"`,
  processing steps Uploaded/Classified/OCR/Evidence all `done:true`
- GET /v1/documents (after): **200**, `documents_on_file:1` (the user's own doc)
- Earlier POST with doc_type=`other`: **400 `unknown doc_type`** (UI gap noted above)
- Cleanup: user deleted.

## Remaining risks

1. **PROD MIGRATION NOT APPLIED.** `20260611030000_fix_course_sync_topic.sql` must be applied to
   prod before certifications/courses saves work. I could not apply it: my creds
   (`/tmp/sweep_creds.txt`) are URL+ANON+SERVICE_ROLE only — no DB password, and no SQL-exec RPC
   is exposed (probed `exec_sql`/`exec`/`query`/… all 404). Orchestrator/CI must run the migration.
2. **Document UI `other` doc_type** is rejected by Core API; either drop the option or have the
   route map `other`→a permitted fallback.
3. **Calendar has no persistence/OAuth backend.** Building it is a separate feature, not a
   save-path fix.
4. Pre-existing tsc errors (4) are in files owned by other agents (finance investments page,
   auth verify-email type) — untouched.
