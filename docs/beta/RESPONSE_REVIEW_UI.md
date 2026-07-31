# Response Review UI — reviewer client and proxies (B-27, partial)

**Implemented: typed reviewer client + authorized Next proxies, 21 tests, 6 mutations proven.**
**Not implemented: the queue and detail React pages.** See §5.
**Deployed reviewer authorization: pending. R-3 operational verification: pending. NO-GO unchanged.**

## Files added

| File                                           | Role                                                          |
| ---------------------------------------------- | ------------------------------------------------------------- |
| `app/api/admin/response-reports/route.ts`      | queue proxy — forwards JWT, **filter allowlist**              |
| `app/api/admin/response-reports/[id]/route.ts` | detail + PATCH proxy — **field allowlist**, no DELETE handler |
| `lib/admin/responseReview.ts`                  | typed client                                                  |

Both proxies mirror the established `app/api/admin/pilot-analytics` pattern: forward the Supabase
JWT, and **pass a 403 straight through** so the UI can render an honest denial.

## Authorization posture

The route may eventually be hidden from navigation for non-reviewers, but **hiding is never
authorization** — the proxies forward to a Core API endpoint gated by
`can_review_advisor_responses`, so requesting the URL directly is refused upstream. The client has
no capability logic at all.

**403 is surfaced as `forbidden`, never as an empty queue.** Collapsing a denial into "no reports"
would hide an authorization failure behind a plausible empty state — which is precisely how a broken
gate goes unnoticed. Mutation M-1 proves the distinction is tested.

## Client contract

`listReports(filters, page)` · `getReport(id)` · `updateReport(id, update)` — **and nothing else.**

There is deliberately **no** method for deleting a report, editing evidence, changing a
reporter/tenant/turn/category, touching feature flags, prompts, models, cohorts, or suspending a
user. A test pins the exported function list, so adding one fails the suite.

`updateReport` builds its body **field-by-field, never spread**, so a caller object carrying
`question_snapshot` or `turn_id` cannot reach the wire. The PATCH proxy applies the same allowlist
independently — defence in depth.

Pagination is clamped to 100 client-side; the server clamps independently.

Transition rules (`nextStatuses`, `requiresReason`) mirror the server table so the UI can offer only
valid next states — but they are **advisory**. The server re-validates every transition, and a
server rejection surfaces its reason rather than being swallowed.

## Data deliberately excluded

Queue rows carry no question snapshot, response snapshot or explanation — the API minimizes, and a
test pins the client's expectation so a widened response becomes visible. `llm_response_raw` is not
in the report table at all and cannot appear anywhere.

## 5. What was not built

The React queue and detail **pages**. I reached the end of the working budget after the client,
proxies and mutation proofs.

What remains: a `/dashboard/response-reports` page following the proven
`pilot-analytics` pattern (`loading | ready | forbidden | error`), a filter bar, a paginated table
of minimized rows, a detail view distinguishing user-submitted content from preserved evidence from
reviewer notes, transition controls driven by `nextStatuses`, and axe coverage on those states.

The client contract underneath is stable, tested and mutation-proven, so this is a clean pickup.
Recorded as **B-29**.
