-- 107_advisor_chat_history.sql
--
-- Chat history persistence for the user-facing advisor.
--
-- Before this migration there was no place to read past conversations from.
-- /api/agent/chat threaded a conversation_id end-to-end but never persisted
-- the messages, so a user could not (a) list their past sessions, (b) resume
-- a session, or (c) see "what did the advisor say last week?"
--
-- The chat page (apps/web/src/app/dashboard/chat) needs:
--
--   * SELECT * FROM chat.conversations WHERE user_id = auth.uid()
--     → list of past sessions, most recent first
--   * SELECT * FROM chat.messages WHERE conversation_id = $1 AND user_id = auth.uid()
--     → playback of one session
--
-- Notes:
--   * The `chat` schema is intentionally separate from `governance.*` (Sprint
--     L2/N.3) because governance audit rows must NOT carry user content; this
--     table does. The governance audit row remains the verdict log; this one
--     is the message log.
--   * `metadata` carries the model-level data (sources, character verdict,
--     governance verdict, conversation stage if part of onboarding).
--   * RLS forces owner-only reads + service-role writes. The /api/agent/chat
--     route writes server-side via the service-role path so the user's
--     anon-key client can never insert directly.
--   * Conversations are not soft-deleted because we want clean GDPR removal;
--     cascade on user delete is fine — chat history is owned data, not audit.

CREATE SCHEMA IF NOT EXISTS chat;

-- ---------------------------------------------------------------------------
-- 1. conversations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat.conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  /** First-line summary; nullable so the API can fill it lazily after the
      first user message. Capped at 120 chars in the route to keep listings
      tidy. */
  title           TEXT,
  /** When the most recent message in this conversation was sent. Used for
      ordering the sidebar list. Mirrors the latest messages.created_at. */
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_count   INT NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user
  ON chat.conversations (user_id, last_message_at DESC);

-- ---------------------------------------------------------------------------
-- 2. messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat.messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES chat.conversations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content          TEXT NOT NULL,
  /** Optional link back to the governance audit row that approved this
      message. Lets the chat UI surface the verdict + character score next to
      the message without re-running governance. */
  governance_audit_id UUID,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv
  ON chat.messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user
  ON chat.messages (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. RLS — owner-only reads, service-role writes
-- ---------------------------------------------------------------------------
ALTER TABLE chat.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat.messages      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conv_owner_select   ON chat.conversations;
DROP POLICY IF EXISTS conv_service        ON chat.conversations;
DROP POLICY IF EXISTS msg_owner_select    ON chat.messages;
DROP POLICY IF EXISTS msg_service         ON chat.messages;

CREATE POLICY conv_owner_select ON chat.conversations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY conv_service ON chat.conversations
  FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY msg_owner_select ON chat.messages
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY msg_service ON chat.messages
  FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- ---------------------------------------------------------------------------
-- 4. Grants — match the pattern from migration 105
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA chat TO service_role, authenticated;

GRANT SELECT                          ON ALL TABLES   IN SCHEMA chat TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE  ON ALL TABLES   IN SCHEMA chat TO service_role;
GRANT USAGE, SELECT                   ON ALL SEQUENCES IN SCHEMA chat TO service_role, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Public views so PostgREST can serve them without exposing the schema
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.chat_conversations AS
  SELECT id, user_id, title, last_message_at, message_count, metadata, created_at
  FROM chat.conversations;

CREATE OR REPLACE VIEW public.chat_messages AS
  SELECT id, conversation_id, user_id, role, content, governance_audit_id, metadata, created_at
  FROM chat.messages;

GRANT SELECT ON public.chat_conversations TO authenticated;
GRANT SELECT ON public.chat_messages      TO authenticated;
