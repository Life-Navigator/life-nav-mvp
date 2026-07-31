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

## Not tested in this slice

Dialog behaviour, focus management, accessibility, browser E2E, streamed-response lifecycle,
multi-turn binding. **No UI was built** — that is slice 3B.
