-- 137_reporting_platform.sql — Universal Reporting Platform (Sprint 3, JSON-first).
--
-- One store every report type uses (full / financial / education / decision). A ReportDefinition
-- is persisted as content_json with a content_hash for REPRODUCIBILITY (same input -> same hash);
-- report_versions keeps history; report_shares backs governed share links (Sprint 6). 116-RLS.
-- No PDF — rendering is a later sprint that consumes content_json. Education's E3 report table is
-- left intact; this is the universal platform.

CREATE SCHEMA IF NOT EXISTS reporting;

CREATE TABLE IF NOT EXISTS reporting.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  report_type TEXT NOT NULL,                      -- full / financial / education / decision
  title TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'generated',
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,   -- the ReportDefinition
  content_hash TEXT,                                  -- sha256 of timestamp-normalized definition
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS reporting.report_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL, user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  version INTEGER NOT NULL, content_json JSONB NOT NULL, content_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS reporting.report_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL, user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE, audience TEXT,           -- advisor / parent / spouse
  redaction JSONB NOT NULL DEFAULT '{}'::jsonb,        -- field-level redaction controls
  expires_at TIMESTAMPTZ, revoked BOOLEAN NOT NULL DEFAULT false,
  accessed_count INTEGER NOT NULL DEFAULT 0, last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_user_type ON reporting.reports(user_id, report_type);
CREATE INDEX IF NOT EXISTS idx_report_versions_report ON reporting.report_versions(report_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_report_shares_token ON reporting.report_shares(token);
CREATE INDEX IF NOT EXISTS idx_report_shares_user ON reporting.report_shares(user_id);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['reports','report_versions','report_shares'] LOOP
    EXECUTE format('ALTER TABLE reporting.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE reporting.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$DROP POLICY IF EXISTS users_own_%1$s ON reporting.%1$I$p$, t);
    EXECUTE format('CREATE POLICY users_own_%1$s ON reporting.%1$I FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t);
    EXECUTE format($p$DROP POLICY IF EXISTS service_%1$s ON reporting.%1$I$p$, t);
    EXECUTE format('CREATE POLICY service_%1$s ON reporting.%1$I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON reporting.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON reporting.%I TO service_role', t);
  END LOOP;
END $$;

DROP VIEW IF EXISTS public.v_reports;
CREATE VIEW public.v_reports WITH (security_invoker = true) AS
  SELECT id, user_id, report_type, title, version, status, content_hash, created_at, updated_at
  FROM reporting.reports;
GRANT SELECT ON public.v_reports TO authenticated;

GRANT USAGE ON SCHEMA reporting TO authenticated, service_role, anon;
-- No graphrag trigger (reports are compiled artifacts, not graph entities).
