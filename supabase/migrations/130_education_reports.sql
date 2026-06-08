-- 130_education_reports.sql — Education report metadata store (Education E3).
--
-- Stores the structured EducationReportViewModel (9 sections + chart specs) as content_json
-- with a content_hash for REPRODUCIBILITY (same inputs -> same hash). The PDF renderer is a
-- later sprint; this is the source-of-truth structured data it will render. 116-RLS pattern.
-- No graphrag trigger (a report is a compiled artifact, not a graph entity for E3).

CREATE TABLE IF NOT EXISTS education.education_comparison_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  title TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'education_comparison',
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'generated',
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,   -- the full 9-section report + charts
  content_hash TEXT,                                  -- sha256 of timestamp-normalized content (reproducibility)
  pdf_url TEXT,                                        -- null until the renderer sprint
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE INDEX IF NOT EXISTS idx_e_reports_user ON education.education_comparison_reports(user_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_e_reports_hash ON education.education_comparison_reports(content_hash);

ALTER TABLE education.education_comparison_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE education.education_comparison_reports FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_own_education_comparison_reports ON education.education_comparison_reports;
CREATE POLICY users_own_education_comparison_reports ON education.education_comparison_reports
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS service_education_comparison_reports ON education.education_comparison_reports;
CREATE POLICY service_education_comparison_reports ON education.education_comparison_reports
  FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON education.education_comparison_reports TO authenticated;
GRANT ALL ON education.education_comparison_reports TO service_role;

-- security_invoker read view (metadata, no raw content dump in the list)
DROP VIEW IF EXISTS public.v_education_reports;
CREATE VIEW public.v_education_reports WITH (security_invoker = true) AS
  SELECT id, user_id, title, report_type, version, status, content_hash, pdf_url,
         generated_at, created_at, updated_at
  FROM education.education_comparison_reports;
GRANT SELECT ON public.v_education_reports TO authenticated;
