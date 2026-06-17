# Email Integration Audit — Google (Gmail) + Microsoft (Outlook)

Sprint: MCP, Data Submission, Email & Calendar Integration.
Scope of this doc: ground-truth audit of what exists in the repo for email integration,
for BOTH providers. Verified against source (file:line). Honest about gaps.

Date: 2026-06-16. Reviewer: Claude Code.

---

## 0. TL;DR

| Capability               | Google (Gmail)                                                                                              | Microsoft (Outlook)                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| OAuth initiation route   | YES `apps/web/src/app/api/integrations/oauth/google/route.ts`                                               | YES `apps/web/src/app/api/integrations/oauth/microsoft/route.ts`                |
| OAuth callback route     | YES `.../oauth/callback/google/route.ts`                                                                    | YES `.../oauth/callback/microsoft/route.ts`                                     |
| Mail scope in initiation | NO by default (bundle is `basic`; `gmail` bundle exists but isn't requested by the email connect flow yet)  | YES (`mail` = `Mail.Read`,`Mail.Send` requested by default)                     |
| Token storage            | Fly backend `POST /api/v1/integrations/google/tokens` (NOT Supabase)                                        | Supabase RPC `upsert_integration_token` → `core.integration_tokens` (encrypted) |
| Token retrieval (server) | via Fly backend (web has no `get_integration_token` path for google today)                                  | `get_integration_token` RPC works (proven by linkedin/sync)                     |
| Encrypted at rest        | YES on the Supabase path (`BYTEA`, `core.encrypt_text`); Fly path not auditable from this repo              | YES (`BYTEA`, `core.encrypt_text`)                                              |
| Refresh-token handling   | `GoogleOAuthService.refreshToken()` exists but is NOT wired into any read path                              | NO refresh wired (raw fetch in callback; no refresh on read)                    |
| Email list endpoint      | NO (Gmail client lib exists, not exposed via a route)                                                       | NO                                                                              |
| Email detail endpoint    | NO (lib method `getMessage` exists)                                                                         | NO                                                                              |
| Attachment handling      | Lib-level only (MIME build in `gmail.ts`); no route, no download path                                       | NO                                                                              |
| `/dashboard/email` page  | NO (built in this sprint)                                                                                   | NO (built in this sprint)                                                       |
| RLS / token privacy      | `core.integration_tokens` is service-role-only RLS; RPCs `REVOKE ALL FROM PUBLIC`, `GRANT ... service_role` | same                                                                            |

Net: OAuth plumbing is real for both providers but **inconsistent** (Google→Fly, Microsoft→Supabase),
the email connect flow does not yet request Gmail scopes, and there were **no email list/detail
routes and no email page**. This sprint adds the page + a safe server-side list route. Live data
still requires OAuth client credentials in env (owner action).

---

## 1. Google (Gmail)

### 1.1 OAuth flow

- Initiation: `apps/web/src/app/api/integrations/oauth/google/route.ts:17` (GET) and `:103` (POST).
  - Requires an authenticated Supabase user (`route.ts:18-24`).
  - Scope bundles via `SCOPE_BUNDLES` (`apps/web/src/lib/integrations/google/oauth.ts:101`).
  - Default bundle is `basic` (`route.ts:29`). The `gmail` bundle
    (`gmail.readonly` + `gmail.send`, `oauth.ts:105`) is available but **only included if the
    caller passes `?bundles=basic,gmail`**. The email connect button built this sprint passes it.
  - CSRF: random state + `google_oauth_state` httpOnly cookie (`route.ts:64-82`).
  - `access_type=offline` + `prompt=consent` so a refresh token is returned (`route.ts:95-98`).
- Callback: `apps/web/src/app/api/integrations/oauth/callback/google/route.ts:13`.
  - Validates state vs cookie (`callback/google/route.ts:40`).
  - Exchanges code (`oauth.ts:190 exchangeCode`), fetches user info (`oauth.ts:271 getUserInfo`).
  - **Stores tokens on the Fly backend**, not Supabase:
    `POST {NEXT_PUBLIC_API_URL}/api/v1/integrations/google/tokens` (`callback/google/route.ts:74-88`)
    with a Supabase session bearer token. This is the key Google/Microsoft divergence.
  - Error messages are scrubbed before redirect (`callback/google/route.ts:121-126`) — good, no token leak.

### 1.2 Scopes (Gmail-relevant)

From `oauth.ts:21-26` / `:105`:

- `gmail.readonly` `https://www.googleapis.com/auth/gmail.readonly`
- `gmail.send` `https://www.googleapis.com/auth/gmail.send`
- (also compose/modify/full available but not bundled)

### 1.3 Token storage / encryption

- Google tokens go to the **Fly backend** (`callback/google/route.ts:74`). Storage shape and
  encryption there are NOT in this repo, so not auditable here. This is a documented gap:
  the Supabase `core.integration_tokens` table supports `provider='google'`
  (`011_mvp_integrations_auth.sql:11`) but the Google **callback does not write to it**.
- Consequence: a Supabase-side `get_integration_token(p_provider:'google')` would return nothing
  for users who connected Google through the existing callback. The Gmail list route built this
  sprint therefore tries Supabase first and returns an honest "not connected via this path"
  signal when empty (no fabrication).

### 1.4 Refresh handling

- `GoogleOAuthService.refreshToken()` (`oauth.ts:224`) and helper `getValidToken()` (`oauth.ts:341`)
  exist but are **not called by any read path** in the web app. Refresh is presumed handled by the
  Fly backend for Google. Gap: no web-side refresh-on-expiry for Gmail.

### 1.5 Gmail API client

- `apps/web/src/lib/integrations/google/gmail.ts` — full `GmailClient`:
  `listMessages` (`:48`), `getMessage` (`:86`), `getMessageBody` (`:98`), `getHeader` (`:126`),
  labels, threads, send/draft, watch. **Rich, but not exposed via any HTTP route until this sprint.**
- Attachments: only outbound MIME building in `buildMimeMessage` (`gmail.ts:157`). No inbound
  attachment download route.

### 1.6 Sync strategy

- `core.get_sync_eligible_users` (`051_token_retrieval.sql:58`) + `public.email_sync_state`
  (`035_calendar_email.sql:91`) + `public.email_messages` (`035_calendar_email.sql:57`) tables
  exist for a batch sync worker. **No such worker is wired for email** in this repo. The page built
  this sprint does **live fetch** (call Gmail at request time with the stored token) rather than
  read a sync table, which avoids showing stale/empty rows.

---

## 2. Microsoft (Outlook / Graph)

### 2.1 OAuth flow

- Initiation: `apps/web/src/app/api/integrations/oauth/microsoft/route.ts:37` (GET).
  - Requires authenticated Supabase user (`:38-44`).
  - Scopes `MICROSOFT_SCOPES` (`microsoft/route.ts:6`): `basic` (openid/profile/email/offline_access),
    `calendar` (`Calendars.Read`,`Calendars.ReadWrite`), `mail` (`Mail.Read`,`Mail.Send`).
  - **Default bundles include `mail`** (`microsoft/route.ts:47`) — so Outlook mail scope is
    requested out of the box, unlike Google.
  - CSRF via `microsoft_oauth_state` cookie (`:63-70`).
  - Auth endpoint `login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize` (`:34`).
- Callback: `apps/web/src/app/api/integrations/oauth/callback/microsoft/route.ts:23`.
  - State validation (`:44-49`), user id from JWT (`:51`).
  - Exchanges code at `oauth2/v2.0/token` (`:71`), fetches profile `graph.microsoft.com/v1.0/me` (`:90`).
  - **Stores tokens in Supabase** via `supabase.rpc('upsert_integration_token', ...)`
    (`callback/microsoft/route.ts:110-124`) with `INTEGRATION_ENCRYPTION_KEY`.
  - Error scrubbed before redirect (`:145-149`) — no token leak.

### 2.2 Scopes

`microsoft/route.ts:6-10`: `Mail.Read`, `Mail.Send`, `Calendars.Read`, `Calendars.ReadWrite`,
`openid profile email offline_access`. `offline_access` => refresh token is issued.

### 2.3 Token storage / encryption

- `core.integration_tokens` (`011_mvp_integrations_auth.sql:8`):
  `access_token_encrypted BYTEA NOT NULL`, `refresh_token_encrypted BYTEA`, `expires_at`, `scope`,
  `external_account_id`, `external_email`, `metadata`, `UNIQUE(user_id, provider)`.
- Encryption at rest: YES — `core.encrypt_text(...)` inside `upsert_integration_token`
  (`011_mvp_integrations_auth.sql:108-109`). Decryption only via `core.get_integration_token`
  (`051_token_retrieval.sql:6`), which is `SECURITY DEFINER` and **service-role only**
  (`051_token_retrieval.sql:54-55`).
- Mirror row (no secrets) written to `public.integrations` with mapped provider
  `outlook_calendar` (`011:124-158`) for status display.

### 2.4 Refresh handling

- A refresh token is stored (`offline_access` scope) but **no read path refreshes it**. The
  callback uses a raw `fetch`; there is no Microsoft equivalent of `GoogleOAuthService.refreshToken`.
  Gap: Graph calls will start failing ~1h after connect until a refresh path is added. The email
  list route built this sprint surfaces this as an honest error state, never fabricated data.

### 2.5 Graph mail API client

- **None exists.** There is no `apps/web/src/lib/integrations/microsoft/` directory at all
  (verified: the only Graph reference in the codebase is the profile call in the MS callback).
- The email list route built this sprint calls Graph
  (`GET https://graph.microsoft.com/v1.0/me/messages`) inline and maps to safe fields only.

### 2.6 Attachments / sync

- No attachment handling. No sync worker. Same live-fetch approach as Google.

---

## 3. Token retrieval pattern (the safe server-side path)

Proven by `apps/web/src/app/api/integrations/linkedin/sync/route.ts:37`:

```
admin.rpc('get_integration_token', { p_user_id, p_provider, p_encryption_key })
```

- Uses the **service-role** Supabase client (admin), built only from server env
  (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).
- `INTEGRATION_ENCRYPTION_KEY` decrypts at the DB layer.
- The decrypted token **stays on the server** — used to call the provider API, never returned to
  the client. This is the exact pattern the new `/api/email/messages` route follows.

Note: `get_integration_token` RETURNS A TABLE (`051:11-20`), so `rpc(...)` resolves to an **array
of rows**. The linkedin route's `tokenData.access_token || tokenData` (`linkedin/sync:47`) is
fragile; the new email route reads `Array.isArray(data) ? data[0] : data` explicitly.

---

## 4. RLS / privacy boundaries

- `core.integration_tokens`: RLS enabled, single policy = service_role only
  (`011_mvp_integrations_auth.sql:27-31`). The anon/auth client can never read tokens.
- RPCs `upsert_integration_token`, `disconnect_integration` (`011:200-205`) and
  `get_integration_token`, `get_sync_eligible_users` (`051:53-91`): `REVOKE ALL FROM PUBLIC` +
  `GRANT EXECUTE ... TO service_role`. Correct.
- `public.email_messages` / `public.email_sync_state`: per-user RLS
  (`035_calendar_email.sql:104` `users_own_sync`). Not used by the live-fetch page.
- Client never receives: access tokens, refresh tokens, provider-internal message IDs (the new
  route hashes/omits raw IDs — see EMAIL_PAGE_REPORT.md safe-field mapping).

---

## 5. Honest gaps (owner action / follow-up)

1. **OAuth client credentials are not provisioned** (`GOOGLE_CLIENT_ID/SECRET`,
   `MICROSOFT_CLIENT_ID/SECRET/TENANT_ID`, `INTEGRATION_ENCRYPTION_KEY`, `NEXT_PUBLIC_API_URL`).
   Until set, both connect flows return 503 and the page shows the honest disconnected state.
   This is the expected pilot state.
2. **Google token storage divergence**: Google callback writes to the Fly backend, Microsoft to
   Supabase. The Supabase-based `/api/email/messages` route can only read Gmail if Google tokens
   are also mirrored into `core.integration_tokens`. RECOMMENDATION (owner decision, not done here
   to avoid touching the shared OAuth callback used by calendar): either (a) have the Google
   callback also call `upsert_integration_token` for `provider='google'`, or (b) add a Fly
   backend email-list endpoint and have the route proxy it with the session token. The route is
   written to degrade honestly either way.
3. **No refresh-on-expiry** for either provider in the web read path. Expired tokens => honest
   error state, not stale data.
4. **No inbound attachment handling** for either provider.
5. **The email connect button must request mail scope.** For Google the page passes
   `?bundles=basic,gmail`; verify the registered Google OAuth app actually has Gmail API enabled.
