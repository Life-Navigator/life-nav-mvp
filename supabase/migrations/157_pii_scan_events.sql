-- 157 — Sprint 42B: log PII detections on uploads WITHOUT storing the detected values (beta safety).
CREATE TABLE IF NOT EXISTS documents.pii_scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  doc_type TEXT, categories JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {category: count} — counts only, never values
  acknowledged BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE documents.pii_scan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents.pii_scan_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_pii ON documents.pii_scan_events;
CREATE POLICY own_pii ON documents.pii_scan_events FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
DROP POLICY IF EXISTS svc_pii ON documents.pii_scan_events;
CREATE POLICY svc_pii ON documents.pii_scan_events FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT, INSERT ON documents.pii_scan_events TO authenticated;
GRANT ALL ON documents.pii_scan_events TO service_role;
