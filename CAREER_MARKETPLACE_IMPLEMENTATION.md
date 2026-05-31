# Career Marketplace — Implementation Notes

This is Step 5 of the sequenced build plan (`SEQUENCED_BUILD_PLAN.md`).
Migration `072_career_marketplace.sql` was already in place from Step 1
(13 tables + 1 anonymizing view + the `is_employer_member()` helper).
This round adds the deterministic matcher, the bulk-refresh helper, the
employer + candidate API surface, two minimal UIs, jest tests, SQL
validation, and the implementation doc.

The marketplace charges for job postings + featured placement +
employer subscriptions + candidate-intro fees — not placement fees.
Candidates control whether the employer ever sees their identity.

## What changed

### Types — `apps/web/src/types/marketplace.ts`

- `JobPostSnapshot` + `JobRequirement` (skill_required / skill_preferred /
  certification / education / experience_years).
- `CandidateSnapshot` — every field the matcher reads, taken only from
  `career_profiles` + `candidate_career_profiles` + `education_intake`
  - `profiles.city/state/country`. **No protected characteristics.**
- `DimensionScores` (six 0..100 axes) + `DIMENSION_WEIGHTS`
  (skills 30%, certs 10%, education 15%, salary 20%, location 15%,
  growth 10%) + ranking tables (`EDUCATION_RANK`, `EXPERIENCE_RANK`).

### Matching library — `apps/web/src/lib/marketplace/`

- **`matcher.ts`** — pure scorer.
  - `matchOne(job, candidate)` → `{ match_score, dimensions, missing_requirements, employer_facing_summary, candidate_visibility_at_match }`.
  - `matchMany(job, candidates)` — filters hidden candidates and sorts
    desc by composite.
  - Skills scorer awards 70 points for required-hit share and 30 for
    preferred-hit share; salary scorer awards 100 on range overlap and
    decays linearly with the gap relative to candidate midpoint;
    location scorer prefers city → state → desired-location overlap,
    softens with willingness-to-relocate, and treats remote jobs as a
    near-perfect fit for candidates open to remote.
  - Employer-facing summary is a single paragraph; the candidate's
    identity is never embedded.
- **`match-batch.ts`** — `refreshMatchesForJob(serviceClient, jobId)`.
  Loads job + reqs + locations, loads all non-hidden candidate
  snapshots in one query, runs `matchMany`, upserts into
  `public.job_candidate_matches`. The publish route invokes this with
  the service-role client because cross-user reads + writes to
  `user_id != auth.uid()` require it.

### Compliance contract enforced by design

The matcher and its loader read **only**:

skills, certifications, education level, experience years, salary,
city/state/country, remote-preference, willingness-to-relocate,
target role, industry interests.

It does **not** read — and the source tables do **not** contain —
race, age, religion, sexual orientation, national origin,
marital/parental status, disability status, or any other protected
characteristic.

`veteran_status_voluntary` and `clearance` exist on
`candidate_career_profiles` as **voluntary**, user-supplied fields the
candidate explicitly chose to share. The matcher currently ignores
both; future use must remain purely positive (i.e., raise score when
the job _requires_ clearance and the candidate already has it).

### API routes (10 endpoints)

