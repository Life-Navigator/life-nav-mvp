-- 164_chat_command_center.sql
--
-- Advisor Chat Command Center — extends the existing `chat` schema (migration 111) into a
-- ChatGPT-style surface: projects, agent selection, per-message agent + citations.
--
-- We EXTEND rather than create a parallel life.chat_* schema: chat.conversations already IS the
-- thread table (with RLS owner-read + service-write, public views, and the /api/conversations API),
-- so duplicating it would orphan existing history. Naming map:
--   chat.conversations  == "threads"   (spec: chat_threads)
--   chat.messages       == messages    (spec: chat_messages)
--   chat.projects       == NEW         (spec: chat_projects)
--
-- Idempotent (IF NOT EXISTS / OR REPLACE) so re-applies are safe.

-- ---------------------------------------------------------------------------
-- 1. projects
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat.projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  domain      TEXT,                                  -- optional domain hint (career/finance/...)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chat_projects_user
  ON chat.projects (user_id, updated_at DESC);

-- ---------------------------------------------------------------------------
-- 2. thread (conversation) columns: project, mode, selected agent, lifecycle
-- ---------------------------------------------------------------------------
ALTER TABLE chat.conversations
  ADD COLUMN IF NOT EXISTS project_id     UUID REFERENCES chat.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mode           TEXT NOT NULL DEFAULT 'advisor',
  ADD COLUMN IF NOT EXISTS selected_agent TEXT,
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS archived_at    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_chat_conversations_project
  ON chat.conversations (project_id, last_message_at DESC);

-- ---------------------------------------------------------------------------
-- 3. message columns: which agent answered + structured citations
-- ---------------------------------------------------------------------------
ALTER TABLE chat.messages
  ADD COLUMN IF NOT EXISTS agent     TEXT,
  ADD COLUMN IF NOT EXISTS citations JSONB NOT NULL DEFAULT '[]';

-- ---------------------------------------------------------------------------
-- 4. RLS for projects — owner-only reads, service-role writes (matches 111)
-- ---------------------------------------------------------------------------
ALTER TABLE chat.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proj_owner_select ON chat.projects;
DROP POLICY IF EXISTS proj_service      ON chat.projects;

CREATE POLICY proj_owner_select ON chat.projects
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY proj_service ON chat.projects
  FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- ---------------------------------------------------------------------------
-- 5. Grants — match migration 111
-- ---------------------------------------------------------------------------
GRANT SELECT                          ON chat.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE  ON chat.projects TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Refresh public views (security_invoker preserved by 113/114 default)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.chat_projects AS
  SELECT id, user_id, name, description, domain, created_at, updated_at, archived_at
  FROM chat.projects;

CREATE OR REPLACE VIEW public.chat_conversations AS
  SELECT id, user_id, project_id, title, mode, selected_agent,
         last_message_at, message_count, metadata, created_at, updated_at, archived_at
  FROM chat.conversations;

CREATE OR REPLACE VIEW public.chat_messages AS
  SELECT id, conversation_id, user_id, role, content, agent, citations,
         governance_audit_id, metadata, created_at
  FROM chat.messages;

GRANT SELECT ON public.chat_projects, public.chat_conversations, public.chat_messages TO authenticated;
