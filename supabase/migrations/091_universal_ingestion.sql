-- ==========================================================================
-- 091: Universal Multimodal Ingestion & Knowledge Extraction
--
-- Sprint N adds a dedicated `ingestion` schema with the full provenance
-- chain:
--
--    files
--      └ file_versions
--      └ extraction_jobs                   -- pipeline orchestrator state
--            └ extractions                 -- raw text/transcript/blocks
--                  └ extracted_entities    -- candidate graph nodes
--                  └ extracted_relationships
--                  └ extracted_facts       -- atomic claims
--                        └ provenance      -- file + page + locator + confidence
--
-- The schema is the SOURCE OF TRUTH for ingestion state. The Personal
-- GraphRAG receives entities + relationships via the existing
-- `graphrag.enqueue_sync(...)` helper — the migration extends the
-- shared sync trigger function so an extracted_fact upsert fans out
-- automatically.
--
-- Provenance is mandatory. The CHECK constraints on extracted_facts
-- require source_file_id + locator + extraction_confidence.
-- ==========================================================================

CREATE SCHEMA IF NOT EXISTS ingestion;
GRANT USAGE ON SCHEMA ingestion TO authenticated, service_role;

-- ###########################################################################
-- Enums
-- ###########################################################################

CREATE OR REPLACE FUNCTION ingestion.is_file_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN (
    'pdf','docx','doc','txt','rtf','md',
    'xlsx','xls','csv','pptx','ppt',
    'odt','ods','odp',
    'json','xml','html',
    'jpg','png','webp','tiff','heic',
    'mp3','wav','m4a','aac','flac',
    'mp4','mov','avi','mkv','webm',
    'other','unknown'
  )
$$;

