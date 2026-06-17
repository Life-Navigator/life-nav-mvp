# Email Page Report — `/dashboard/email`

Sprint: MCP, Data Submission, Email & Calendar Integration.
What was built, the data flow, the safe-field mapping, the UI states, and honest gaps.

Date: 2026-06-16. Author: Claude Code.

---

## 1. What was built

### New page

- `apps/web/src/app/dashboard/email/page.tsx` — client page. Per-provider connection
  status, connect/disconnect, recent-emails list, and all five UI states (loading/error/
  empty/ready/disconnected). Connect URLs request MAIL scope:
  - Google: `/api/integrations/oauth/google?bundles=basic,gmail&redirect=/dashboard/email`
    (`page.tsx:23`)
  - Microsoft: `/api/integrations/oauth/microsoft?bundles=basic,mail&redirect=/dashboard/email`
    (`page.tsx:24`)
  - Disconnect uses the existing routes `/api/integrations/{google,microsoft}/disconnect`
    (`page.tsx:27-30`).

### New components

- `apps/web/src/components/email/EmailProviderCard.tsx` — connection-status card per provider:
  Connected / Not connected badge, account email, Connect/Disconnect button, and an honest
  "connection not available yet" notice when OAuth client creds aren't provisioned
  (`EmailProviderCard.tsx:67-72`).
- `apps/web/src/components/email/RecentEmailsList.tsx` — list with read/unread icon, sender,
  subject, date, snippet; plus loading/error/empty rendering (`RecentEmailsList.tsx`).
- `apps/web/src/components/email/EmailPrivacyNotice.tsx` — "What Arcana can access" notice
  (read recent inbox; tokens stay server-side; no send/sharing; disconnect any time).

### New API routes (server-side, token-safe)

- `apps/web/src/app/api/email/status/route.ts` — `GET`. Returns per-provider
  `{ connected, email, connectedAt, oauthConfigured }`. Reads `core.integration_tokens` via the
  `get_integration_token` service-role RPC but returns ONLY `external_email` + `expires_at`
  (`status/route.ts:77-83`). Tokens never leave the server.
- `apps/web/src/app/api/email/messages/route.ts` — `GET ?provider=google|microsoft&limit=N`.
  Decrypts the stored token server-side, calls Gmail (`createGmailClient`, reusing the existing
  `gmail.ts` lib) or Microsoft Graph (`/v1.0/me/mailFolders/inbox/messages`), and maps to the
  `SafeEmailMessage` shape.

### Tests

- `apps/web/src/components/email/__tests__/email-page.test.tsx` — 11 jsdom tests: connect renders
  - fires, disconnect renders + fires, OAuth-not-provisioned disables connect, list renders,
    empty (connected) vs empty (nothing connected), error+retry, loading skeleton; plus 3 page
    integration tests (disconnected pilot state, connected list, full disconnect→re-read flow) with
    a DOM token-leak assertion.
- `apps/web/src/app/api/email/__tests__/email-routes.test.ts` — 9 node tests: auth gates, bad
  provider, not-connected honest empty, Google + Microsoft safe-field mapping, provider-failure
  503, and explicit assertions that the access/refresh tokens and raw provider message IDs are
  NEVER in the response JSON (while confirming the server DID receive the real token to call the API).

Result: 20/20 tests pass. `pnpm type-check` clean. eslint clean on all 8 new files.

---

## 2. Data flow

```
Browser (page.tsx)
  GET /api/email/status ───────────────► route (server)
                                          ├─ supabase.auth.getUser()  (authn)
                                          └─ admin.rpc(get_integration_token)  ─► core.integration_tokens (decrypt, service-role)
                                          ◄─ { providers:[{connected,email,connectedAt,oauthConfigured}] }   ← NO TOKENS

  GET /api/email/messages?provider=X ──► route (server)
                                          ├─ supabase.auth.getUser()  (authn)
                                          ├─ admin.rpc(get_integration_token)  ─► decrypt access_token (stays server-side)
                                          ├─ Gmail: createGmailClient(token).listMessages()+getMessage('metadata')
                                          │   OR Graph: fetch /v1.0/me/mailFolders/inbox/messages (Bearer token)
                                          └─ map → SafeEmailMessage[]
                                          ◄─ { provider, connected, messages:[...] }   ← NO TOKENS, NO RAW IDS

  POST /api/integrations/{google,microsoft}/disconnect  (existing routes) → re-read status
```

Connect is a **full-page redirect** into the existing shared OAuth init routes (which set CSRF
state cookies and redirect to the provider), returning to `/dashboard/email`. The page does not
handle tokens at any point.

---

## 3. Safe-field mapping

Provider response → `SafeEmailMessage` (the ONLY shape sent to the client):

