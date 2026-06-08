-- 139_report_share_audit.sql — Advisor Sharing Platform (Sprint 6): consent ledger + audit log.
--
-- reporting.report_shares (created in 137) IS the consent ledger: each row is a grant
-- (grantor user_id, audience, redaction scope, created_at = consent time, expires_at, revoked).
-- This adds the per-access audit log + a consent `purpose` field. The public share view reads
-- via service-role server-side; the token is the only credential the recipient holds.

ALTER TABLE reporting.report_shares ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE reporting.report_shares ADD COLUMN IF NOT EXISTS report_type TEXT;

CREATE TABLE IF NOT EXISTS reporting.share_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID NOT NULL, user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  outcome TEXT NOT NULL DEFAULT 'granted',     -- granted / revoked / expired / not_found
  audience TEXT, note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb);

CREATE INDEX IF NOT EXISTS idx_share_access_share ON reporting.share_access_log(share_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_access_user ON reporting.share_access_log(user_id);

ALTER TABLE reporting.share_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporting.share_access_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_own_share_access_log ON reporting.share_access_log;
CREATE POLICY users_own_share_access_log ON reporting.share_access_log
  FOR SELECT TO authenticated USING (user_id = auth.uid());   -- owner can read their own audit trail
DROP POLICY IF EXISTS service_share_access_log ON reporting.share_access_log;
CREATE POLICY service_share_access_log ON reporting.share_access_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON reporting.share_access_log TO authenticated;
GRANT ALL ON reporting.share_access_log TO service_role;
