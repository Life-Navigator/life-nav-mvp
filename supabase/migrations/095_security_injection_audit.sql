-- ============================================================================
-- 095: Security — Prompt Injection / Untrusted Content / Tool Abuse audit
--
-- Addendum Phase 10. Persists every finding from the runtime detectors
-- so the security + governance teams have an auditable trail.
--
-- Tables:
--   security.prompt_injection_events     — one row per finding
--   security.untrusted_content_findings  — one row per extraction
--                                          flagged at ingestion time
--   security.tool_abuse_attempts         — one row per tool-call
--                                          attempt that failed the guard
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS security;

-- ---- Enum helpers --------------------------------------------------------
CREATE OR REPLACE FUNCTION security.is_severity(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$ SELECT p IN ('LOW','MODERATE','HIGH','CRITICAL') $$;

CREATE OR REPLACE FUNCTION security.is_action(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$ SELECT p IN ('ALLOW','ALLOW_WITH_SANITIZATION','QUARANTINE','REJECT','MANUAL_REVIEW') $$;

CREATE OR REPLACE FUNCTION security.is_origin(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT p IN (
    'user_prompt','uploaded_file','pdf','ocr','docx','xlsx',
    'audio_transcript','video_transcript','image_extraction',
    'web','connector','provider_note','partner_document',
    'enterprise_knowledge','system','developer'
  )
$$;

-- ---- security.prompt_injection_events ------------------------------------
CREATE TABLE IF NOT EXISTS security.prompt_injection_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  tenant_id           UUID,
  file_id             UUID,
  extraction_id       UUID,
  job_id              UUID,
  source_type         TEXT NOT NULL CHECK (security.is_origin(source_type)),
  severity            TEXT NOT NULL CHECK (security.is_severity(severity)),
  matched_category    TEXT NOT NULL,            -- e.g. 'bypass_safety'
  rule_id             TEXT NOT NULL,            -- e.g. 'pi.bypass_safety_v1'
  evidence            TEXT,                     -- redacted phrase, ≤ 160 chars
  action_taken        TEXT NOT NULL CHECK (security.is_action(action_taken)),
  input_hash          TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pie_user ON security.prompt_injection_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pie_tenant ON security.prompt_injection_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pie_severity ON security.prompt_injection_events(severity)
  WHERE severity IN ('HIGH','CRITICAL');
CREATE INDEX IF NOT EXISTS idx_pie_action ON security.prompt_injection_events(action_taken)
  WHERE action_taken IN ('REJECT','QUARANTINE');

-- ---- security.untrusted_content_findings ---------------------------------
CREATE TABLE IF NOT EXISTS security.untrusted_content_findings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  tenant_id           UUID,
  file_id             UUID,
  extraction_id       UUID,
  source_type         TEXT NOT NULL CHECK (security.is_origin(source_type)),
  highest_severity    TEXT NOT NULL CHECK (security.is_severity(highest_severity)),
  finding_count       INT NOT NULL DEFAULT 0,
  action_taken        TEXT NOT NULL CHECK (security.is_action(action_taken)),
  /** Categories matched, as an array for easy grouping. */
  categories          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  bytes_scanned       INT,
  input_hash          TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ucf_user ON security.untrusted_content_findings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ucf_severity ON security.untrusted_content_findings(highest_severity)
  WHERE highest_severity IN ('HIGH','CRITICAL');

-- ---- security.tool_abuse_attempts ----------------------------------------
CREATE TABLE IF NOT EXISTS security.tool_abuse_attempts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  tenant_id           UUID,
  tool_name           TEXT NOT NULL,              -- 'plaid.sync', 'send_email', ...
  attempted_from      TEXT NOT NULL,              -- 'retrieved_content','user_prompt','uploaded_file'
  reason_code         TEXT NOT NULL,              -- 'missing_user_intent','governance_blocked',...
  severity            TEXT NOT NULL CHECK (security.is_severity(severity)),
  evidence            TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_taa_user ON security.tool_abuse_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_taa_severity ON security.tool_abuse_attempts(severity);

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE security.prompt_injection_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.untrusted_content_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.tool_abuse_attempts        ENABLE ROW LEVEL SECURITY;

-- Owner-readable; service-role write. The security team uses the
-- service-role / a privileged role to aggregate across users.
DROP POLICY IF EXISTS pie_owner ON security.prompt_injection_events;
CREATE POLICY pie_owner ON security.prompt_injection_events
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS pie_service ON security.prompt_injection_events;
CREATE POLICY pie_service ON security.prompt_injection_events
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS ucf_owner ON security.untrusted_content_findings;
CREATE POLICY ucf_owner ON security.untrusted_content_findings
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS ucf_service ON security.untrusted_content_findings;
CREATE POLICY ucf_service ON security.untrusted_content_findings
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS taa_owner ON security.tool_abuse_attempts;
CREATE POLICY taa_owner ON security.tool_abuse_attempts
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS taa_service ON security.tool_abuse_attempts;
CREATE POLICY taa_service ON security.tool_abuse_attempts
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

GRANT SELECT ON ALL TABLES IN SCHEMA security TO authenticated;

-- ============================================================================
-- Public read views (Supabase requires a public-schema view for the
-- client SDK to read scoped rows).
-- ============================================================================
CREATE OR REPLACE VIEW public.security_prompt_injection_events    AS SELECT * FROM security.prompt_injection_events;
CREATE OR REPLACE VIEW public.security_untrusted_content_findings AS SELECT * FROM security.untrusted_content_findings;
CREATE OR REPLACE VIEW public.security_tool_abuse_attempts        AS SELECT * FROM security.tool_abuse_attempts;
GRANT SELECT ON public.security_prompt_injection_events    TO authenticated;
GRANT SELECT ON public.security_untrusted_content_findings TO authenticated;
GRANT SELECT ON public.security_tool_abuse_attempts        TO authenticated;

-- ============================================================================
-- Self-test
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'security' AND c.relname = 'prompt_injection_events'
  ) THEN RAISE EXCEPTION '095 self-test: prompt_injection_events missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'security' AND c.relname = 'untrusted_content_findings'
  ) THEN RAISE EXCEPTION '095 self-test: untrusted_content_findings missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'security' AND c.relname = 'tool_abuse_attempts'
  ) THEN RAISE EXCEPTION '095 self-test: tool_abuse_attempts missing'; END IF;
END $$;