| Client field | Google (Gmail metadata)                                          | Microsoft (Graph)             |
| ------------ | ---------------------------------------------------------------- | ----------------------------- |
| `ref`        | sha256(provider message id).slice(0,16) — opaque, non-reversible | same                          |
| `fromName`   | parsed from `From` header                                        | `from.emailAddress.name`      |
| `fromEmail`  | parsed from `From` header                                        | `from.emailAddress.address`   |
| `subject`    | `Subject` header (`(no subject)` fallback)                       | `subject`                     |
| `date`       | `Date` header → ISO 8601                                         | `receivedDateTime` → ISO 8601 |
| `snippet`    | `message.snippet`                                                | `bodyPreview`                 |
| `unread`     | `labelIds` includes `UNREAD`                                     | `isRead === false`            |

Deliberately NOT mapped/returned: `access_token`, `refresh_token`, raw provider message/thread IDs,
full body/HTML, attachments, provider-internal account IDs. The status route additionally returns
only `external_email` and `expires_at`.

Token handling for Gmail uses `format=metadata` so the message **body is never fetched** — only
headers + snippet, the minimum needed for the list. (Detail/body view was intentionally not built;
see gaps.)

---

## 4. UI states

| State                       | Trigger                               | Component testid                                   |
| --------------------------- | ------------------------------------- | -------------------------------------------------- |
| Status loading              | initial `/api/email/status` in flight | `email-status-loading`                             |
| Status error                | status fetch fails                    | `email-status-error` (retry)                       |
| Connected card              | provider has a token row              | `email-status-connected-{provider}`                |
| Disconnected card           | no token row                          | `email-status-disconnected-{provider}`             |
| Connect unavailable         | `oauthConfigured:false`               | disabled `email-connect-{provider}` + amber notice |
| List loading                | messages fetch in flight              | `email-list-loading` (skeleton)                    |
| List ready                  | ≥1 message                            | `email-list`                                       |
| List empty (connected)      | connected, 0 messages                 | `email-list-empty` "No recent messages"            |
| List empty (none connected) | nothing connected                     | `email-list-empty` "No email account connected"    |
| List error                  | messages fetch fails / provider 5xx   | `email-list-error` (retry)                         |

No mock/placeholder rows anywhere — the empty and disconnected states are honest.

---

## 5. Honest gaps (owner action)

1. **OAuth client credentials required for live data (owner action).** Until these env vars are set,
   connect buttons are disabled and the page sits in the honest disconnected state (expected pilot
   state):
   - Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (+ Gmail API enabled on the Google project,
     `NEXT_PUBLIC_API_URL` for the Fly token store).
   - Microsoft: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, optionally `MICROSOFT_TENANT_ID`,
     `MICROSOFT_REDIRECT_URI`.
   - Both: `INTEGRATION_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

2. **Gmail token storage divergence (architectural, owner decision).** The existing Google OAuth
   callback stores tokens on the Fly backend, NOT in `core.integration_tokens`. The new
   `/api/email/messages` reads from Supabase. So Gmail will show connected + list messages only if
   Google tokens are ALSO present in `core.integration_tokens`. Options (not done here to avoid
   editing the shared OAuth callback used by calendar):
   - (a) Have the Google callback additionally call `upsert_integration_token('google', ...)`, OR
   - (b) Add a Fly backend email-list endpoint and proxy it from the route with the session token.
     The route degrades honestly today (Gmail shows disconnected/empty rather than fabricating data).
     Microsoft works end-to-end against Supabase as-is.

3. **No web-side token refresh.** Neither provider refreshes an expired access token in the read
   path. After ~1h, provider calls 401 → the route returns 503 → the list shows the honest error
   state with a "try reconnecting" message. Adding refresh (Google: `GoogleOAuthService.refreshToken`
   already exists; Microsoft: needs a new helper) is follow-up.

4. **No message detail / body / attachment view.** The list is metadata-only by design (privacy +
   minimal scope). A detail route would need its own safe-field policy and (for Gmail) a body fetch.

5. **`get_integration_token` is in the `core` schema.** Both the new routes and the existing
   linkedin/microsoft routes call `supabase.rpc('get_integration_token', ...)` / `upsert_integration_token`
   without a schema prefix, relying on PostgREST exposing these. This matches the established
   working pattern (linkedin sync, microsoft callback) — flagged for awareness, not changed.

6. **Suggested follow-up (not done, per scope):** add an `/api/email/status`-style indicator to the
   sidebar/nav, and reconcile the existing `EmailInbox`/`EmailSidebar`/`EmailAccountModal` components
   (currently unused by this page) — they assume a different `EmailMessage` shape (`src/types/email.ts`)
   that exposes full body; not wired to avoid that broader surface this sprint.
