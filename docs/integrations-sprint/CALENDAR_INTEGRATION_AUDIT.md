# Calendar Integration Audit — Google + Microsoft (Outlook)

Sprint: "MCP, Data Submission, Email & Calendar Integration."
Scope: Google Calendar **and** Microsoft (Outlook) Calendar.
All paths are relative to `apps/web/` unless noted. Line refs are `file:line`.

This audit is grounded in the code as it exists on `main`. It is honest about
gaps — there are several, and the most important one (Google token storage
asymmetry) directly shapes what the calendar page can do today.

---

## 1. Provider support matrix

| Capability               | Google                                                    | Microsoft (Outlook)                                          |
| ------------------------ | --------------------------------------------------------- | ------------------------------------------------------------ |
| OAuth initiation route   | `src/app/api/integrations/oauth/google/route.ts`          | `src/app/api/integrations/oauth/microsoft/route.ts`          |
| OAuth callback route     | `src/app/api/integrations/oauth/callback/google/route.ts` | `src/app/api/integrations/oauth/callback/microsoft/route.ts` |
| Disconnect route         | `src/app/api/integrations/google/disconnect/route.ts`     | `src/app/api/integrations/microsoft/disconnect/route.ts`     |
| Calendar API client lib  | `src/lib/integrations/google/calendar.ts` (full CRUD)     | **None** — Graph called inline (none pre-existing)           |
| Token storage            | **Fly Core API** (`/api/v1/integrations/google/tokens`)   | **Supabase** `core.integration_tokens` (encrypted)           |
| Token read-back (server) | **No path from web app** (see Gap A)                      | `core.get_integration_token` RPC                             |
| Refresh handling lib     | `GoogleOAuthService.refreshToken` (`oauth.ts:224`)        | None pre-existing (token endpoint exists; no helper)         |

---

## 2. OAuth flow

### Google

- `oauth/google/route.ts:17` — `GET`/`POST`, requires an authenticated Supabase
  user first (`getUser()`), 401 otherwise.
- Scope bundles assembled from `SCOPE_BUNDLES` in
  `src/lib/integrations/google/oauth.ts:101`. The `calendar` bundle =
  `calendarEvents` + `calendarReadonly` (`oauth.ts:103`).
- CSRF: random state stored in `google_oauth_state` httpOnly cookie
  (`oauth/google/route.ts:76`), validated in callback (`callback/google/route.ts:38`).
- `accessType: 'offline'` + `prompt: 'consent'` → refresh token is requested
  (`oauth/google/route.ts:95`).
- Callback exchanges the code (`callback/google/route.ts:50`), fetches user info,
  then **POSTs the tokens to the Fly Core API** at
  `${NEXT_PUBLIC_API_URL}/api/v1/integrations/google/tokens`
  (`callback/google/route.ts:74`). Tokens are **not** written to Supabase.

### Microsoft

- `oauth/microsoft/route.ts:37` — `GET`, requires an authenticated Supabase user.
- Scopes hard-coded in-route (`oauth/microsoft/route.ts:6`):
  `basic` = `openid profile email offline_access`; `calendar` =
  `Calendars.Read Calendars.ReadWrite`; `mail` = `Mail.Read Mail.Send`.
  `offline_access` ⇒ refresh token returned.
- CSRF: `microsoft_oauth_state` httpOnly cookie (`oauth/microsoft/route.ts:64`),
  validated in callback (`callback/microsoft/route.ts:44`).
- Callback exchanges the code (`callback/microsoft/route.ts:71`), reads the
  Graph `/me` profile, then **stores tokens in Supabase** via the
  `upsert_integration_token` RPC with `INTEGRATION_ENCRYPTION_KEY`
  (`callback/microsoft/route.ts:110`). Tokens are encrypted at rest.

> **Inconsistency (noted, not changed — shared OAuth libs are off-limits):**
> The default `redirect` for both flows is `/settings/integrations`, but that
> route does not exist in the app. The real integrations UI is
> `src/app/dashboard/integrations/page.tsx`. The new calendar page passes an
> explicit `redirect=/dashboard/calendar` so it returns to the right place.

---

## 3. Scopes

| Provider  | Calendar scopes used                                                   | Effective access                     |
| --------- | ---------------------------------------------------------------------- | ------------------------------------ |
| Google    | `calendar.events`, `calendar.readonly` (`oauth.ts:17`,`:18`)           | Read events + (with `.events`) write |
| Microsoft | `Calendars.Read`, `Calendars.ReadWrite` (`oauth/microsoft/route.ts:8`) | Read + write events                  |

The new events route only **reads**. Read-only is sufficient for display; the
broader scopes are an existing decision in the shared libs, untouched here.

---

## 4. Token storage & RLS / privacy

- Table: `core.integration_tokens` (provider CHECK includes `google`,
  `microsoft`, `plaid`, `linkedin`, `credly` — migration
  `supabase/migrations/040_integration_providers_extended.sql:29`).
- Encryption: `access_token_encrypted` / `refresh_token_encrypted` columns;
  decrypted only inside `core.decrypt_text` within SECURITY DEFINER RPCs.
