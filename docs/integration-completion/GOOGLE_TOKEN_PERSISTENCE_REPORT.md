# Google Token Persistence — Repair Report

**Sprint:** Integration Completion — Google token persistence + token-use audit logging
**Date:** 2026-06-17
**Scope:** P0 fix. No new providers/integrations/features. No package.json/lockfile edits.

## The bug

`apps/web/src/app/api/integrations/oauth/callback/google/route.ts:74` (pre-fix) POSTed
the freshly-exchanged Google tokens to a Fly core-api endpoint that does not exist:

```
POST {NEXT_PUBLIC_API_URL}/api/v1/integrations/google/tokens
```

Because that endpoint returns nothing usable, the Google token was **never written to
`core.integration_tokens`**. The email/calendar read paths
(`apps/web/src/app/api/email/status/route.ts`, `.../email/messages/route.ts`,
`apps/web/src/app/api/calendar/events/route.ts`) all read tokens from Supabase via the
service-role `get_integration_token` RPC, so after "connect" Google always reported
**disconnected** and Gmail/Calendar could not function. Microsoft worked because its
callback already persisted to Supabase.

## The fix — store Google the SAME way Microsoft does

The Google callback now mirrors the Microsoft callback
(`apps/web/src/app/api/integrations/oauth/callback/microsoft/route.ts`) exactly:

| Concern       | Before (Google)               | After (Google) — matches Microsoft                          |
| ------------- | ----------------------------- | ----------------------------------------------------------- |
| User identity | `session_token` cookie        | `getUserIdFromJWT(request)` (Supabase session)              |
| Token store   | POST to non-existent core-api | `core.upsert_integration_token` RPC (service role)          |
| Encryption    | none (handed to core-api)     | AES-256 via `pgp_sym_encrypt`, `INTEGRATION_ENCRYPTION_KEY` |
| Exposure      | n/a                           | server-side only; never returned to browser                 |

Key file/line anchors (post-fix):

- `apps/web/src/app/api/integrations/oauth/callback/google/route.ts`
  - `getUserIdFromJWT` gate → redirect `/login` when no session (`route.ts` ~L80).
  - `oauth_not_configured` honest disabled state when `GOOGLE_CLIENT_ID` /
    `GOOGLE_CLIENT_SECRET` / `INTEGRATION_ENCRYPTION_KEY` absent (~L92).
  - `supabase.rpc('upsert_integration_token', { p_user_id, p_provider:'google',
p_access_token, p_refresh_token, p_expires_at, p_scope, p_external_account_id,
p_external_email, p_metadata, p_encryption_key })` (~L120) — stores access **+**
    refresh token (encrypted), expiry, scopes, and the provider account email/id when
    available.
  - Clean redirect with `success=google_connected`; `code`/`state` are dropped from the
    post-handling URL and the `google_oauth_state` cookie is deleted (~L160).

## The store path (canonical, unchanged schema)

```
Google OAuth callback
   └─ createGoogleOAuthService().exchangeCode(code)        // code consumed, never stored
   └─ getUserInfo() (best-effort; non-fatal)               // external_email / id
   └─ supabase.rpc('upsert_integration_token', …)          // service role
        └─ core.upsert_integration_token (SECURITY DEFINER, migration 011)
             └─ core.encrypt_text(token, key)              // AES-256, migration 009
             └─ INSERT core.integration_tokens (…_encrypted BYTEA)
             └─ UPSERT public.integrations status='connected'
```

Read-back (unchanged — already correct):

```
email/calendar route → admin.rpc('get_integration_token', …)   // migration 051
   └─ core.decrypt_text(...) returns access/refresh server-side ONLY
```

No new token store was created; no plaintext is stored; the schema is `user_id`-scoped
(`UNIQUE(user_id, provider)`). There is no `tenant_id` column in
`core.integration_tokens` today, so persistence remains user-scoped (matching Microsoft).
Tenant scoping is captured in the audit log instead (see the audit report).

## Disconnect also repaired

`apps/web/src/app/api/integrations/google/disconnect/route.ts` previously called the same
non-existent core-api (`DELETE /api/v1/integrations/google`). It now:

1. Reads the access token server-side and **best-effort revokes** it at Google
   (`GoogleOAuthService.revokeToken`; failure is non-fatal, never blocks).
2. Calls `disconnect_integration` (migration 011) — deletes the encrypted row and flips
   `public.integrations.status` to `disconnected`. This matches the Microsoft disconnect.

## Security guarantees verified by tests

`apps/web/src/app/api/integrations/oauth/callback/google/__tests__/google-callback.test.ts`
and `.../google/disconnect/__tests__/disconnect.test.ts`:

- Token persisted via `upsert_integration_token` with the encryption key and `user_id`.
- Browser receives only a redirect URL — no access/refresh token, no auth `code`.
- Missing session → `/login`, no persistence.
- State mismatch (CSRF) → `error=invalid_state`, no persistence.
- Missing OAuth config → `error=oauth_not_configured` honest disabled state.
- Disconnect revokes at Google then removes the row; token never in the response.

## Tooling results

- `pnpm -C apps/web type-check`: PASS.
- ESLint on all changed files: PASS (no warnings/errors).
- Jest (google callback + disconnect + email + calendar + audit): 31 passed.
