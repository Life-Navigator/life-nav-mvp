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

1. ✅ **DONE** — Deploy `lifenavigator-core-api` to Fly; smoke `/v1/finance/summary`
   (see `apps/lifenavigator-core-api/DEPLOYMENT.md`). Live at
   `https://lifenavigator-core-api.fly.dev`.
2. ✅ **DONE** — The finance page now consumes the Core API `DomainViewModel`
   through the typed mapper `apps/web/src/lib/finance/domainViewModel.ts`. The page
   accepts BOTH shapes (DVM when the proxy is on, legacy when off); all shape/Plaid
   coupling lives in the mapper. Money tiles render an em dash + premium prompt when
   absent — never a fake `$0`. H-contract recommendations render. `pnpm type-check`
   clean; mapper unit tests green.
3. ⏳ **GATING ITEM — do before flipping `CORE_API_URL`:** the proxy returns only
   `/v1/finance/summary`, which has **no transactions / cash-flow / investments
   detail**. With the proxy on, the hero tiles + accounts + recommendations render
   from the Core API, but the **spending charts and recent-transactions sections go
   empty** (graceful empty states, not errors). To preserve the full dashboard,
   either (a) add thin proxy routes for `/v1/finance/transactions` + `/cash-flow` +
   `/investments` and have the page fetch them, or (b) accept the interim reduced
   detail. **`CORE_API_URL` is intentionally NOT set yet** for this reason.
4. Set `CORE_API_URL=https://lifenavigator-core-api.fly.dev` on Vercel → the proxy
   activates. Verify the dashboard renders from the Core API; then remove the legacy
   aggregation logic from the route (it becomes a pure proxy).

## Why gated

The Core API view-model differs from the legacy `/api/financial` payload, and the
summary endpoint omits transaction/investment detail. Flipping before step 3 would
empty the spending charts. Gating keeps prod premium and makes the cutover a
deliberate, reversible step. The page itself is already cutover-ready (step 2).
