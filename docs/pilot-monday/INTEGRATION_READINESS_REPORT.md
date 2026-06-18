# Calendar Integration — Readiness Report (Google + Microsoft)

**Audience:** Monday 20-person pilot Go/No-Go.
**Scope:** AUDIT ONLY. No code changed. Every claim cites `file:line`.
**Surface under test:** `/dashboard/calendar` + the OAuth init/callback/disconnect/events routes for **both** Google and Microsoft.

---

## VERDICT: **BLOCKED for Monday** — one hard blocker, two cheap fixes.

The integration is **architecturally sound and end-to-end correct when OAuth client creds are present**: encrypted token storage, server-only token handling, isolated per-provider failures, honest empty states, refresh, and disconnect all check out (details below). **But OAuth client creds are NOT yet provisioned in Vercel**, and with creds absent the "Connect" button leads a pilot user to a **raw JSON error screen or a 404 dead-end** — not an honest "not configured" state. This will read as broken to every one of the 20 users who clicks Connect.

---

## TOP BLOCKER: "Connect" with creds absent → JSON error / 404 dead-end

### The flow, traced exactly

1. **User clicks "Connect"** on the calendar page. The handler does a full-page navigation, not a guarded fetch:
   `apps/web/src/app/dashboard/calendar/page.tsx:210-212` →

   ```
   const handleConnect = (provider) => { window.location.href = PROVIDER_META[provider].connectPath; }
   ```

   with `connectPath = /api/integrations/oauth/google?bundles=calendar&redirect=/dashboard/calendar` (`:36-37`) and the Microsoft equivalent (`:42-43`).
   **The button does NOT gate on any `oauthConfigured` / configured status** — there is no such check anywhere on the page. It always navigates.

2. **The OAuth init route has no client creds**, so it returns **HTTP 503 with a JSON body**:
   - Google: `apps/web/src/app/api/integrations/oauth/google/route.ts:88-90` → `return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 503 })`.
   - Microsoft: `getMicrosoftAuthUrl` throws when `MICROSOFT_CLIENT_ID` is missing (`oauth/microsoft/route.ts:24-26`), caught at `:78-83` → `NextResponse.json({ error: ... 'Microsoft OAuth not configured' }, { status: 503 })`.

3. **Because step 1 is a `window.location.href` navigation** (not an XHR the page can catch), the browser **renders the raw `{"error":"Google OAuth not configured"}` JSON as the page.** The user lands on a white screen of JSON. Dead end. No back-to-app affordance.

### The compounding 404 dead-end

Even on paths that _do_ redirect (the callback error/not-configured branches), the redirect target **does not exist**:

- Google callback: `/settings/integrations?error=oauth_not_configured` (`oauth/callback/google/route.ts:91-93`), plus `missing_code` (`:67`), `invalid_state` (`:74-77`), `exchange_failed` (`:173-176`), and the success redirect default (`parseRedirectPath` default `:45`).
- Microsoft callback: same `/settings/integrations` targets (`oauth/callback/microsoft/route.ts:67-69, 41, 47-50, 150, 174-176`).
- Both init routes also default `redirect = '/settings/integrations'` (`oauth/google/route.ts:36, 114`; `oauth/microsoft/route.ts:52`).

**`/settings/integrations` DOES NOT EXIST.** Confirmed: `apps/web/src/app/settings/` has no `integrations` route; the real integrations page is `apps/web/src/app/dashboard/integrations/page.tsx`. So any callback that hits an error branch (and any flow that relies on the default redirect) lands on a **Next.js 404**.

> Note: the calendar page _passes_ `redirect=/dashboard/calendar` (`page.tsx:37,43`), so the **success** path returns correctly to the calendar. The 404 only bites on the **error/not-configured** branches and any caller that omits `redirect`. Combined with the JSON-screen blocker above, a creds-absent pilot user has **no clean path**.

### The two fixes (as specified)

1. **Gate the Connect button on configured status.** The calendar page must learn whether OAuth is configured before navigating. Cheapest: have `/api/calendar/events` (or a tiny status route) return a per-provider `configured` flag derived from `Boolean(process.env.GOOGLE_CLIENT_ID && ...)` server-side, and in `ProviderCard` (`page.tsx:133-146`) render a disabled "Connect — coming soon" / honest "Not yet available" state instead of an active button when `!configured`. This stops the JSON-screen dead-end entirely.
2. **Fix the redirect target** from `/settings/integrations` to a route that exists — **`/dashboard/integrations`** (the real page) or **`/dashboard/calendar`** — in all six+ locations: `oauth/google/route.ts:36,114`; `oauth/microsoft/route.ts:52`; `oauth/callback/google/route.ts:45,59,67,74,82,91-93,173-176`; `oauth/callback/microsoft/route.ts:41,47-50,67-69,150,174-176`.

Both are small, frontend/route-level, no schema change. With creds also provisioned in Vercel, the integration would flip to READY.

---

## End-to-end verification (everything ELSE is correct)

### Token storage — encrypted, confirmed live

- Both callbacks persist via the service-role RPC **`upsert_integration_token`** with AES-256 (`INTEGRATION_ENCRYPTION_KEY`): Google `oauth/callback/google/route.ts:127-141`, Microsoft `oauth/callback/microsoft/route.ts:119-133`. Stored in `core.integration_tokens`; status row flipped to connected. (RPC confirmed live in prod per task brief.)
- Auth `code` is consumed in the exchange and never persisted; code/state are dropped via a clean redirect (Google `:155-161`, MS `:160-164`).