- Read RPC: `core.get_integration_token` (migration
  `supabase/migrations/051_token_retrieval.sql:6`) — `SECURITY DEFINER`,
  `REVOKE ALL ... FROM PUBLIC`, `GRANT EXECUTE ... TO service_role`
  (`051:54`). **Service-role only — never client-callable.**
- Write RPC: `upsert_integration_token` (used by Microsoft callback `:110`).
- Privacy posture: tokens never reach the browser. Routes that need a token use
  the service-role admin client + `INTEGRATION_ENCRYPTION_KEY` server-side
  (reference pattern: `src/app/api/integrations/linkedin/sync/route.ts:37`).

---

## 5. Refresh handling

- Google: `GoogleOAuthService.refreshToken` (`oauth.ts:224`) +
  `isTokenExpired` (`oauth.ts:337`, 300s buffer). The new events route refreshes
  on demand and best-effort re-persists via `upsert_integration_token`.
- Microsoft: no pre-existing refresh helper. The new events route refreshes
  inline against `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`
  and re-persists best-effort.
- Pre-sprint gap: neither callback set up proactive/background refresh; refresh
  was effectively unimplemented for reads. Now handled lazily at read time.

---

## 6. Calendar-list / events / event-detail endpoints

### Pre-sprint state

- **Calendar list:** Google lib supports `listCalendars` (`calendar.ts:47`);
  Microsoft has no client. No HTTP route exposed either.
- **Events:** `GoogleCalendarClient.listEvents` (`calendar.ts:66`) exists as a
  lib, but **no `/api/calendar/events` route existed**. The old calendar page
  fetched `/api/calendar/events` and `/api/calendar/sources` —
  **both routes were missing** (the page silently fell into its error/empty
  branches). Confirmed: `find src/app/api/calendar` returned nothing.
- **Event detail:** `GoogleCalendarClient.getEvent` (`calendar.ts:121`) exists
  as a lib; no route. Microsoft: none.

### Built this sprint

- **`src/app/api/calendar/events/route.ts`** (`GET`) — aggregates upcoming
  events (next 30 days, max 25/provider) for **both** providers, server-side,
  returning only safe fields. See `CALENDAR_PAGE_REPORT.md`.

Calendar-list and event-detail HTTP routes remain **not built** (out of scope
for the page deliverable; the page shows a unified upcoming-events list, not a
per-calendar picker). Noted as a future gap.

---

## 7. The existing `/dashboard/calendar` page (pre-sprint assessment)

File: `src/app/dashboard/calendar/page.tsx` (old version).

- It was a **stub/non-functional**: a month/week/day calendar grid that fetched
  `/api/calendar/sources` and `/api/calendar/events` — **neither route existed**
  — so every load hit the `catch` and rendered the error/empty branch.
- The "connect" modal pointed at `/api/integrations/oauth/init?...` which **does
  not exist** (real routes are `/api/integrations/oauth/google` and
  `/api/integrations/oauth/microsoft`).
- It listed Apple Calendar as a provider with **no backend** — would never work.
- Event create/update/delete handlers POSTed to the missing routes.
- No per-provider connection status, no disconnect, no privacy notice.

Verdict: rendered nothing real; effectively a placeholder. Replaced with a
working, honest, two-provider upcoming-events page this sprint.

---

## 8. Honest gaps (action required)

**Gap A — Google token read-back asymmetry (most important).**
Google tokens are POSTed to the Fly Core API by the callback
(`callback/google/route.ts:74`) and are **not** written to Supabase. There is
**no web-app path to read a Google access token back** (no Supabase row, no
backend GET endpoint — confirmed by grep). Consequences:

- The new events route reads tokens via `core.get_integration_token`. For
  Microsoft this works end-to-end. For Google it will find **no row** and
  honestly report Google as **disconnected** until one of these is done:
  1. (Recommended) Add a backend endpoint `GET /api/v1/integrations/google/token`
     on the Fly Core API that returns a fresh access token for the user, OR
  2. Have the Google callback **also** persist to `core.integration_tokens` via
     `upsert_integration_token` (mirrors Microsoft) — requires editing the
     callback (a shared-ish OAuth route; flagged for owner, not changed here).
- This is a real, documented gap — not hidden. The page degrades gracefully
  (Google shows "Not connected / Connect") rather than fabricating events.

**Gap B — Live OAuth credentials = owner action.** Live sync needs:

- Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, redirect URI registered.
- Microsoft: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`,
  `MICROSOFT_TENANT_ID`, redirect URI registered.
- Both: `INTEGRATION_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY` on Vercel.
  Per repo memory, these provider credentials are owner-provisioned and are the
  gating item for live calendar sync.

**Gap C — `redirect` default points at a non-existent `/settings/integrations`.**
Lives in shared OAuth routes; not changed. New page passes explicit redirect.

**Gap D — No calendar-list / event-detail HTTP routes, no Microsoft calendar
client lib.** Acceptable for the current page (unified upcoming list), but
required if a per-calendar picker or event drill-down is added later.

**Gap E — `useIntegration` hook (`src/hooks/useIntegration.ts`) is unused by the
new page** and references `initiateOAuth` from `lib/api/integrations`. It uses a
popup + postMessage flow that no OAuth callback emits (callbacks do full-page
redirects). Audit-only per instructions; if it is meant to be the canonical
connect path it needs reworking to match the redirect-based callbacks.
