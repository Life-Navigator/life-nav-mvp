# FAMILY CRUD IMPLEMENTATION (P0) — 2026-06-10

Family was read-only (no entry endpoints) — the weakest domain. This establishes the Family CRUD vertical:
**Dependents** now supports real add/list/delete, persisted, RLS-isolated. Live on prod `ac0ced8`. The pattern
is proven for the remaining family entities.

## Key enabler (verified, not assumed)

The `family` schema tables already exist (migration 131, RLS by `user_id`): `dependents`, `family_profiles`,
`spouse_profiles`, `guardianship_plans`, `estate_plans`, `insurance_profiles`, `college_planning`. **No
migrations needed.** And the `family` schema is reachable via PostgREST with the user JWT — verified live:

- service-role `GET family.dependents` → 200 (schema exposed)
- **user-JWT `GET dependents` → 200; user-JWT `POST dependents` → 201** (RLS + grants allow authenticated)

## What was built (Dependents)

- `lib/services/familyService.ts` — `listDependents/createDependent/deleteDependent` via
  `supabase.schema('family').from('dependents')` (mirrors `educationService`).
- `app/api/family/dependents/route.ts` (GET + POST) + `app/api/family/dependents/[id]/route.ts` (DELETE) —
  auth via `createServerSupabaseClient` + `getUser()`, `safeApiError` wrapper.
- `components/domain/family/FamilyDependents.tsx` — real Add form (relationship + birth year) + list + Remove.
- `app/dashboard/family/dependents/page.tsx` → renders it (was `FamilyTabEmpty`).

## Validation (prod, end-to-end via the real routes)

1. `GET /api/family/dependents` → `[]`
2. `POST` {child, 2019} → **201**, returns row (id, relationship, birth_year)
3. `GET` → **count 1** (persisted across request)
4. `DELETE /api/family/dependents/{id}` → **200**
5. `GET` → **count 0** (delete persisted)
6. `/dashboard/family/dependents` → Add form + Relationship field + sidebar render, **0 errors**.

## Remaining family entities (same pattern — next builds)

Each = a `familyService` fn + a `/api/family/<entity>` route(+`[id]`) + a tab component, copied from Dependents:

- **Beneficiaries** — needs a `family.beneficiaries` table? (NOT in migration 131's list — **verify/add table**; estate_plans only has a `has_beneficiaries` flag). P0.
- **Members / Spouse** — `family.spouse_profiles` exists (singleton); "members" may map to spouse + dependents.
- **Emergency Contacts** — **no table yet** — needs a `family.emergency_contacts` table (migration). P1.
- **Trusted Advisors** — **no table yet** — needs a table (migration). P2.
- **Estate / Guardianship** — `estate_plans` + `guardianship_plans` tables exist → editable forms (flags + designated_guardian). P1.

Honest note: Dependents + Estate + Guardianship + Spouse have tables → pure routes+forms. Beneficiaries,
Emergency Contacts, Trusted Advisors need a small migration first (tables don't exist yet).

## Definition of Done — status

✅ Dependents: full create/edit(add/remove)/persist — no shell. ✅ Schema reachability proven. ✅ Pattern
established + documented for the rest. ◻ Remaining entities (some need tables) — next builds.
