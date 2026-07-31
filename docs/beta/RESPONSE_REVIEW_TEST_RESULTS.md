# Response Review — Test Results

**25 tests passing.** `pnpm verify` green. **EVIDENCE BOUNDARY: stores faked — contract
verification, not live-store verification.**

| Area                                                                | Tests |
| ------------------------------------------------------------------- | ----- |
| Admin inherits capability; reviewer permitted; ordinary user denied | 3     |
| **Reviewer does not become an admin**                               | 1     |
| Revoked reviewer denied                                             | 1     |
| Client role forgery impossible (signature-pinned)                   | 1     |
| Granted **and denied** both audited                                 | 1     |
| List excludes snapshots/explanation                                 | 1     |
| Detail exposes evidence, never raw output                           | 1     |
| Audit history returned on detail                                    | 1     |
| **Evidence columns unreachable** (signature-pinned)                 | 1     |
| Patches touch only 4 columns                                        | 1     |
| **No delete operation exists**                                      | 1     |
| Every mutation appends an audit event                               | 1     |
| Audit records previous → new value                                  | 1     |
| Permitted / forbidden / arbitrary transitions                       | 3     |
| Invalid severity refused                                            | 1     |
| Reopen requires a reason                                            | 1     |
| Duplicate requires a link                                           | 1     |
| **Escalation records but performs no containment**                  | 1     |
| Pagination bounded; unknown filters ignored                         | 2     |
| Transition table well-formed                                        | 1     |

## Mutation proofs — all seven detected

| #   | Mutation                                          | Result           |
| --- | ------------------------------------------------- | ---------------- |
| M-1 | Reviewer permission replaced with full-admin      | **17 failed** ✅ |
| M-2 | Any authenticated user can list reports           | **3 failed** ✅  |
| M-3 | Reviewer capability widens into `is_admin`        | **1 failed** ✅  |
| M-4 | List endpoint returns question/response snapshots | **1 failed** ✅  |
| M-5 | Status changes stop producing audit events        | **4 failed** ✅  |
| M-6 | Denied access stops being audited                 | **1 failed** ✅  |
| M-7 | Forbidden transitions allowed                     | **2 failed** ✅  |

M-1's blast radius (17 failures) is the useful signal: swapping the narrow capability for full admin
breaks nearly every test, because the reviewer identity is no longer authorized — which is exactly
the separation the capability exists to create.

## Not tested — no UI was built

Reviewer queue/detail UI, its accessibility, keyboard navigation and axe results. Recorded as B-27.
Mutations 3 (unrelated admin endpoint via UI), and all UI-layer proofs, are deferred with it.
