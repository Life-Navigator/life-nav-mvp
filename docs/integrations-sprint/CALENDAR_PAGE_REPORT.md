# Calendar Page Report

Sprint: "MCP, Data Submission, Email & Calendar Integration."
Deliverable: complete `/dashboard/calendar` for **both** Google + Microsoft,
with honest disconnected/empty states and no token exposure.

All paths relative to `apps/web/`. Line refs are `file:line`.

---

## 1. What was built

### A. Server-side events route (new)

`src/app/api/calendar/events/route.ts` — `GET`, `dynamic = 'force-dynamic'`.

- Authenticates the user via Supabase (`route.ts:317` `getUser()`); 401 if absent.
- Reads each provider's token **server-side** via the service-role
  `get_integration_token` RPC + `INTEGRATION_ENCRYPTION_KEY`
  (`readToken`, `route.ts:103`). Same pattern as
  `src/app/api/integrations/linkedin/sync/route.ts:37`.
- Refreshes expired tokens lazily:
  - Google: `GoogleOAuthService.refreshToken` (`route.ts:189`), re-persist best-effort.
  - Microsoft: inline token endpoint call (`refreshMicrosoftToken`, `route.ts:244`).
- Fetches upcoming events (next 30 days, max 25/provider):
  - Google via `GoogleCalendarClient.listEvents` (`route.ts:206`).
  - Microsoft via Graph `me/calendarView` (`route.ts:300`).
- **Per-provider isolation** (`resolveProvider`, `route.ts:330`): a failure in
  one provider returns `{ connected:true, error, events: [] }` for that provider
  only; the other provider is unaffected (`Promise.all`, `route.ts:360`).
- Returns `CalendarEventsResponse` = `{ providers: ProviderEvents[] }`.

### B. Calendar page (rewritten)

`src/app/dashboard/calendar/page.tsx` — client component.

