# Profile / Settings Input Sweep — Agent 3

Scope: `app/dashboard/profile`, `app/dashboard/settings/*`, their API routes, and the settings
service. Goal: every data-entry surface must persist, reload (GET-on-mount), be RLS-isolated, and
surface real errors.

## Surfaces

| Surface                                      | Route (UI)                              | Endpoint                 | Table                                                              | Status                                                         |
| -------------------------------------------- | --------------------------------------- | ------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| Profile update                               | `/dashboard/profile`                    | `PUT /api/user/profile`  | `public.profiles` (display_name) + `auth.user_metadata` (extended) | PASS                                                           |
| Preferences                                  | `/dashboard/settings/preferences`       | `PUT /api/user/settings` | `public.profiles` (theme/locale) + `public.user_preferences`       | PASS                                                           |
| Notifications                                | `/dashboard/settings/notifications`     | `PUT /api/user/settings` | `public.user_preferences`                                          | PASS                                                           |
| Persona management                           | `/api/onboarding/active-persona` (read) | `GET` only               | `analytics_user_events`                                            | DEPRECATED (read-only; write path owned by Integrations/Plaid) |
| Account / Security (password)                | `/dashboard/settings/security`          | `PUT /api/user/password` | Supabase Auth (not an RLS table)                                   | PARTIAL (auth-layer, out of scope)                             |
| Security (sessions / login history / 2FA UI) | `/dashboard/settings/security`          | n/a / mock               | none                                                               | NOT_READY (mock UI, no persistence)                            |

## Root causes found

1. **Preferences silently dropped 5 of 7 fields.** `PUT /api/user/settings` only wrote `theme` and
   `locale` to `profiles`. `currency`, `notificationsEnabled`, `dashboardLayout`, `timeFormat`,
   `dateFormat` were accepted by the form and thrown away. The `public.user_preferences` table
   (which exists with `email_notifications`, `push_notifications`, `weekly_digest`,
   `dashboard_layout`, etc.) was **completely unused** by the app.
2. **Notifications page was 100% static.** Hard-coded `defaultChecked` toggles and a `Save
Preferences` button with **no onClick handler** — a fake-success surface (button did nothing).
3. **Blanket error messages.** The profile form threw `"Failed to update profile"` regardless of the
   server reason; the profile route returned `{ success: true }` (no shape) yet the form did
   `setProfile(updatedProfile)`, so the UI was repopulated with `{success:true}` and lost all fields
   until a manual refresh.
4. **No toRow/whitelist.** Both routes spread loosely; the profile route mapped a fixed subset by
   hand and dropped `address / zipCode / maritalStatus / dependents / yearsOfExperience /
retirementAge / dietaryPreferences` on GET (form fields existed but never round-tripped).

## Fixes

- **New service `src/lib/services/settingsService.ts`** (no other agent owns it) — mirrors the
  career/family alias+whitelist pattern:
  - `toProfilePrefsRow()` — friendly `theme`/`language`(→`locale`)/`timezone`/`colorScheme` →
    whitelisted `public.profiles` columns, with a theme enum guard and `''`→drop coercion.
  - `toUserPreferencesRow()` — friendly notification/dashboard names → whitelisted
    `public.user_preferences` columns; unknown keys dropped, booleans coerced, and
    currency/timeFormat/dateFormat/layout folded into the existing `dashboard_layout` JSONB so the
    page round-trips without new columns. `user_id` is always stamped (caller passes the verified
    session id).
  - `upsertUserPreferences()` (upsert `onConflict: user_id`), `getUserPreferences()`,
    `preferencesToApiShape()` for GET-on-mount.
- **`PUT /api/user/settings`** now persists to BOTH `profiles` (display prefs) and `user_preferences`
  (notifications + dashboard), returns the freshly persisted friendly shape, and uses
  `safeApiError({ code:'db_persistence_error', context:{route,table} })` so failures carry
  route+table+supabase code server-side without leaking internals. `GET` now reads `user_preferences`
  and returns the real persisted values instead of hard-coded defaults.
- **`PUT /api/user/profile`** now uses a `toMetadata()` whitelist mapper (`''`→`undefined`,
  numbers via `Number()`), returns the full persisted profile shape (so the form repopulates
  correctly), surfaces explicit `safeApiError` codes for both the `profiles` write and the metadata
  write, and `GET` now returns all form fields (added the previously-dropped address/zipCode/
  maritalStatus/dependents/yearsOfExperience/retirementAge/dietaryPreferences).
- **Profile form** (`profile/page.tsx`) — error path now reads `err.message`/`err.error` and shows
  the standard `"We couldn't save this yet…"` (or the server reason) instead of a blanket failure.
- **Preferences page** — adopts the server's returned shape on success (true round-trip) and surfaces
  the real server reason on failure.
- **Notifications page** — rewritten as a functional client component: GET-on-mount from
  `/api/user/settings`, real controlled toggles, a working Save that persists to `user_preferences`
  and surfaces explicit errors.

## Validation evidence (DB layer, 2 users)

Validated at the DB layer (no `next dev`). Created userA + userB via admin API, signed both in,
issued the EXACT rows the mappers produce via PostgREST under each user session.

```
createUserA true createUserB true ; signin OK A/B
A PATCH profiles            -> 200  (theme=dark, locale=es-US persisted)
A GET own profile           -> 200  [{"theme":"dark","locale":"es-US"}]
B GET A profile (expect []) -> 200  []                              <- RLS isolated
A UPSERT user_preferences   -> 200  (email_notifications=false, dashboard_layout JSON persisted)
A GET own prefs             -> 200  [{"email_notifications":false,"dashboard_layout":{"layout":"compact","currency":"EUR","dateFormat":"YYYY-MM-DD","timeFormat":"24h"}}]
B GET A prefs (expect [])   -> 200  []                              <- RLS isolated
B INSERT row w/ A user_id   -> 403  {"code":"42501","message":"new row violates row-level security policy …"}  <- RLS write guard
SVC verify prefs            -> 200  (row confirmed)
cleanup done (prefs rows + both users deleted)
```

`tsc --noEmit`: 0 new errors introduced (5 pre-existing errors in finance/investments, goalsService,
and a stale `.next` type — all unrelated to this sweep).

## Remaining risks

- **Profile extended fields** (bio/phone/occupation/etc.) persist to `auth.user_metadata`, not a
  PostgREST-queryable table, so they can't be asserted via the DB-layer harness. They are written via
  `supabase.auth.updateUser()` under the user session, which is inherently user-scoped (a user can
  only update their own metadata), so RLS isolation is structural. This is an intentional design
  choice (`public.profiles` is documented "No PII"). Acceptable, but the metadata path is not
  covered by the 2-user PostgREST proof.
- **Security page**: password change proxies to `/api/user/password` (auth layer, not an RLS table —
  out of this sweep's scope). Active sessions, login history, and the 2FA QR flow are still mock UI
  with no persistence — marked NOT_READY, not faked.
- **Persona management**: only a read-only `GET /api/onboarding/active-persona` exists in this area;
  the persona _activation_ write is the Plaid sandbox flow owned by the Integrations agent. Left
  untouched per scoping rules.
- `user_preferences` row is created lazily on first save (upsert). Users who never open Preferences/
  Notifications have no row; GET falls back to defaults — correct, but means the row is absent until
  first interaction.
