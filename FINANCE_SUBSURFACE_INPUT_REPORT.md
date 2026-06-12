# Finance Subsurface Input Sweep — Agent 2

Scope: data-entry save paths for the finance subpages (assets, investments, retirement,
insurance/estate, tax, transactions, accounts) and the `/add` manual-entry hub. Owned files:
`apps/web/src/lib/services/financeService.ts` + the finance subpages/routes. The finance
write path runs through the canonical `finance.*` tables under the authenticated USER session
(RLS: `auth.uid() = user_id`). No fake rows; no service-role for user writes.

## Surfaces table

| Surface                         | Route (page)                    | Endpoint                                          | Canonical table                            | Status     |
| ------------------------------- | ------------------------------- | ------------------------------------------------- | ------------------------------------------ | ---------- |
| Account entry                   | /dashboard/finance/add          | POST /api/finance/manual-entry (type=account)     | finance.financial_accounts                 | PASS       |
| Transaction entry               | /dashboard/finance/add          | POST /api/finance/manual-entry (type=transaction) | finance.transactions                       | PASS       |
| Investment (add page)           | /dashboard/finance/add          | POST /api/finance/manual-entry (type=investment)  | finance.investment_holdings                | PASS       |
| Debt (add page)                 | /dashboard/finance/add          | POST /api/finance/manual-entry (type=debt)        | finance.financial_accounts (debt-type)     | PASS       |
| Assets                          | /dashboard/finance/assets       | POST /api/assets                                  | finance.assets                             | PASS       |
| Investments (holdings)          | /dashboard/finance/investments  | POST /api/investments/holdings                    | finance.investment_holdings                | PASS       |
| Retirement (manual balance)     | (mapper, /add or programmatic)  | POST /api/finance/manual-entry (type=retirement)  | finance.financial_accounts type=retirement | PASS       |
| Accounts page "Add Account"     | /dashboard/finance/accounts     | (Plaid Connect modal — stub)                      | n/a                                        | DEPRECATED |
| Tax (profile/income/calc)       | /dashboard/finance/tax          | /api/tax/\*                                       | finance.tax_profiles, etc.                 | NOT_READY  |
| Retirement page (plans/SS/etc.) | /dashboard/finance/retirement   | /api/retirement/\*                                | finance.retirement_plans                   | NOT_READY  |
| Insurance / Estate (legacy)     | /dashboard/finance/legacy       | GET /api/financial/legacy                         | n/a (read-only display)                    | NOT_READY  |
| Transactions page               | /dashboard/finance/transactions | /api/financial (read)                             | n/a (no add form)                          | DEPRECATED |

## Root causes found

1. **Assets POST returned 400 on every valid submit.** `/api/assets` POST validated
   `body?.value == null`, but the Add-Asset form sends `currentValue` (never `value`). Every
   asset save failed with a hardcoded 400 `{error:'name and value are required'}`, and the form
   showed a blanket "Failed to create asset". Classic alias mismatch.
2. **Investments "Add Holding" posted to a route that did not exist.** The form POSTs
   `/api/investments/holdings`; only `/api/investments/analytics` existed → 404 on every save.
   The analytics endpoint deliberately returns `holdings: []`, so the page had no working
   position-level write path at all.
3. **`/add` investment & debt forms were dead stubs** ("coming soon"), even though the service
   could already map them and the manual-entry route accepts those types.
4. **Service had no `asset` / `retirement` mappers**, so there was no canonical, whitelisted path
   for those two entity types through the shared service.
5. **Error handling leaked DB internals / hid the reason.** `/api/assets` returned
   `error.message` directly (schema/column leakage) and the form surfaced a blanket failure.

## Fixes applied

- **financeService.ts (extended, owned):**
  - Added entry types `asset` and `retirement`.
  - `investment` mapper now accepts the Investments-page aliases (`ticker`→symbol uppercased,
    `costBasis`→cost_basis) AND the `/add`-page aliases (`symbol`, `purchasePrice`); whitelists
    to the real `finance.investment_holdings` columns; computes `current_value = qty*price`.
  - `asset` mapper → `finance.assets` (asset_name/asset_type-normalized/current_value/...).
  - `retirement` mapper → `finance.financial_accounts` with `account_type='retirement'` so it
    feeds the net-worth resolver's retirement bucket (one source of truth, no fake rows).
  - `listFinanceEntries` now routes `asset`→assets and `account|debt|retirement`→financial_accounts.