- Replaced the old non-functional stub (which fetched two missing routes and an
  `oauth/init` route that doesn't exist — see audit §7).
- Per-provider **connection status card** (`ProviderCard`, `page.tsx:113`):
  Connected/Not connected badge + Connect or Disconnect button.
- **Connect**: redirects to the real OAuth init routes with explicit
  `redirect=/dashboard/calendar` (`PROVIDER_META`, `page.tsx:34`).
- **Disconnect**: POSTs to the existing per-provider disconnect routes, then
  refetches (`handleDisconnect`, `page.tsx:230`).
- **Upcoming events** with title, date/time, location, attendee names, and a
  meeting Join link when present (`EventRow`, `page.tsx:69`).
- **Privacy notice** — "How Arcana uses your calendar" (`page.tsx`, the blue
  panel) — read-only, server-side, never shared, tokens never sent to browser.
- States: **loading** (`data-testid="calendar-loading"`), **error** with retry
  (`calendar-error`), **ready** (`calendar-ready`); honest **disconnected** and
  **empty** ("No upcoming events in the next 30 days") states per provider.

### C. Tests (new)

- `src/app/api/calendar/events/__tests__/events.test.ts` (jest, node env):
  401 unauth; disconnected→empty; Google events mapped to safe fields;
  **token NOT exposed** (asserts access/refresh tokens and `access_token`/
  `refresh_token` keys never appear in the response body); provider-failure
  isolation.
- `src/app/dashboard/calendar/__tests__/page.test.tsx` (jest, jsdom):
  privacy notice; disconnected/connect state; events render (title/time/
  location/attendees/Join link); empty state; error+retry; disconnect flow
  posts to the correct endpoint and refetches.

---

## 2. Data flow

```
Browser (page.tsx)
  └─ GET /api/calendar/events            ← no tokens in request
       └─ Supabase getUser()  (auth)
       └─ for each provider {google, microsoft} in parallel:
            └─ core.get_integration_token (service-role RPC, decrypts token)
            └─ if expired → provider refresh + re-persist (best-effort)
            └─ Google Calendar API / Microsoft Graph  (server→provider)
            └─ map raw event → SAFE fields only
       └─ JSON { providers: [{provider, connected, error?, events[]}] }
  └─ render per-provider cards / events / empty / error states

Connect:    page → /api/integrations/oauth/{google|microsoft}?bundles=calendar
Disconnect: page → POST /api/integrations/{google|microsoft}/disconnect
```

Tokens live only between the RPC and the provider HTTP call, server-side. The
response and the browser never see them.

---

## 3. Safe-field mapping

Raw provider payloads are reduced to `SafeCalendarEvent` (`route.ts:48`):

| Safe field                   | Google source                                   | Microsoft source                  |
| ---------------------------- | ----------------------------------------------- | --------------------------------- |
| `id`                         | `event.id`                                      | `event.id`                        |
| `title`                      | `summary`                                       | `subject`                         |
| `start` / `end`              | `start.dateTime`\|`date` / `end...`             | `start.dateTime` / `end.dateTime` |
| `allDay`                     | `start.date && !dateTime`                       | `isAllDay`                        |
| `location`                   | `location`                                      | `location.displayName`            |
| `attendees[].name`           | `displayName` or **email local-part only**      | `emailAddress.name` or local-part |
| `attendees[].responseStatus` | `responseStatus`                                | `status.response`                 |
| `meetingUrl`                 | conference video `entryPoint.uri` or `htmlLink` | `onlineMeeting.joinUrl`           |

Deliberately **excluded**: access/refresh tokens, raw attendee email addresses,
organizer internals, full raw provider objects, descriptions/notes (may contain
sensitive free text), ETags, calendar IDs.

---

## 4. States implemented

| State                       | Where                                            |
| --------------------------- | ------------------------------------------------ |
| Loading                     | `page.tsx` `loadState === 'loading'` (skeletons) |
| Error + retry               | `page.tsx` `loadState === 'error'`               |
| Disconnected (per provider) | `ProviderCard` `!data.connected` → Connect       |
| Connected + events          | `ProviderCard` → `EventRow` list                 |
| Connected + empty           | "No upcoming events in the next 30 days"         |
| Connected + sync error      | amber panel, no fabricated events                |

---

## 5. Honest gaps / blockers

1. **Google events require a token read-back path (Gap A in the audit).**
   Google tokens are stored on the Fly Core API, not Supabase, so the events
   route currently finds no Google row and reports Google as "Not connected".
   Owner/backend action: add `GET /api/v1/integrations/google/token` on the Fly
   API, **or** mirror Microsoft by also persisting Google tokens to
   `core.integration_tokens` in the Google callback. Microsoft works
   end-to-end today (given creds).

2. **Live sync needs provider OAuth credentials (owner action):**
   `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET/TENANT_ID`,
   `INTEGRATION_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and registered
   redirect URIs on Vercel/provider consoles. Without these the page renders
   honest disconnected states (no fabrication).

3. **`redirect` default `/settings/integrations` in shared OAuth routes** points
   at a non-existent page. Not changed (shared route). The page passes an
   explicit `redirect=/dashboard/calendar`, so the calendar flow is unaffected;
   other callers still land on a dead route.

4. **No calendar-list picker / event-detail drill-down / Microsoft client lib.**
   Out of scope for the unified upcoming-events page; required if those features
   are added later.

5. **`useIntegration` hook unused & stale** (popup/postMessage flow that no
   callback emits). Audit-only; flagged for owner rework if it is meant to be
   the canonical connect path.

---

## 6. Verification

- `pnpm -C apps/web type-check` → **pass** (clean).
- `eslint` on all 4 added/changed files → **pass** (no warnings/errors).
- `jest` (the 2 new suites) → **11/11 pass**, no `act()` warnings.

## 7. Files added / changed

Added:

- `apps/web/src/app/api/calendar/events/route.ts`
- `apps/web/src/app/api/calendar/events/__tests__/events.test.ts`
- `apps/web/src/app/dashboard/calendar/__tests__/page.test.tsx`
- `docs/integrations-sprint/CALENDAR_INTEGRATION_AUDIT.md`
- `docs/integrations-sprint/CALENDAR_PAGE_REPORT.md`

Changed:

- `apps/web/src/app/dashboard/calendar/page.tsx` (stub → working two-provider page)
