-- 152 — Sprint 29: freshness state so reads auto-recalc when inputs change (no manual sync).
CREATE TABLE IF NOT EXISTS recommendations.sync_state (
  user_id UUID PRIMARY KEY, tenant_id UUID NOT NULL,
  signature TEXT, synced_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE recommendations.sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations.sync_state FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_sync_state ON recommendations.sync_state;
CREATE POLICY own_sync_state ON recommendations.sync_state FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
DROP POLICY IF EXISTS svc_sync_state ON recommendations.sync_state;
CREATE POLICY svc_sync_state ON recommendations.sync_state FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON recommendations.sync_state TO authenticated;
GRANT ALL ON recommendations.sync_state TO service_role;