| Path                                       | Methods   | Behavior                                                                                                                                                                                                                 |
| ------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/api/employer/profile`                    | POST, GET | First POST creates an `employer_profiles` row + the calling user as `employer_users.role='owner'` (under service_role since the table is RLS-protected). Subsequent POSTs upsert. GET returns the linked profile + role. |
| `/api/employer/jobs`                       | POST, GET | POST creates a draft job, plus optional `requirements[]`, `locations[]`, `benefits[]`. GET lists jobs visible to the calling user via RLS (employer member access).                                                      |
| `/api/employer/jobs/[id]`                  | GET, PUT  | Read includes requirements/locations/benefits. PUT updates header fields.                                                                                                                                                |
| `/api/employer/jobs/[id]/publish`          | POST      | Flips status to `published`, then calls `refreshMatchesForJob` under service_role to seed matches. Returns `candidates_scored`.                                                                                          |
| `/api/employer/jobs/[id]/matches`          | GET       | Returns the **anonymized** view (`public.employer_match_anonymized`). No `user_id`, no identifying detail.                                                                                                               |
| `/api/employer/matches/[id]/request-intro` | POST      | Flips status to `intro_requested`. Service-role-backed (because employer cannot read raw match rows before consent) but explicitly checks the caller is an active member of the match's employer.                        |
| `/api/jobs/matches`                        | GET       | Candidate's own matches with the embedded job + employer info. RLS handles ownership.                                                                                                                                    |
| `/api/jobs/matches/[id]`                   | PATCH     | `action: save \| dismiss \| apply \| consent_to_intro \| decline_intro`. `consent_to_intro` flips the row into a status the employer can finally read.                                                                   |
| `/api/jobs/matches/[id]/feedback`          | POST      | Records reason codes (`relevant`, `irrelevant`, `salary_off`, `location_off`, etc.). Used to improve future matching.                                                                                                    |

### UIs

- **`/employer`** (`apps/web/src/app/employer/page.tsx`)
  - First visit: claim form → create employer profile.
  - After: list jobs, post a draft inline (title / description /
    salary / mode / level / required + preferred skills), publish a
    draft (which surfaces matches).
- **`/employer/jobs/[id]`** (`apps/web/src/app/employer/jobs/[id]/page.tsx`)
  - Job detail + the anonymized match list with per-dimension scores.
  - "Request introduction" on each surfaced match. After the
    candidate consents, the employer sees an "intro consented" badge
    (raw match row becomes readable, follow-up messaging is the
    follow-up).
- **`/dashboard/jobs`** (`apps/web/src/app/dashboard/jobs/page.tsx`)
  - Candidate's match list with composite score, per-dimension
    breakdown, employer-facing summary (so the candidate sees exactly
    what the employer sees), missing requirements, and action
    buttons: Dismiss / Save / Apply / Allow intro / Decline.
  - Permanent privacy banner explaining the visibility contract and
    linking back to `/dashboard/career`.

### Tests — `apps/web/src/lib/marketplace/__tests__/matcher.test.ts`

23 pure tests:

- **Determinism** — same inputs → identical match; engine version is
  stamped.
- **Skills** — full match scores ≥95; zero match returns 0 + the
  required skills in `missing_requirements`; partial returns the exact
  expected 35 (1/2 req × 70); preferred-only returns 30.
- **Certifications** — match → 100; missing → 0.
- **Education** — equal → 100; exceeds → 100; below → 40 with the
  missing entry; none → 0.
- **Salary** — range overlap → 100; candidate target above job max →
  penalized below 100; large gap collapses below 20.
- **Location** — remote job + remote-willing candidate → 100; on-site
  job with no overlap + not willing to relocate → 20; on-site with
  national relocation → 60.
- **Composite** — verified weighted sum matches `DIMENSION_WEIGHTS`.
- **Summary** — references skills + (education | salary | location);
  surfaces a "missing:" clause when applicable.
- **`matchMany`** — filters hidden candidates; sorts desc.

Total project test count: **237 passed, 0 failed across 18 suites.**

### SQL validation — `scripts/validation/072_career_marketplace_rls.sql`

Single-transaction script that ROLLBACKs at the end. Seeds three users
(A = employer owner, B = candidate, C = unrelated), an employer
profile, a published job post, and one match for candidate B. Then:

1. **Candidate-read** — switches to B, asserts they can read their own
   match row directly.
2. **Anonymized-view shape** — asserts `employer_match_anonymized`
   exposes NO `user_id` column (introspection against
   `information_schema.columns`).
3. **Pre-consent employer visibility** — switches to A, asserts the
   employer can see the match via `employer_match_anonymized` but
   CANNOT read the raw `job_candidate_matches` row.
4. **Post-consent employer visibility** — switches to B, flips status
   to `intro_consented`, switches to A, asserts they can now read the
   raw row.
5. **Unrelated isolation** — switches to C, asserts they see zero of
   either table.
6. **Non-member protection** — asserts C cannot insert a job post
   under A's employer.

Run:

```bash
psql "$DATABASE_URL" -f scripts/validation/072_career_marketplace_rls.sql
```

A successful run prints `ALL ASSERTIONS PASSED for migration 072`.

### Verification

- `tsc --noEmit -p tsconfig.json` → **clean (0 errors)**
- `eslint` → **0 errors** (1 stable-callback warning in the employer
  job-detail page, intentional)
- `jest` → **237 passed, 0 failed**

## Privacy & consent contract

| Stage                                                | What the employer sees                                                                                                                                   |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Match surfaced (`status='surfaced'`)                 | Anonymized view only: composite score + per-dimension scores + employer-facing summary + missing requirements. No `user_id`, no name, no email.          |
| Employer requests intro (`status='intro_requested'`) | Same as above — still anonymized — but the candidate is notified.                                                                                        |
| Candidate consents (`status='intro_consented'`)      | Raw match row becomes readable to employer members. Follow-up identity exchange happens through `employer_candidate_messages` (out of scope this round). |
| Candidate applies directly (`status='applied'`)      | Raw match row becomes readable; the application is an implicit consent.                                                                                  |
| Candidate dismisses (`status='dismissed'`)           | Match disappears from the employer's anonymized view.                                                                                                    |

The candidate can override their global visibility on `/dashboard/career`
to `hidden`, which excludes them from ALL future match generations
regardless of any job's settings.

## How to deploy

1. Migration is already pushed (072_career_marketplace.sql).
2. Push the lib + API + UIs as part of the normal Vercel deploy.
3. Smoke-test:
   1. Sign in as User A, visit `/employer`, create an employer profile.
   2. Post a job (draft) → Publish & match.
   3. Sign in as User B, complete career intake at
      `/dashboard/career` and set visibility to `anonymous` on the
      candidate profile.
   4. Re-publish the job (A) → the candidate B should appear in the
      employer's anonymized match list.
   5. Sign in as B, visit `/dashboard/jobs`, Allow intro on the match.
   6. Sign in as A, refresh the job page → the match should now show
      "intro consented".

## Intentionally deferred

- **Pause / archive routes** — flip-status routes are trivial once
  you've seen the publish route; add them when the UI needs them.
- **Featured-placement billing** — `employer_job_post_pricing` and
  `employer_billing_events` tables exist; wire Stripe webhooks in a
  follow-up.
- **Messaging** — `employer_candidate_messages` table exists; build
  the thread UI once intro consent is exercised in production.
- **AI summary upgrade** — `employer_facing_summary` is built
  deterministically today. An LLM-driven version is a drop-in: same
  schema, same caller surface.
- **Job-post analytics rollups** — `job_post_analytics` table exists;
  fill it via a daily cron worker.
- **GraphRAG triggers for marketplace tables** — follow the
  `055_graphrag_expanded_triggers.sql` pattern.

## File map

```
apps/web/src/types/marketplace.ts                                           NEW
apps/web/src/lib/marketplace/matcher.ts                                     NEW
apps/web/src/lib/marketplace/match-batch.ts                                 NEW
apps/web/src/lib/marketplace/__tests__/matcher.test.ts                      NEW