CREATE OR REPLACE FUNCTION ingestion.is_file_modality(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('document','spreadsheet','presentation','structured','image','audio','video','other')
$$;

CREATE OR REPLACE FUNCTION ingestion.is_scan_status(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('pending','clean','infected','skipped','error')
$$;

CREATE OR REPLACE FUNCTION ingestion.is_job_status(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('queued','running','succeeded','partial','failed','deferred','cancelled')
$$;

CREATE OR REPLACE FUNCTION ingestion.is_extraction_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN (
    'plain_text','rich_text','table','tabular','json_tree','xml_tree',
    'ocr_text','transcript','scene_summary','frame_ocr','object_list',
    'pdf_text','pdf_table','docx_blocks','spreadsheet_sheet','presentation_slide'
  )
$$;

CREATE OR REPLACE FUNCTION ingestion.is_entity_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN (
    'person','organization','location','address','phone','email',
    'date','amount_usd','account_number_masked',
    'bank_account','credit_card_last4','investment_holding',
    'medical_provider','medical_condition','medication','lab_result','vaccination',
    'icd10_code','cpt_code','npi','insurance_carrier','insurance_plan',
    'policy_number','group_number','member_id',
    'employer','payroll_period','w2_box','paystub_line',
    'school','degree','course','certification',
    'attorney','contract_party','clause',
    'receipt_merchant','receipt_line_item',
    'document','image_object','speaker','topic','action_item',
    'other'
  )
$$;

CREATE OR REPLACE FUNCTION ingestion.is_relationship_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN (
    'employed_by','employs','spouse_of','child_of','parent_of','dependent_of',
    'covered_by','insured_under','member_of','beneficiary_of',
    'patient_of','treated_with','diagnosed_with','prescribed',
    'paid_by','paid_to','contains_charge','holds_account',
    'enrolled_in','attended','earned','certified_in',
    'mentioned_in','derived_from','authored_by','signed_by','related_to'
  )
$$;


-- ###########################################################################
-- 1. files + file_versions
-- ###########################################################################

CREATE TABLE IF NOT EXISTS ingestion.files (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name       TEXT NOT NULL,
  file_kind          TEXT NOT NULL CHECK (ingestion.is_file_kind(file_kind)),
  modality           TEXT NOT NULL CHECK (ingestion.is_file_modality(modality)),
  declared_mime      TEXT,
  detected_mime      TEXT,
  size_bytes         BIGINT NOT NULL CHECK (size_bytes >= 0),
  sha256             TEXT,                                -- content hash, hex
  storage_bucket     TEXT,
  storage_path       TEXT,
  source             TEXT NOT NULL DEFAULT 'upload'
                       CHECK (source IN ('upload','integration_sync','provider_share','migration','test')),
  source_reference   TEXT,                                -- e.g. Plaid statement id
  virus_scan_status  TEXT NOT NULL DEFAULT 'pending' CHECK (ingestion.is_scan_status(virus_scan_status)),
  virus_scan_engine  TEXT,
  virus_scan_at      TIMESTAMPTZ,
  archived_at        TIMESTAMPTZ,
  current_version_id UUID,
  metadata           JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_files_user ON ingestion.files(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_sha  ON ingestion.files(sha256);

CREATE TABLE IF NOT EXISTS ingestion.file_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id         UUID NOT NULL REFERENCES ingestion.files(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  version_number  INT  NOT NULL CHECK (version_number >= 1),
  sha256          TEXT NOT NULL,
  size_bytes      BIGINT NOT NULL CHECK (size_bytes >= 0),
  storage_bucket  TEXT,
  storage_path    TEXT,
  uploaded_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT file_version_unique UNIQUE (file_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_fv_file ON ingestion.file_versions(file_id, version_number DESC);


-- ###########################################################################
-- 2. extraction_jobs
-- ###########################################################################

CREATE TABLE IF NOT EXISTS ingestion.extraction_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_id           UUID NOT NULL REFERENCES ingestion.files(id) ON DELETE CASCADE,
  file_version_id   UUID REFERENCES ingestion.file_versions(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'queued' CHECK (ingestion.is_job_status(status)),
  pipeline_version  TEXT NOT NULL DEFAULT '1.0.0',
  routed_extractors TEXT[] NOT NULL DEFAULT '{}',
  attempts          INT NOT NULL DEFAULT 0,
  deferred_reason   TEXT,                                  -- e.g. 'vision_provider_unconfigured'
  last_error        TEXT,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jobs_user ON ingestion.extraction_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON ingestion.extraction_jobs(status);


-- ###########################################################################
-- 3. extractions — one row per (job, extractor, kind)
-- ###########################################################################

CREATE TABLE IF NOT EXISTS ingestion.extractions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id             UUID NOT NULL REFERENCES ingestion.extraction_jobs(id) ON DELETE CASCADE,
  file_id            UUID NOT NULL REFERENCES ingestion.files(id) ON DELETE CASCADE,
  extractor_name     TEXT NOT NULL,                        -- e.g. 'csv', 'plain_text', 'vision_stub'
  extractor_version  TEXT NOT NULL DEFAULT '1.0.0',
  extraction_kind    TEXT NOT NULL CHECK (ingestion.is_extraction_kind(extraction_kind)),
  page               INT,                                  -- nullable: text doc / json / etc.
  block_index        INT,
  text               TEXT,
  structured         JSONB,
  confidence         NUMERIC(3,2) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  language           TEXT,
  duration_ms        INT,
  metadata           JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_extr_job ON ingestion.extractions(job_id);
CREATE INDEX IF NOT EXISTS idx_extr_file ON ingestion.extractions(file_id);


-- ###########################################################################
-- 4. extracted_entities — candidate graph nodes
-- ###########################################################################

CREATE TABLE IF NOT EXISTS ingestion.extracted_entities (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  extraction_id      UUID NOT NULL REFERENCES ingestion.extractions(id) ON DELETE CASCADE,
  job_id             UUID NOT NULL REFERENCES ingestion.extraction_jobs(id) ON DELETE CASCADE,
  file_id            UUID NOT NULL REFERENCES ingestion.files(id) ON DELETE CASCADE,
  entity_kind        TEXT NOT NULL CHECK (ingestion.is_entity_kind(entity_kind)),
  canonical_text     TEXT NOT NULL,
  attributes         JSONB NOT NULL DEFAULT '{}',
  confidence         NUMERIC(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  graph_promoted     BOOLEAN NOT NULL DEFAULT FALSE,
  graph_entity_id    UUID,                                 -- post-promotion link
  metadata           JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ee_user_kind ON ingestion.extracted_entities(user_id, entity_kind);
CREATE INDEX IF NOT EXISTS idx_ee_extraction ON ingestion.extracted_entities(extraction_id);


-- ###########################################################################
-- 5. extracted_relationships
-- ###########################################################################

CREATE TABLE IF NOT EXISTS ingestion.extracted_relationships (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id             UUID NOT NULL REFERENCES ingestion.extraction_jobs(id) ON DELETE CASCADE,
  file_id            UUID NOT NULL REFERENCES ingestion.files(id) ON DELETE CASCADE,
  subject_entity_id  UUID NOT NULL REFERENCES ingestion.extracted_entities(id) ON DELETE CASCADE,
  object_entity_id   UUID NOT NULL REFERENCES ingestion.extracted_entities(id) ON DELETE CASCADE,
  relationship_kind  TEXT NOT NULL CHECK (ingestion.is_relationship_kind(relationship_kind)),
  attributes         JSONB NOT NULL DEFAULT '{}',
  confidence         NUMERIC(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  graph_promoted     BOOLEAN NOT NULL DEFAULT FALSE,
  metadata           JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT er_subject_neq_object CHECK (subject_entity_id <> object_entity_id)
);
CREATE INDEX IF NOT EXISTS idx_er_user ON ingestion.extracted_relationships(user_id);


-- ###########################################################################
-- 6. extracted_facts — atomic claims with mandatory provenance
-- ###########################################################################

CREATE TABLE IF NOT EXISTS ingestion.extracted_facts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id                UUID NOT NULL REFERENCES ingestion.extraction_jobs(id) ON DELETE CASCADE,
  file_id               UUID NOT NULL REFERENCES ingestion.files(id) ON DELETE CASCADE,
  extraction_id         UUID REFERENCES ingestion.extractions(id) ON DELETE SET NULL,
  subject_entity_id     UUID REFERENCES ingestion.extracted_entities(id) ON DELETE SET NULL,
  predicate             TEXT NOT NULL,                     -- machine-stable key
  object_text           TEXT,
  object_value          NUMERIC,
  object_unit           TEXT,
  object_date           DATE,
  object_jsonb          JSONB,
  language              TEXT,
  extraction_confidence NUMERIC(3,2) NOT NULL CHECK (extraction_confidence BETWEEN 0 AND 1),
  evidence_text         TEXT,                              -- short verbatim quote from the source
  -- Provenance — mandatory.
  source_locator        JSONB NOT NULL,                    -- { page, row, col, char_start, char_end, timestamp_ms, bbox, slide_index, sheet_name }
  ingested_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Validate that the locator JSON is non-empty.
  CONSTRAINT fact_locator_nonempty CHECK (jsonb_typeof(source_locator) = 'object' AND source_locator <> '{}'::jsonb)
);
CREATE INDEX IF NOT EXISTS idx_facts_user ON ingestion.extracted_facts(user_id, ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_facts_file ON ingestion.extracted_facts(file_id);
CREATE INDEX IF NOT EXISTS idx_facts_subject ON ingestion.extracted_facts(subject_entity_id);


-- ###########################################################################
-- 7. provenance — explicit per-fact record. Some teams query the
-- locator JSON directly on extracted_facts; this table is the
-- queryable normalized form for cross-document evidence aggregation.
-- ###########################################################################

CREATE TABLE IF NOT EXISTS ingestion.provenance (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fact_id               UUID NOT NULL REFERENCES ingestion.extracted_facts(id) ON DELETE CASCADE,
  source_file_id        UUID NOT NULL REFERENCES ingestion.files(id) ON DELETE CASCADE,
  page                  INT,
  locator               JSONB NOT NULL,
  extraction_confidence NUMERIC(3,2) NOT NULL CHECK (extraction_confidence BETWEEN 0 AND 1),
  ingested_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prov_locator_nonempty CHECK (jsonb_typeof(locator) = 'object' AND locator <> '{}'::jsonb)
);
CREATE INDEX IF NOT EXISTS idx_prov_user ON ingestion.provenance(user_id);
CREATE INDEX IF NOT EXISTS idx_prov_fact ON ingestion.provenance(fact_id);


-- ###########################################################################
-- updated_at triggers
-- ###########################################################################
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['files','extraction_jobs'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_%I_updated_at ON ingestion.%I; '
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON ingestion.%I '
      'FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();',
      t, t, t, t
    );
  END LOOP;
END $$;


-- ###########################################################################
-- RLS — owner everything; service-role bypass
-- ###########################################################################
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'files','file_versions','extraction_jobs','extractions',
    'extracted_entities','extracted_relationships','extracted_facts','provenance'
  ] LOOP
    EXECUTE format('ALTER TABLE ingestion.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON ingestion.%I; '
      'CREATE POLICY %I ON ingestion.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
      t || '_owner_all', t, t || '_owner_all', t
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON ingestion.%I; '
      'CREATE POLICY %I ON ingestion.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t || '_service', t, t || '_service', t
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ingestion TO authenticated;


-- ###########################################################################
-- Public views
-- ###########################################################################
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'files','file_versions','extraction_jobs','extractions',
    'extracted_entities','extracted_relationships','extracted_facts','provenance'
  ] LOOP
    EXECUTE format('CREATE OR REPLACE VIEW public.ingestion_%I AS SELECT * FROM ingestion.%I', t, t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingestion_%I TO authenticated', t);
  END LOOP;
END $$;


-- ###########################################################################
-- GraphRAG sync — when an extracted_entity is graph_promoted=true OR a
-- fact lands, fan out to the existing GraphRAG sync queue. Embedding
-- payload strips raw text / locator so PHI does not flow into the
-- worker's embedding context.
-- ###########################################################################
CREATE OR REPLACE FUNCTION ingestion.trigger_ingestion_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entity_type TEXT;
  v_payload     JSONB;
BEGIN
  v_entity_type := CASE TG_TABLE_NAME
    WHEN 'extracted_entities'      THEN 'extracted_entity'
    WHEN 'extracted_relationships' THEN 'extracted_relationship'
    WHEN 'extracted_facts'         THEN 'extracted_fact'
    ELSE 'ingestion_unknown'
  END;

  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, v_entity_type, OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  END IF;

  v_payload := to_jsonb(NEW)
    - 'metadata' - 'created_at'
    - 'evidence_text'              -- never embed raw verbatim quotes
    - 'object_text' - 'object_jsonb'
    - 'source_locator' - 'locator';

  PERFORM graphrag.enqueue_sync(
    NEW.user_id, v_entity_type, NEW.id,
    TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert', v_payload
  );
  RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['extracted_entities','extracted_relationships','extracted_facts'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_graphrag_%I_sync ON ingestion.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trigger_graphrag_%I_sync '
      'AFTER INSERT OR UPDATE OR DELETE ON ingestion.%I '
      'FOR EACH ROW EXECUTE FUNCTION ingestion.trigger_ingestion_sync()',
      t, t
    );
  END LOOP;
END $$;


-- ###########################################################################
-- Self-test
-- ###########################################################################
DO $$
DECLARE rls BOOLEAN; n INT;
BEGIN
  SELECT relrowsecurity INTO rls FROM pg_class c JOIN pg_namespace nsp ON nsp.oid = c.relnamespace
   WHERE nsp.nspname = 'ingestion' AND c.relname = 'files';
  IF NOT rls THEN RAISE EXCEPTION '091 self-test: RLS missing on ingestion.files'; END IF;

  SELECT relrowsecurity INTO rls FROM pg_class c JOIN pg_namespace nsp ON nsp.oid = c.relnamespace
   WHERE nsp.nspname = 'ingestion' AND c.relname = 'extracted_facts';
  IF NOT rls THEN RAISE EXCEPTION '091 self-test: RLS missing on extracted_facts'; END IF;

  -- Validate that the locator CHECK constraint exists.
  SELECT COUNT(*) INTO n FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace nsp ON nsp.oid = r.relnamespace
   WHERE nsp.nspname = 'ingestion' AND r.relname = 'extracted_facts' AND c.conname = 'fact_locator_nonempty';
  IF n = 0 THEN RAISE EXCEPTION '091 self-test: fact_locator_nonempty constraint missing'; END IF;
END $$;
