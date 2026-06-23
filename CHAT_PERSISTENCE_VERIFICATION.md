# CHAT PERSISTENCE VERIFICATION

**Date:** 2026-06-06
**Migration:** `supabase/migrations/111_advisor_chat_history.sql`
**Renamed from:** `107_advisor_chat_history.sql` (collided with team's `107_analytics_grants_and_persona_event.sql`).

---

## What this migration does

| Object                                              | Type   | Purpose                                                                                                                                                         |
| --------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chat` (schema)                                     | schema | Holds user-content chat tables; intentionally separate from `governance.*` so audit rows never co-mingle with message content.                                  |
| `chat.conversations`                                | table  | One row per session. Fields: `id`, `user_id` (→`profiles`), `title`, `last_message_at`, `message_count`, `metadata`, `created_at`.                              |
| `chat.messages`                                     | table  | One row per turn. Fields: `id`, `conversation_id`, `user_id`, `role` (`user`/`assistant`/`system`), `content`, `governance_audit_id`, `metadata`, `created_at`. |
| `idx_chat_conversations_user`                       | index  | `(user_id, last_message_at DESC)` — drives the sidebar's "recent sessions" list.                                                                                |
| `idx_chat_messages_conv`                            | index  | `(conversation_id, created_at ASC)` — drives playback ordering.                                                                                                 |
| `idx_chat_messages_user`                            | index  | `(user_id, created_at DESC)` — drives the user's all-up timeline.                                                                                               |
| RLS: `conv_owner_select`, `msg_owner_select`        | policy | `authenticated` can only SELECT rows where `user_id = auth.uid()`.                                                                                              |
| RLS: `conv_service`, `msg_service`                  | policy | `service_role` has unrestricted CRUD (used by `/api/agent/chat`).                                                                                               |
| `public.chat_conversations`, `public.chat_messages` | views  | PostgREST-facing views so the client never needs to know about the `chat` schema. SELECT granted to `authenticated`.                                            |

---

## Push procedure

```bash
export SUPABASE_DB_PASSWORD='<DB password>'
export SUPABASE_ACCESS_TOKEN='<fresh token>'

supabase migration list --linked
# expect: 111_advisor_chat_history.sql shown as 'remote: missing'

supabase db push --linked --include-all --dry-run -p "$SUPABASE_DB_PASSWORD"
# review output; should mention ONLY 111 and 112

supabase db push --linked --include-all -p "$SUPABASE_DB_PASSWORD"
# expect: Applying migration 111_advisor_chat_history.sql ... done
```

---

## Verification SQL (run against `lifenavigator-production`)

### 1. Schema, tables, indexes exist

```sql
SELECT nspname FROM pg_namespace WHERE nspname = 'chat';
-- expect: 1 row

SELECT relname FROM pg_class
 WHERE relnamespace = 'chat'::regnamespace
   AND relkind IN ('r','i','v')
 ORDER BY relkind, relname;
-- expect:
--   r   chat.conversations
--   r   chat.messages
--   i   idx_chat_conversations_user
--   i   idx_chat_messages_conv
--   i   idx_chat_messages_user

SELECT viewname FROM pg_views WHERE schemaname = 'public' AND viewname LIKE 'chat_%';
-- expect: chat_conversations, chat_messages
```

### 2. RLS armed + policies present

```sql
SELECT relname, relrowsecurity
  FROM pg_class
 WHERE relnamespace = 'chat'::regnamespace AND relkind = 'r';
-- expect: relrowsecurity = TRUE for both tables

SELECT polname, polcmd, polroles::regrole[]
  FROM pg_policy
 WHERE polrelid IN ('chat.conversations'::regclass, 'chat.messages'::regclass)
 ORDER BY polrelid, polname;
-- expect 4 rows:
--   conv_owner_select   r   {authenticated}
--   conv_service        *   {service_role}
--   msg_owner_select    r   {authenticated}
--   msg_service         *   {service_role}
```

### 3. Grants

```sql
SELECT grantee, table_name, privilege_type
  FROM information_schema.role_table_grants
 WHERE table_schema = 'chat'
 ORDER BY table_name, grantee, privilege_type;
-- expect for authenticated: SELECT
-- expect for service_role:  SELECT, INSERT, UPDATE, DELETE
```

### 4. Foreign keys (cascading delete on user removal)

```sql
SELECT conname, confrelid::regclass AS references,
       confdeltype                  AS on_delete
  FROM pg_constraint
 WHERE conrelid IN ('chat.conversations'::regclass, 'chat.messages'::regclass)
   AND contype  = 'f';
-- expect:
--   chat.conversations.user_id          → public.profiles    on_delete = 'c' (CASCADE)
--   chat.messages.conversation_id       → chat.conversations on_delete = 'c'
--   chat.messages.user_id               → public.profiles    on_delete = 'c'
```

---

## RLS smoke test (production-grade)

This is the test that catches accidental data leaks. Run it once after migrating.

```sql
-- as service_role (the /api/agent/chat path)
SET role service_role;

INSERT INTO chat.conversations (id, user_id, title)
VALUES ('11111111-1111-1111-1111-111111111111',
        (SELECT id FROM public.profiles LIMIT 1),
        'rls smoke A');

INSERT INTO chat.messages (conversation_id, user_id, role, content)
VALUES ('11111111-1111-1111-1111-111111111111',
        (SELECT id FROM public.profiles LIMIT 1),
        'user', 'hello');

-- Switch to an authenticated identity that is NOT the owner.
RESET role;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';

SELECT count(*) FROM public.chat_conversations;  -- expect: 0
SELECT count(*) FROM public.chat_messages;       -- expect: 0

-- Switch to the actual owner identity.
SET LOCAL request.jwt.claim.sub =
  (SELECT id::text FROM public.profiles LIMIT 1);

SELECT count(*) FROM public.chat_conversations;  -- expect: ≥ 1
SELECT count(*) FROM public.chat_messages;       -- expect: ≥ 1

-- Cleanup
RESET role;
DELETE FROM chat.conversations WHERE id = '11111111-1111-1111-1111-111111111111';
```

If the non-owner SELECT returns > 0 rows: RLS is broken — STOP, do not ship.

---

## End-to-end chat flow (after Vercel deploy)

The `/api/agent/chat` route now calls `persistChatTurn()` from
`apps/web/src/lib/chat/persistence.ts` after a successful governance/character
verdict. The expected flow on a fresh conversation:

```
[user]  POST /api/agent/chat
        body: { message: "what is my net worth?" }   (no conversationId)
            │
            ▼
        - Edge calls graphrag-query, builds prompt, calls Gemini.
        - Governance + character pass.
        - persistChatTurn() runs server-side with service role.
            ↓
        chat.conversations
          INSERT { id: <new uuid>, user_id, title: 'what is my net worth?',
                   last_message_at: now, message_count: 2 }
        chat.messages
          INSERT { role: 'user',      content: 'what is my net worth?' }
          INSERT { role: 'assistant', content: '<response>',
                   governance_audit_id: <if available>,
                   metadata: { sources, character, governance } }
            │
            ▼
        Response includes conversationId — client stashes it.

[user]  POST /api/agent/chat
        body: { message: "follow up", conversationId: <id> }
            │
            ▼
        chat.conversations
          UPDATE SET message_count = message_count + 2,
                     last_message_at = NOW()
                  WHERE id = <id>
        chat.messages
          INSERT two new rows
```

### Browser smoke test

```
1. Open the deployed app, sign in.
2. Go to /dashboard/chat
3. Type "what is my net worth?"  → send
4. Wait for assistant reply.
5. Refresh the page.

Pass conditions:
  ✓ The sidebar lists the conversation with the question as title.
  ✓ Clicking it shows both messages.
  ✓ DB inspection:
        SELECT title, message_count FROM public.chat_conversations
         WHERE user_id = <yours>;
    → 1 row, message_count = 2.
```

---

## Failure modes + fixes

| Symptom                                                                  | Diagnosis                                                                                    | Fix                                                                                                             |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `/api/agent/chat` returns 200 but no row appears in `chat.conversations` | `persistChatTurn()` not awaited, or service-role key wrong on the Edge function              | Inspect Vercel logs for the chat route; verify `SUPABASE_SERVICE_ROLE_KEY` is set on the Edge function secrets. |
| Insert fails with `permission denied for table conversations`            | RLS policies missing or `service_role` grant skipped                                         | Re-run migration 111.                                                                                           |
| Insert succeeds but client SELECT returns 0 rows                         | RLS owner-filter mismatch — `user_id` written differs from `auth.uid()`                      | Confirm the route uses the same `user_id` from the JWT, not from a request body.                                |
| `relation "public.chat_conversations" does not exist` from the client    | Views weren't created (migration partially applied)                                          | Re-run migration 111.                                                                                           |
| Anonymous user can read another user's chats                             | RLS not enabled OR policy `USING` clause wrong                                               | Run the smoke test above; check `relrowsecurity` flag.                                                          |
| `chat.conversations` row's `message_count` stays at 0 forever            | `persistChatTurn()` not incrementing — check `lib/chat/persistence.ts` for the `UPDATE` step | Add explicit `UPDATE chat.conversations SET message_count = message_count + 2`.                                 |

---

## Acceptance

```
✓ supabase migration list --linked     → 111 marked applied
✓ chat schema exists, two tables, three indexes, two views, RLS armed
✓ non-owner SELECT through public.* views returns 0 rows
✓ owner SELECT returns the inserted row
✓ POST /api/agent/chat creates a conversation row + 2 message rows
✓ Refresh of /dashboard/chat shows the conversation in the sidebar
```

When all six pass: chat persistence is production-ready.

---

End of `CHAT_PERSISTENCE_VERIFICATION.md`.
