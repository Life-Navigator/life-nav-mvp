# R-3 Slice 3A — Test Results

**27 client contract tests passing.** `pnpm verify` fully green (web lint + type-check + unit,
core-api, worker + drift gates).

**EVIDENCE BOUNDARY: transport is MOCKED.** Component/contract evidence only — **not**
deployed-browser evidence. Nothing here says the deployed system behaves this way.

## Coverage

| Area                                                                          | Tests | Result |
| ----------------------------------------------------------------------------- | ----- | ------ |
| Request contract — exactly `turn_id` + `category`                             | 3     | ✅     |
| **Hostile input: 11 forged fields never forwarded**                           | 1     | ✅     |
| No client-side `turn_id` generation                                           | 1     | ✅     |
| All seven categories                                                          | 7     | ✅     |
| Category allowlist + labels                                                   | 3     | ✅     |
| Explanation validation (limit, boundary, whitespace)                          | 3     | ✅     |
| Outcome mapping (201, duplicate, 400, 401, 404, 429, 500, network, malformed) | 8     | ✅     |
| Retryability classification                                                   | 1     | ✅     |

The hostile-input test is the load-bearing one: it submits `tenant_id`, `user_id`, `model`,
`prompt_version`, `deployment_version`, `routing_result`, `policy_outcomes`, `feature_flags`,
`citations`, `severity` and `review_status` alongside a valid report, then asserts the wire body
contains **only** `turn_id` and `category`, and that neither `"attacker"` nor `"forged"` appears
anywhere in it.

## Mutation proofs — all four detected

| #         | Mutation                                                       | Result        |
| --------- | -------------------------------------------------------------- | ------------- |
| **MUT-1** | Generate `turn_id` in the browser via `crypto.randomUUID()`    | **FAILED** ✅ |
| **MUT-2** | Spread the caller object into the body (leaks tenant_id/model) | **FAILED** ✅ |
| **MUT-3** | Drop `privacy_concern` from the category allowlist             | **FAILED** ✅ |
| **MUT-4** | Treat 404 as success                                           | **FAILED** ✅ |

Reverted by **file copy from `/tmp/r3bak`**, never `git checkout` — these files were uncommitted.

## Type-check finding (real, fixed)

`pnpm verify` caught that `chatClient.SendResult` (`lib/chat/client.ts`) is a **different type**
from `send-server.ts`'s `SendResult`. Extending only the latter left
`CommandCenter.tsx:465` with `TS2339: Property 'turn_id' does not exist`. Both were extended.

Worth noting: **the type-checker found this, not a test.** A JS-only change would have shipped a
silently-undefined `turn_id` and made every response unreportable at runtime.

## Slice 3C — action, dialog, accessibility (41 tests)

| Area                                                                       | Tests |
| -------------------------------------------------------------------------- | ----- |
| Seven categories submitted with the correct turn id                        | 7     |
| Only three allowed fields on the wire                                      | 1     |
| Explanation optional / validation / category required                      | 3     |
| Success + report reference, duplicate explanation                          | 2     |
| Double-submit prevention (via in-flight guard, not the disabled attribute) | 1     |
| Failure states: 400/401/404/429/5xx/network                                | 6     |
| **Explanation preserved across a recoverable failure**                     | 1     |
| Stale response after unmount                                               | 1     |
| Privacy: no traces/prompts/model config/turn id rendered                   | 2     |
| Dialog semantics, group label, per-option labels                           | 2     |
| Focus entry, Escape, Escape-blocked-while-submitting, focus restoration    | 4     |
| **jest-axe: initial, validation, success, error/retry**                    | 4     |
| Action visibility (turn id present / legacy / empty)                       | 3     |
| Missing-turn diagnostics + payload privacy                                 | 4     |
| Per-message binding                                                        | 2     |

**Zero serious/critical axe findings** across all four dialog states.

## Slice 3C mutation proofs

| #   | Mutation                                 | Result                       |
| --- | ---------------------------------------- | ---------------------------- |
| M-1 | Action appears without                   | **2 failed** ✅              |
| M-2 | Repeated submits create two requests     | **1 failed** ✅ _(see note)_ |
| M-3 | Dialog accessible name removed           | **5 failed** ✅              |
| M-4 | Focus restoration removed                | **1 failed** ✅              |
| M-5 | Recoverable error clears the explanation | **1 failed** ✅              |
| M-6 | Internal turn id rendered to the user    | **1 failed** ✅              |

**M-2 initially did NOT fail.** The first version of the double-submit test clicked the button,
whose attribute already blocked the second click — so the test passed whether or not the
in-flight guard existed. It now submits the **form** directly, bypassing , and the
mutation is detected. Recorded because a test that cannot fail is worse than no test.

## Not tested in this slice

Dialog behaviour, focus management, accessibility, browser E2E, streamed-response lifecycle,
multi-turn binding. **No UI was built** — that is slice 3B.
