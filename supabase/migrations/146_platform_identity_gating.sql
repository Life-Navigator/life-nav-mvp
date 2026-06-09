-- 146_platform_identity_gating.sql — Platform identity + visibility (Elite Sprint 22).
-- A first-class military identity attribute + admin-access audit. Gating is enforced server-side
-- (the Core API reads military_status + the admin allow-list); the UI only reflects it. 116-RLS.
CREATE SCHEMA IF NOT EXISTS platform;

CREATE TABLE IF NOT EXISTS platform.user_settings (
  user_id UUID PRIMARY KEY, tenant_id UUID NOT NULL,
  military_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (military_status IN ('unknown','civilian','veteran','active_duty','guard_reserve','spouse_dependent','military_affiliated')),
  military_source TEXT,                          -- self_reported / document
  onboarding_military_asked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS platform.admin_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, email TEXT, endpoint TEXT NOT NULL,
  result TEXT NOT NULL,                          -- granted / denied
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE INDEX IF NOT EXISTS idx_admin_access_time ON platform.admin_access_log(accessed_at DESC);

ALTER TABLE platform.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.user_settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_own_settings ON platform.user_settings;
CREATE POLICY users_own_settings ON platform.user_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS service_settings ON platform.user_settings;
CREATE POLICY service_settings ON platform.user_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON platform.user_settings TO authenticated;
GRANT ALL ON platform.user_settings TO service_role;

ALTER TABLE platform.admin_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.admin_access_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_admin_log ON platform.admin_access_log;
CREATE POLICY service_admin_log ON platform.admin_access_log FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON platform.admin_access_log TO service_role;

GRANT USAGE ON SCHEMA platform TO authenticated, service_role, anon;
