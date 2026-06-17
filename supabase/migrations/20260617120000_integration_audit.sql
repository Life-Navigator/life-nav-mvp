-- ==========================================================================
-- 20260617120000_integration_audit.sql — Integration token-use AUDIT LOG.
--
-- GATED: apply after key rotation.
--   This migration is additive and idempotent, but it is intentionally HELD
--   from the auto-apply set until the INTEGRATION_ENCRYPTION_KEY rotation is
--   complete. The application-side audit helper (apps/web/src/lib/integrations/
--   auditLog.ts) DEGRADES GRACEFULLY: if this table does not yet exist, audit
--   inserts are swallowed and the working email/calendar/connect flows are
--   unaffected. Nothing in this file stores or references a token, refresh
--   token, auth code, secret, encryption key, or raw email body.
--
-- Records WHO did WHAT with a connected integration and whether it SUCCEEDED.
-- request_context is a small, pre-sanitized JSON blob (route, provider, status
-- code, counts) — never tokens or PII bodies.
-- RLS: owner (SELECT own rows) + service_role (full). 116-RLS pattern.
-- ==========================================================================

CREATE SCHEMA IF NOT EXISTS core;

CREATE TABLE IF NOT EXISTS core.integration_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID,
  provider TEXT NOT NULL,
  integration_id UUID,
  action TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  error_class TEXT,
  request_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_audit_user_created
  ON core.integration_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_audit_provider_action
  ON core.integration_audit_log(provider, action);

ALTER TABLE core.integration_audit_log ENABLE ROW LEVEL SECURITY;

-- Owner may read their own audit trail; they may NOT write or alter it.
DROP POLICY IF EXISTS "integration_audit_owner_select" ON core.integration_audit_log;
CREATE POLICY "integration_audit_owner_select" ON core.integration_audit_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Service role (server-side audit helper) has full access.
DROP POLICY IF EXISTS "integration_audit_service_role" ON core.integration_audit_log;
CREATE POLICY "integration_audit_service_role" ON core.integration_audit_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Service-role-only RPC the app calls. SECURITY DEFINER so it works regardless
-- of the caller's row visibility; it ONLY inserts and returns nothing useful to
-- an attacker. The app helper degrades gracefully if this RPC is absent.
CREATE OR REPLACE FUNCTION core.log_integration_event(
  p_user_id UUID,
  p_provider TEXT,
  p_action TEXT,
  p_success BOOLEAN DEFAULT true,
  p_tenant_id UUID DEFAULT NULL,
  p_integration_id UUID DEFAULT NULL,
  p_error_class TEXT DEFAULT NULL,
  p_request_context JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, public
AS $$
BEGIN
  IF p_user_id IS NULL OR coalesce(p_provider, '') = '' OR coalesce(p_action, '') = '' THEN
    -- Never throw: a malformed audit call must not break the working flow.
    RETURN;
  END IF;

  INSERT INTO core.integration_audit_log (
    user_id, tenant_id, provider, integration_id, action, success, error_class, request_context
  ) VALUES (
    p_user_id,
    p_tenant_id,
    lower(p_provider),
    p_integration_id,
    p_action,
    coalesce(p_success, true),
    p_error_class,
    coalesce(p_request_context, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION core.log_integration_event(UUID, TEXT, TEXT, BOOLEAN, UUID, UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.log_integration_event(UUID, TEXT, TEXT, BOOLEAN, UUID, UUID, TEXT, JSONB) TO service_role;
