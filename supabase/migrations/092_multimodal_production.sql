-- ==========================================================================
-- 092: Multimodal Production — malware scans + telemetry + cost meter
--
-- Sprint N.1 extends ingestion with:
--   1. ingestion.malware_scans — append-only scan record per file_version
--   2. ingestion.extraction_telemetry — per-(file, extractor) timing +
--      success/failure for the observability runbook
--   3. ingestion.multimodal_cost_meter — per-call cost in micro-USD for
--      OCR (per page), audio (per minute), video (per minute), PDF (per doc),
--      and the BYOM model calls
-- ==========================================================================

-- ---- Enums --------------------------------------------------------------

CREATE OR REPLACE FUNCTION ingestion.is_scanner(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('clamav','virustotal','manual','none')
$$;

CREATE OR REPLACE FUNCTION ingestion.is_telemetry_status(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('started','succeeded','partial','failed','deferred','timed_out','cancelled')
$$;

CREATE OR REPLACE FUNCTION ingestion.is_cost_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('pdf_doc','ocr_page','audio_minute','video_minute','vision_call','speech_call','video_call','llm_call','storage_gb_month')
$$;


-- ---- malware_scans ------------------------------------------------------

CREATE TABLE IF NOT EXISTS ingestion.malware_scans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_id         UUID NOT NULL REFERENCES ingestion.files(id) ON DELETE CASCADE,
  file_version_id UUID REFERENCES ingestion.file_versions(id) ON DELETE SET NULL,
  scanner         TEXT NOT NULL CHECK (ingestion.is_scanner(scanner)),
  scanner_version TEXT,
  status          TEXT NOT NULL CHECK (ingestion.is_scan_status(status)),
  signature       TEXT,                                  -- "EICAR-Test-File" etc.
  details         JSONB NOT NULL DEFAULT '{}',
  scan_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scan_completed_at TIMESTAMPTZ,
  duration_ms     INT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ms_user ON ingestion.malware_scans(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ms_file ON ingestion.malware_scans(file_id);
CREATE INDEX IF NOT EXISTS idx_ms_infected ON ingestion.malware_scans(status) WHERE status = 'infected';


-- ---- extraction_telemetry ------------------------------------------------

CREATE TABLE IF NOT EXISTS ingestion.extraction_telemetry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id          UUID NOT NULL REFERENCES ingestion.extraction_jobs(id) ON DELETE CASCADE,
  file_id         UUID NOT NULL REFERENCES ingestion.files(id) ON DELETE CASCADE,
  extractor_name  TEXT NOT NULL,
  extractor_version TEXT NOT NULL DEFAULT '1.0.0',
  status          TEXT NOT NULL CHECK (ingestion.is_telemetry_status(status)),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  duration_ms     INT,
  pages_processed INT,
  entities_emitted INT,
  facts_emitted   INT,
  error_message   TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_et_job   ON ingestion.extraction_telemetry(job_id);
CREATE INDEX IF NOT EXISTS idx_et_user  ON ingestion.extraction_telemetry(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_et_failures ON ingestion.extraction_telemetry(status) WHERE status IN ('failed','timed_out');


-- ---- multimodal_cost_meter -----------------------------------------------

CREATE TABLE IF NOT EXISTS ingestion.multimodal_cost_meter (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  job_id          UUID REFERENCES ingestion.extraction_jobs(id) ON DELETE SET NULL,
  file_id         UUID REFERENCES ingestion.files(id) ON DELETE SET NULL,
  extractor_name  TEXT NOT NULL,
  cost_kind       TEXT NOT NULL CHECK (ingestion.is_cost_kind(cost_kind)),
  provider        TEXT,                                  -- 'gemini','openai','anthropic','azure_openai','clamav','virustotal'
  model           TEXT,
  units           NUMERIC NOT NULL CHECK (units >= 0),   -- pages, minutes, docs, calls
  unit_label      TEXT NOT NULL,                         -- 'pages','minutes','documents','calls'
  cost_usd_micros BIGINT NOT NULL DEFAULT 0 CHECK (cost_usd_micros >= 0),
  request_id      UUID,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mcm_user ON ingestion.multimodal_cost_meter(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcm_kind ON ingestion.multimodal_cost_meter(cost_kind, created_at DESC);


-- ---- File-level cloud storage columns -----------------------------------

ALTER TABLE ingestion.files
  ADD COLUMN IF NOT EXISTS storage_provider TEXT
    CHECK (storage_provider IS NULL OR storage_provider IN ('supabase','s3','gcs','azure_blob','local'));
ALTER TABLE ingestion.files
  ADD COLUMN IF NOT EXISTS retention_policy TEXT
    CHECK (retention_policy IS NULL OR retention_policy IN ('default','short','long','indefinite','legal_hold'));
ALTER TABLE ingestion.files
  ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMPTZ;
ALTER TABLE ingestion.files
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;


-- ---- RLS ----------------------------------------------------------------

ALTER TABLE ingestion.malware_scans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion.extraction_telemetry   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion.multimodal_cost_meter  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ms_owner ON ingestion.malware_scans;
CREATE POLICY ms_owner ON ingestion.malware_scans
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS ms_service ON ingestion.malware_scans;
CREATE POLICY ms_service ON ingestion.malware_scans
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS et_owner ON ingestion.extraction_telemetry;
CREATE POLICY et_owner ON ingestion.extraction_telemetry
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS et_service ON ingestion.extraction_telemetry;
CREATE POLICY et_service ON ingestion.extraction_telemetry
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS mcm_owner ON ingestion.multimodal_cost_meter;
CREATE POLICY mcm_owner ON ingestion.multimodal_cost_meter
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS mcm_service ON ingestion.multimodal_cost_meter;
CREATE POLICY mcm_service ON ingestion.multimodal_cost_meter
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON ingestion.malware_scans         TO authenticated;
GRANT SELECT ON ingestion.extraction_telemetry  TO authenticated;
GRANT SELECT ON ingestion.multimodal_cost_meter TO authenticated;


-- ---- Public views -------------------------------------------------------

CREATE OR REPLACE VIEW public.ingestion_malware_scans         AS SELECT * FROM ingestion.malware_scans;
CREATE OR REPLACE VIEW public.ingestion_extraction_telemetry  AS SELECT * FROM ingestion.extraction_telemetry;
CREATE OR REPLACE VIEW public.ingestion_multimodal_cost_meter AS SELECT * FROM ingestion.multimodal_cost_meter;
GRANT SELECT ON public.ingestion_malware_scans         TO authenticated;
GRANT SELECT ON public.ingestion_extraction_telemetry  TO authenticated;
GRANT SELECT ON public.ingestion_multimodal_cost_meter TO authenticated;


-- ---- Self-test ----------------------------------------------------------
DO $$
DECLARE rls BOOLEAN;
BEGIN
  SELECT relrowsecurity INTO rls FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'ingestion' AND c.relname = 'malware_scans';
  IF NOT rls THEN RAISE EXCEPTION '092 self-test: RLS missing on malware_scans'; END IF;
END $$;
