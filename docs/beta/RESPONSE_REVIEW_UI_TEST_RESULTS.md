# Response Review UI — Test Results

**21 client tests passing.** `pnpm verify` green. **EVIDENCE BOUNDARY: transport mocked — contract
evidence, not deployed-browser evidence.** No page components were built, so there are no axe
results for the queue or detail views.

| Area                                                          | Tests |
| ------------------------------------------------------------- | ----- |
| Queue filters, bounded pagination, empty-filter omission      | 3     |
| **Queue rows carry no snapshot or explanation**               | 1     |
| **403/401 → forbidden, never an empty queue**                 | 2     |
| Network failure distinct from denial                          | 1     |
| Detail fetch + 404                                            | 2     |
| Update sends only permitted fields                            | 1     |
| **Hostile update: 7 forged evidence/identity fields dropped** | 1     |
| Server rejection surfaces its reason                          | 1     |
| **No delete/edit-evidence/flag/suspend method exists**        | 1     |
| Transition rules mirror the server (5 statuses + 3 rules)     | 8     |

## Mutation proofs — all six detected

| #   | Mutation                                          | Result                       |
| --- | ------------------------------------------------- | ---------------------------- |
| M-1 | 403 treated as an empty queue                     | **2 failed** ✅              |
| M-2 | A delete method is added                          | **1 failed** ✅              |
| M-3 | Update spreads the caller object (evidence leaks) | **1 failed** ✅              |
| M-4 | Invalid transition offered as available           | **1 failed** ✅              |
| M-5 | Pagination unbounded                              | **1 failed** ✅ _(see note)_ |
| M-6 | Reopen no longer requires a reason                | **1 failed** ✅              |

**M-5 initially did NOT fail.** The assertion used `toContain('limit=100')`, and the mutated URL
`limit=100000` **contains** that substring — so it passed with the clamp removed. It now parses the
query parameter and compares exactly. Recorded because this is the third substring/weak-assertion
false-negative mutation testing has caught in this programme; `toContain` on a URL is not a
sufficient assertion.