- **/api/finance/manual-entry/route.ts:** TYPES extended to include `asset` and `retirement`.
- **/api/assets/route.ts:** accept `currentValue` (and legacy `value`) alias; coerce `''`→null
  for optional numbers; replaced raw `error.message` with `safeApiError` (validation_failed /
  db_persistence_error) carrying route+table+code in server logs.
- **/api/investments/holdings/route.ts (new thin route):** GET lists the user's holdings; POST
  validates ticker+positive shares, then writes via `createFinanceEntry(..., 'investment', ...)`
  under the USER session. Explicit `safeApiError` responses.
- **/add page:** built real investment + debt forms (replacing stubs); removed the submit-disable
  gate for those types; error message follows the standard.
- **assets/page.tsx:** modal now has an error state and renders the server's machine-readable
  reason; the page-level handler surfaces the server message instead of "Failed to create asset".
- **investments/page.tsx:** add-holding handler surfaces `message`/`error` from the response.

## Validation evidence (DB layer, two users)

Ran `/tmp/finance_sub_validate.mjs` — admin-created userA + userB, signed both in (password
grant), and INSERTed the EXACT rows the `toRow` mappers produce via PostgREST with
`Content-Profile: finance` under userA's token, then GET as both users, then cleaned up
(rows + users deleted). Actual HTTP statuses:

```
users created A= e29ff2a3-... B= 7d6ac580-...
ASSET insert: 201            ASSET RLS       userA sees: 1 | userB sees: 0
HOLDING insert: 201          HOLDING RLS     userA sees: 1 | userB sees: 0
ACCOUNT insert: 201          ACCOUNT RLS     userA sees: 1 | userB sees: 0
RETIREMENT insert: 201
TRANSACTION insert: 201      TRANSACTION RLS userA sees: 1 | userB sees: 0
cleanup done; rows deleted: 5
```

- finance.assets — 201 created, RLS isolated (A=1, B=0).
- finance.investment_holdings — 201 created, RLS isolated.
- finance.financial_accounts (account + retirement type) — 201 created, RLS isolated.
- finance.transactions (FK account_id to the inserted account) — 201 created, RLS isolated.

`npx tsc --noEmit` on the web app: no errors in any edited file. (3 pre-existing TS2339 errors
at investments/page.tsx:300-302 — `peRatio`/`fiftyTwoWeekHigh`/`fiftyTwoWeekLow` in the
holding-detail render — are unrelated to this sweep and outside my diff.)

## Remaining risks / not done

- **Tax page (NOT_READY):** `/api/tax/profile`, `/api/tax/income`, `/api/tax/calculate`,
  `/api/tax/optimizations` do not exist; every tax write/read 404s. This is a large surface
  (profile + income persistence + a tax calculator) — out of scope for a thin-route fix and
  needs its own dedicated service + routes against `finance.tax_profiles` (and an income table).
  Not faked as PASS.
- **Retirement page (NOT_READY):** `/api/retirement/plans`, `/api/retirement/withdrawal-strategies`,
  `/api/retirement/roth-conversions`, etc. do not exist. The canonical retirement _balance_ path
  now works (type=retirement → financial_accounts); the full retirement-planning surface
  (finance.retirement_plans + strategy calculators) is a separate build.
- **Insurance / Estate (legacy page, NOT_READY):** read-only display reading
  `/api/financial/legacy` (which does not exist → empty state). No data-entry forms exist on this
  page; there is no canonical insurance/estate table in 031/117 to write to. Honestly an empty
  state, not a save bug.
- **Accounts page "Add Account" (DEPRECATED):** the Connect modal `handleConnectAccount` is a
  `console.log` stub. The working manual account-entry path is `/add` → manual-entry; recommend
  pointing this button at `/dashboard/finance/add` or wiring it to the same endpoint.
- **Transactions page (DEPRECATED for input):** read-only; manual transaction entry lives on
  `/add`.
- The new holding form does not yet link the holding to a specific `account_id` (account name is
  accepted but not resolved to an account row). Holdings still persist correctly and show under
  the user; account linkage is a follow-up.