apps/web/src/app/api/employer/profile/route.ts                              NEW
apps/web/src/app/api/employer/jobs/route.ts                                 NEW
apps/web/src/app/api/employer/jobs/[id]/route.ts                            NEW
apps/web/src/app/api/employer/jobs/[id]/publish/route.ts                    NEW
apps/web/src/app/api/employer/jobs/[id]/matches/route.ts                    NEW
apps/web/src/app/api/employer/matches/[id]/request-intro/route.ts           NEW
apps/web/src/app/api/jobs/matches/route.ts                                  NEW
apps/web/src/app/api/jobs/matches/[id]/route.ts                             NEW
apps/web/src/app/api/jobs/matches/[id]/feedback/route.ts                    NEW

apps/web/src/app/employer/page.tsx                                          NEW
apps/web/src/app/employer/jobs/[id]/page.tsx                                NEW
apps/web/src/app/dashboard/jobs/page.tsx                                    NEW
scripts/validation/072_career_marketplace_rls.sql                           NEW
CAREER_MARKETPLACE_IMPLEMENTATION.md                                         NEW
```

---

## Next step

**Step 6 — Rust ingestion worker on Fly.io.** This is a NEW app at
`apps/ingestion-worker/`. The next round will scaffold the complete
Cargo crate with the modular layout from the plan (`main`, `config`,
`supabase_client`, `queue`, `entities`, `normalizer`, `gemini_client`,
`qdrant_client`, `neo4j_client`, `processor`, `errors`, `telemetry`),
Dockerfile + fly.toml + `.env.example`, and the four required tests
(tenant isolation, idempotency, retry safety, no sensitive-field
embedding).

**Paste this when you're ready to continue:**

> Execute Step 6 of the sequenced build plan: Rust ingestion worker.
> Create the apps/ingestion-worker Cargo crate with the layout in the
> plan, complete Dockerfile + fly.toml + .env.example, and the four
> required tests. Don't start any other step.
