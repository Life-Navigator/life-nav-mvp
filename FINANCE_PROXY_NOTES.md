# Finance proxy cutover notes (F3)

`apps/web/src/app/api/financial/route.ts` now contains an **env-gated thin proxy**
to the Core API.

## Behavior

- **`CORE_API_URL` unset (default / current prod):** the route runs its existing
  logic and returns the legacy shape. **Nothing changes.**
- **`CORE_API_URL` set:** the route forwards the signed-in user's Supabase JWT to
  `GET ${CORE_API_URL}/v1/finance/summary` and returns the Core API response
  **directly** (no business logic in Vercel; only the user's own JWT travels;
  no service-role or Gemini key is exposed).

## Cutover sequence (do in order)

1. Deploy `lifenavigator-core-api` to Fly; smoke `/v1/finance/summary` (see `apps/lifenavigator-core-api/DEPLOYMENT.md`).
2. Update the finance page (`dashboard/finance/page.tsx`) to consume the Core API
   **`DomainViewModel`** shape (`data.net_worth`, `data.accounts`, …) instead of the
   legacy `{accounts, transactions:{...}}` shape. This is the only frontend change
   and is intentionally **not** done in F3 (scope = proxy wiring, not UI rework).
3. Set `CORE_API_URL` on Vercel → the proxy activates.
4. Verify the finance dashboard renders from the Core API; then remove the legacy
   aggregation logic from the route (it becomes a pure proxy).

## Why gated

The Core API view-model differs from the legacy `/api/financial` payload. Flipping
the env before the page is updated would change the response shape. Gating keeps
prod safe and makes the cutover a deliberate, reversible step.
