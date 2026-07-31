# Response Review Workflow

**B-23 implemented, automated-test verified. UI not built — see §6. R-3 implementation complete
except the reviewer UI; operational verification pending. Beta NO-GO unchanged.**

## APIs

| Endpoint                                          | Purpose                                                   |
| ------------------------------------------------- | --------------------------------------------------------- |
| `GET /v1/analytics/admin/response-reports`        | queue: bounded pagination (max 100) + 7 filters           |
| `GET /v1/analytics/admin/response-reports/{id}`   | one report's evidence + audit history                     |
| `PATCH /v1/analytics/admin/response-reports/{id}` | assignment, severity, status, note, duplicate, escalation |

**There is no DELETE endpoint** — enforced by absence.

## Data exposed vs excluded

**List returns queue columns only** — `report_id, turn_id, category, severity, review_status,
assigned_to, created_at, deployment_version, prompt_version, model_name, duplicate_of`.

**Deliberately excluded from the list:** question snapshot, response snapshot, explanation. A queue
is a scanning surface; returning every reporter's question would make it a bulk disclosure surface.
Snapshots require opening one report deliberately.

**Never returned anywhere:** `llm_response_raw` (not in the table at all), hidden reasoning,
unrelated conversation turns, arbitrary tenant records, secrets, unrelated profile data.

## Immutability — by construction

`update_review` builds its patch from four named columns: `assigned_to`, `severity`,
`review_status`, `duplicate_of`. Evidence columns are **unreachable**, not "rejected" — no request
shape can edit a question snapshot, reporter, tenant, turn id, category, explanation or timestamp.
A test asserts the exact parameter set.

## State machine

```
new           → investigating | dismissed | duplicate
investigating → resolved | dismissed | duplicate
resolved      → investigating   (reopen: REASON REQUIRED)
dismissed     → investigating   (reopen: REASON REQUIRED)
duplicate     → investigating   (reopen: REASON REQUIRED)
```

Arbitrary status strings are refused. `duplicate` requires `duplicate_of`. Severity is bounded to
five values.

## Audit history

`feedback.advisor_report_events` — append-only, one row per mutation, carrying event id, report id,
actor email, action, previous value, new value, note, timestamp. No UPDATE or DELETE path exists in
the application contract. The report row holds immutable evidence; this holds what reviewers did.

## Escalation

A reviewer can **record** an escalation (`action: escalated`) to the beta incident owner. The
capability performs **no containment**: no method exists to disable a model, change a prompt or
policy, touch a feature flag, suspend a user, or administer cohorts. A test asserts no such method
name exists on the service.

**The beta incident owner is not named.** Audit finding R-4 remains open, and this workflow does not
claim otherwise.

## 6. Reviewer UI — NOT built

The APIs, authorization, state machine and audit history are complete and tested. **The reviewer
queue and detail UI were not built in this slice** — I reached the end of the working budget after
the backend and its mutation proofs.

Recorded as **B-27**. The backend contract it needs is stable and tested, so it is a clean pickup.
