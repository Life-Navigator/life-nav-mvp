# AUTHENTICATED_UI_SMOKE_REPORT.md — Phase 4 (BLOCKED — honest)

## Outcome: NOT completed. No authenticated domain screens were captured.

### What worked

- Playwright + chromium run in this environment; public landing page captured (200, correct title).
- Backend that every domain depends on is proven: core-api healthy, Vertex Gemini 2.5 Pro live via WIF.
- Minted a one-time magic link via the Fly admin path (service-role key never left the machine / never printed).

### What blocked it

The app's SSR auth uses a **cookie/PKCE** session, but an **admin-generated magic link** returns an **implicit hash token** (`/auth#access_token=…`). The client `/auth` page did not establish an SSR cookie session headlessly, so every protected route (`/dashboard/*`) bounced back to `/auth`. Result: all "domain" screenshots were the **login page**, not authenticated content — so they were discarded (presenting them would be misleading).

### Security incident (disclosed + remediated)

My first script printed the post-redirect URL, which contained the owner's session **access+refresh token** in the hash. I immediately performed a **global sign-out** (`/auth/v1/logout?scope=global` → HTTP 204), revoking all of the user's refresh tokens (incl. the leaked one). The leaked access token is a stateless JWT that cannot be revoked but **expires ~1h from mint and can no longer be refreshed**. Local link/token files were shredded. See SECURITY_AUDIT addendum.

### How to actually complete Phase 4 (needs the app's real auth flow)

Pick one:

1. **Owner provides a logged-in storage state**: log in normally in a browser, export Playwright `storageState.json` (cookies), hand it over — I drive the smoke with it. Cleanest, no token exposure.
2. **PKCE-compatible session**: add/confirm a server `/auth/callback` that exchanges a code → cookies, and mint a link with `redirect_to` = that callback. Then headless works.
3. Run the smoke from an already-authenticated browser session locally.

Status: BLOCKED on a flow-compatible authenticated session.
