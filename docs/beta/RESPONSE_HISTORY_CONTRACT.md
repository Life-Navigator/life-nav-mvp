# B-25 · `turn_id` through conversation history

**Status: Implemented and tested. No schema migration required.**
Deployed verification pending. R-3 not operationally complete. NO-GO unchanged.

## The gap

`chat.messages` (`111_advisor_chat_history.sql:56`) has **no `turn_id` column and no foreign key to
`analytics.advisor_turns`**. A reloaded conversation therefore had no reportable advisor turns.

Two facts made this solvable without a migration:

1. **`chat.messages.metadata JSONB` already exists** and is already written on every assistant
   message (`metadata: { llm_status }`).
2. **`turn_id` is already in scope at the persistence call site** — `send-server.ts` computes it at
   line ~114 and calls `appendAssistantMessage` at ~165. `appendAssistantMessage` already accepts a
   `metadata` bag.

So the association is a **write of an existing field**, not a schema change. Adding a column would
have been a larger, migration-bearing change for no additional guarantee.

**No text matching was used**, per the brief. The id is the one the server issued for that turn,
carried forward — never inferred by matching response content.

## Path

```
core API _finish()          res.turn_id
  → send-server.ts:~114     const turn_id = typeof turn.turn_id === 'string' && turn.turn_id ? ... : undefined
  → send-server.ts:~169     metadata: { llm_status, ...(turn_id ? { turn_id } : {}) }
  → chat.messages.metadata  persisted
  → store.getMessages       already selects metadata
  → GET /api/chat/threads/[id]/messages   lifts turn_id out, ASSISTANT ONLY, drops the rest of metadata
  → ChatMessage.turn_id?    typed
  → CommandCenter mapper    UiMessage.turn_id
```

## Guarantees

| Requirement                                            | How                                                                                                |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Never generated in the browser                         | only ever read from `res.turn_id` / persisted metadata                                             |
| Never derived from order, timestamp or conversation id | no such code path exists                                                                           |
| User/system messages never receive one                 | the route checks `m.role === 'assistant'`                                                          |
| Legacy advisor messages stay readable                  | absent `turn_id` is simply absent — never fabricated                                               |
| Authorization unchanged                                | `getMessages` still filters `user_id` + `conversation_id`; the GET still requires `authedUserId()` |
| No other telemetry exposed                             | **the whole `metadata` bag is dropped**; only `turn_id` is lifted out                              |
| No raw model output added                              | none is stored in metadata or lifted                                                               |

The metadata-drop matters: `metadata` may hold diagnostic fields the browser has no business
seeing. Lifting one field and discarding the rest is deliberate — returning `metadata` wholesale
would have been the easier change and a quiet information leak.

## Tests — 7, all mutation-proven

`lib/chat/__tests__/historyTurnId.test.ts` covers restoration, user-message rejection,
system-message rejection, legacy readability, metadata non-leakage, multi-turn binding, and
non-string rejection.

| Mutation                                             | Result        |
| ---------------------------------------------------- | ------------- |
| History drops `turn_id`                              | **FAILED** ✅ |
| Turn id assigned to any role (user message gets one) | **FAILED** ✅ |
| Full `metadata` leaked to the client                 | **FAILED** ✅ |

## Remaining

Deployed verification: reload a conversation and confirm persisted advisor messages carry
`turn_id`; confirm user messages do not; confirm pre-existing legacy messages remain readable.
