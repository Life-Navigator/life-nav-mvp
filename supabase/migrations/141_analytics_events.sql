-- 141_analytics_events.sql — Beta instrumentation (Sprint 9).
-- A lightweight event ledger for the funnel (onboarding / decisions / reports / shares /
-- retention). Owner-scoped (RLS) so a user only writes/reads their own events; the Executive
-- Dashboard aggregates platform-wide via service-role (COUNTS only — no PII, no event props
-- surfaced in aggregates). No raw account/PII data is ever stored in props.
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  event_type TEXT NOT NULL,        -- onboarding_step / decision_generated / report_generated / share_created / login / domain_viewed
  domain TEXT,                     -- finance/health/career/education/family/decision/...
  props JSONB NOT NULL DEFAULT '{}'::jsonb,   -- non-PII metadata only (counts, types, status)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE INDEX IF NOT EXISTS idx_events_user ON analytics.events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON analytics.events(event_type, created_at DESC);

ALTER TABLE analytics.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_own_events ON analytics.events;
CREATE POLICY users_own_events ON analytics.events FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS service_events ON analytics.events;
CREATE POLICY service_events ON analytics.events FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT, INSERT ON analytics.events TO authenticated;
GRANT ALL ON analytics.events TO service_role;

GRANT USAGE ON SCHEMA analytics TO authenticated, service_role, anon;