### No tokens exposed to client — CONFIRMED

- Tokens are read **server-side only** via `get_integration_token` (`api/calendar/events/route.ts:100-126`). The public response type `SafeCalendarEvent` / `ProviderEvents` (`:39-73`) carries only display fields — title, time, location, attendee **names** (emails stripped via `localName`, `:128-131, 151-154, 259-263`), and a meeting URL. The page-level doc invariants match (`dashboard/calendar/page.tsx:11-16`).
- Disconnect reads the token server-side only to best-effort revoke (Google `integrations/google/disconnect/route.ts:48-62`); never returned to the browser.

### Rendering — honest states, no placeholders

- `/api/calendar/events` aggregates both providers (`route.ts:434-440`).
- **Not connected** → `{connected:false, events:[]}` (`route.ts:382-384`) → honest "Connect … to see your upcoming events" (`page.tsx:150-153`).
- **Connected, no events** → honest "No upcoming events in the next 30 days" (`page.tsx:160-163`).
- **Connected, sync failed** → `{connected:true, error:'Could not load events from this provider.'}` (`route.ts:407-414`) → amber "Try reconnecting" card (`page.tsx:154-159`). No fabricated/sample events anywhere. Loading + global error states present (`page.tsx:255-275`).

### Per-provider isolation — CONFIRMED

- `resolveProvider` wraps each provider in its own try/catch (`route.ts:374-415`) and they run via `Promise.all` (`:434-437`). A Google failure cannot hide Microsoft events. The page also re-orders defensively (`page.tsx:191-199`).

### Refresh — CONFIRMED for both

- Google: refreshes when `isTokenExpired` and a refresh token exists, then best-effort re-persists via `upsert_integration_token` (`route.ts:168-214`). Note `accessType:'offline'` + `prompt:'consent'` requested so a refresh token is issued (`oauth/google/route.ts:94-98`).
- Microsoft: `refreshMicrosoftToken` (`route.ts:269-334`) with `offline_access` in the basic scope bundle (`oauth/microsoft/route.ts:7`) so a refresh token is issued. Refresh failure falls back to the existing access token rather than hard-failing (`:278-280, 291-302`).
- Refresh successes/failures are audit-logged (`logIntegrationEvent`, e.g. `route.ts:194-213, 325-332`).

### Reconnect / disconnect — CONFIRMED

- Disconnect → `disconnect_integration` RPC deletes the encrypted row and flips status (Google `integrations/google/disconnect/route.ts:65-68`, Microsoft `integrations/microsoft/disconnect/route.ts:28-31`); page reloads state after (`page.tsx:214-229`). Reconnect re-runs the same OAuth init → callback path; `upsert_integration_token` upserts, so re-grant overwrites cleanly.

### Callback routing — CONFIRMED

- Provider-registered redirect URIs (`/api/auth/{provider}/callback`) are thin re-exports of the tested handlers under `/api/integrations/oauth/callback/{provider}` (`api/auth/google/callback/route.ts:10`, `api/auth/microsoft/callback/route.ts:10`). Path-independent; no duplicated logic.

### Scopes — trimmed to read-only this week, CONFIRMED, no mismatch

- Google `calendar` bundle = `calendar.readonly` only (`lib/integrations/google/oauth.ts:104`). Init requests `bundles=calendar` (`page.tsx:37`).
- Microsoft `calendar` bundle = `Calendars.Read` only; write + mail deferred (`oauth/microsoft/route.ts:8-11`). Init requests `bundles=calendar` (`page.tsx:43`).
- Read paths match the granted scopes: Google reads `primary` calendar (`route.ts:220-226`); Microsoft reads `/me/calendarView` with read-only `$select` fields (`route.ts:350-362`). **No permission mismatch** — requested == used == read-only.
  - Minor caveat: the Microsoft **init default** bundle is `'basic,calendar,mail'` (`oauth/microsoft/route.ts:50`), which would request `Mail.Read`. The calendar page never uses that default (it passes `bundles=calendar`), so the pilot calendar flow is read-only-calendar only. Harmless for the calendar surface; worth trimming the default if MS OAuth is used elsewhere.

---

## Summary

| Area                                                  | Status                                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| Token storage (encrypted, `upsert_integration_token`) | ✅ Correct, live                                                                  |
| No tokens to client                                   | ✅ Confirmed                                                                      |
| Per-provider failure isolation                        | ✅ Confirmed                                                                      |
| Honest empty / error / loading states                 | ✅ Confirmed (in-page)                                                            |
| Refresh (Google + Microsoft)                          | ✅ Confirmed                                                                      |
| Disconnect / reconnect                                | ✅ Confirmed                                                                      |
| Scopes (read-only, no mismatch)                       | ✅ Confirmed                                                                      |
| **Connect button gating on configured status**        | ❌ **Missing — JSON-error dead-end when creds absent**                            |
| **Error/not-configured redirect target**              | ❌ **`/settings/integrations` is a 404 (real page is `/dashboard/integrations`)** |
| **OAuth client creds in Vercel**                      | ❌ **Not provisioned**                                                            |

**BLOCKED for Monday.** To unblock: (1) provision Google + Microsoft OAuth client creds + `INTEGRATION_ENCRYPTION_KEY` in Vercel, (2) gate the Connect button on a configured flag, (3) repoint all `/settings/integrations` redirects to `/dashboard/integrations` (or `/dashboard/calendar`). With those three done, the integration is READY — the underlying flow is correct and secure.
