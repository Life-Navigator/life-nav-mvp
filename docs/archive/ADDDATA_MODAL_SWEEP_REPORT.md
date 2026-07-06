# AddDataModal Sweep Report

Agent 1 — `components/dashboard/AddDataModal.tsx`. Traced every modal mode, wired each one to a working
endpoint with a correctly-shaped payload, surfaced real server errors, and made the modal close + refresh
on success. DB-layer validated financial / career / education with two users.

## Scope

Owned file: `apps/web/src/components/dashboard/AddDataModal.tsx` (+ permission to add a thin `/api/data/*`
route — NOT needed; all four target endpoints already exist and work, so no new route was created).

## Surfaces table

| Mode      | Modal route (caller)                                        | Endpoint                        | Method | Table                        | Status               |
| --------- | ----------------------------------------------------------- | ------------------------------- | ------ | ---------------------------- | -------------------- |
| financial | `/dashboard/finance`, `/dashboard/advisor`, DashboardClient | `/api/finance/manual-entry`     | POST   | `finance.financial_accounts` | PASS                 |
| career    | same callers                                                | `/api/career/profile`           | PUT    | `public.career_profiles`     | PASS                 |
| education | same callers                                                | `/api/education/records`        | POST   | `public.education_records`   | PASS                 |
| health    | same callers                                                | (none — gated)                  | —      | —                            | BLOCKED              |
| family    | not reachable (modal union excludes it)                     | `/api/family/[entity]` (exists) | POST   | `family.*`                   | DEPRECATED (unwired) |

## Root cause

The modal had **no inline manual-entry write path at all**. Its "Manual Input" section was a
`<Link href={config.manualInputPath}>` that merely navigated to a separate page; the modal itself never
POSTed anything. So none of the four modes actually saved data from the modal, and there was no payload /
field mapping, no error surfacing, no refresh-on-success. The integration buttons and file-upload dropzone
existed but the core "type a few fields and save" path was a dead link.

Secondary: the `domain` prop union is `financial | health | career | education` and **no caller passes
`family`**, so family is not reachable through this modal (it has its own dedicated UI). Goals are likewise
not a modal mode. Health is a gated domain with no write endpoint.

## Fixes (all in `AddDataModal.tsx`)

1. Added an inline `ManualEntryForm` rendered inside the existing "Manual Input" card for the three
   writable domains. Health keeps the `<Link>` fallback (gated, no inline write).
2. Per-domain friendly field definitions (`manualForms`) + a `manualEntryRequest()` mapper that emits the
   **exact** shape each endpoint/service expects:
   - **financial** → `POST /api/finance/manual-entry` with `{ type:'account', data:{ name, type,
institution, balance } }`. `financeService.mapEntry('account', …)` aliases these to the real columns
     (`name`→`account_name`, `type`→`account_type`, `institution`→`institution_name`,
     `balance`→`current_balance`) and whitelists them. (Earlier modal had no `type` discriminator at all —
     the endpoint requires `type` ∈ account/transaction/investment/debt or it 400s.)
   - **career** → `PUT /api/career/profile` (the route exposes **PUT**, not POST — wiring this to POST
     would 405) with `{ title, company, industry, years_of_experience, desired_title }`.
     `careerService.toProfileRow` aliases `title`→`current_title`, `company`→`current_company`, drops
     stray keys.
   - **education** → `POST /api/education/records` with `{ institution, degree_type, field_of_study, gpa,
graduation_date }`. `educationService.toRecordRow` aliases `institution`→`institution_name` (the
     NOT NULL column) and coerces `''`→`null`.
3. Real error surfacing: on a non-2xx response the form reads the server's `{ error, message }` body and
   shows `message` (the machine-readable reason from `safeApiError`), falling back to the standard
   `"We couldn't save this yet. Please check required fields and try again."` — never a blanket
   "Failed to save", never a fake success toast.
4. Refresh + close on success: the form calls a new optional `onSaved?()` prop then `onClose()`. The
   advisor caller already re-fetches coverage in its `onClose` (`loadCoverage()`), so saved data renders
   on the next mount/refresh. `onSaved` is additive and backward-compatible (no caller files edited, to
   avoid clobbering other agents).
5. Client-side required-field guard mirrors each table's NOT NULL columns (account name; education
   institution) so the user gets immediate feedback before the round-trip.

The writes themselves go through the existing routes, which use `createServerSupabaseClient()` (USER
session, never service role) and stamp `user_id` from the verified session — RLS is enforced server-side,
unchanged by this work.

## Validation evidence (DB layer, 2 users)

Ran `/tmp/validate_adddata.mjs` from `apps/web` against prod Supabase. For each surface it admin-created
userA + userB, signed both in, INSERTed (as userA, under the user JWT) the **exact row each service's
toRow mapper produces** from the modal payload, then proved RLS and cleaned up. Actual HTTP statuses:

| Surface                                  | INSERT (userA) | GET userA  | GET userB       | service-role verify | cleanup DELETE |
| ---------------------------------------- | -------------- | ---------- | --------------- | ------------------- | -------------- |
| financial → `finance.financial_accounts` | **201**        | 200, 1 row | 200, **0 rows** | 1 row               | 204            |
| career → `public.career_profiles`        | **201**        | 200, 1 row | 200, **0 rows** | 1 row               | 204            |
| education → `public.education_records`   | **201**        | 200, 1 row | 200, **0 rows** | 1 row               | 204            |

Interpretation: 201 proves table + columns + the mapper's row shape are correct; GET userA = 1 / GET
userB = 0 proves RLS isolation under the user session; service-role = 1 confirms the row really persisted;
204 confirms cleanup. All three writable modes PASS.

Modal file type-checks clean (`tsc --noEmit` reports no errors for `AddDataModal.tsx`).

## Remaining risks

- **health**: BLOCKED by design — gated domain, no write endpoint. The modal correctly does NOT wire a
  health write; it falls back to the (also-gated) manual-entry link. Do not wire until the health domain
  ships a write path.
- **family / goals**: not reachable from this modal (the `domain` union excludes them and no caller passes
  them). `/api/family/[entity]` exists and works, but adding family/goals to the modal would require
  widening the prop union and editing caller pages — out of this agent's owned-file scope. Flagged for the
  Family agent / a follow-up.
- **financial** is wired to the `account` sub-type only (the most common net-worth input). transaction /
  investment / debt sub-types are supported by the endpoint but not yet exposed as modal forms — additive
  follow-up, not a regression.
- `onSaved` is optional; current callers refresh via their existing `onClose` handlers, so financial/
  finance-page callers that don't pass `onSaved` still get fresh data on next mount but not an in-place
  re-fetch. Passing `onSaved` from those pages is a small additive improvement left to their owners.
