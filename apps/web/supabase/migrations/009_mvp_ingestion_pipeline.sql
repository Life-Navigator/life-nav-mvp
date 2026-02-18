-- ==========================================================================
-- MVP Supabase Ingestion Pipeline (core / finance / health_meta)
-- ==========================================================================
-- Purpose:
-- 1) Make uploads operational without backend dependency
-- 2) Queue and process ingestion jobs via Edge Functions
-- 3) Enforce strict RLS and private storage access patterns
-- ==========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS health_meta;

GRANT USAGE ON SCHEMA core TO authenticated, service_role;
GRANT USAGE ON SCHEMA finance TO authenticated, service_role;
GRANT USAGE ON SCHEMA health_meta TO authenticated, service_role;

-- --------------------------------------------------------------------------
-- Encryption helpers
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.encrypt_text(p_plaintext TEXT, p_key TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, public
AS $$
BEGIN
  IF p_plaintext IS NULL OR p_key IS NULL OR length(trim(p_key)) = 0 THEN
    RETURN NULL;
  END IF;

  RETURN pgp_sym_encrypt(p_plaintext, p_key, 'cipher-algo=aes256, compress-algo=1');
END;
$$;

CREATE OR REPLACE FUNCTION core.decrypt_text(p_ciphertext BYTEA, p_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, public
AS $$
BEGIN
  IF p_ciphertext IS NULL OR p_key IS NULL OR length(trim(p_key)) = 0 THEN
    RETURN NULL;
  END IF;

  RETURN pgp_sym_decrypt(p_ciphertext, p_key);
END;
$$;

REVOKE ALL ON FUNCTION core.encrypt_text(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION core.decrypt_text(BYTEA, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.encrypt_text(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION core.decrypt_text(BYTEA, TEXT) TO service_role;

-- --------------------------------------------------------------------------
-- Core upload and ingestion queue
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core.upload_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain TEXT NOT NULL CHECK (domain IN ('financial', 'health', 'career', 'education', 'other')),
  bucket_id TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  detected_file_type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
  checksum_sha256 TEXT,
  ingest_status TEXT NOT NULL DEFAULT 'pending' CHECK (ingest_status IN ('pending', 'queued', 'processing', 'completed', 'failed')),
  ocr_status TEXT NOT NULL DEFAULT 'not_required' CHECK (ocr_status IN ('not_required', 'queued', 'processing', 'completed', 'failed')),
  parser_version TEXT NOT NULL DEFAULT 'mvp-v1',
  parsed_payload JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_text TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(bucket_id, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_upload_documents_user ON core.upload_documents(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_documents_status ON core.upload_documents(ingest_status, created_at);
CREATE INDEX IF NOT EXISTS idx_upload_documents_domain ON core.upload_documents(domain, created_at DESC);

CREATE TABLE IF NOT EXISTS core.ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES core.upload_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL DEFAULT 'ingest' CHECK (job_type IN ('ingest', 'ocr')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  parser_version TEXT NOT NULL DEFAULT 'mvp-v1',
  result_json JSONB,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(document_id, job_type, status) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_queue ON core.ingestion_jobs(status, run_after, created_at);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_document ON core.ingestion_jobs(document_id);

CREATE TABLE IF NOT EXISTS core.document_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES core.upload_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fact_key TEXT NOT NULL,
  fact_value JSONB NOT NULL,
  confidence NUMERIC(4,3),
  source TEXT NOT NULL DEFAULT 'parser',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_facts_doc ON core.document_facts(document_id);
CREATE INDEX IF NOT EXISTS idx_document_facts_user ON core.document_facts(user_id, created_at DESC);

-- --------------------------------------------------------------------------
-- Finance ingestion targets (MVP)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finance.account_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('plaid', 'manual')),
  institution_name TEXT,
  account_mask TEXT,
  plaid_item_id TEXT,
  plaid_access_token_encrypted BYTEA,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_connections_user ON finance.account_connections(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS finance.transactions_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_id UUID REFERENCES core.upload_documents(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('csv', 'xlsx', 'docx', 'ocr', 'manual')),
  transaction_date DATE,
  description TEXT,
  merchant TEXT,
  amount NUMERIC(14,2),
  currency_code TEXT DEFAULT 'USD',
  category TEXT,
  raw_row JSONB NOT NULL DEFAULT '{}'::jsonb,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_inbox_user_date ON finance.transactions_inbox(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_inbox_document ON finance.transactions_inbox(document_id);

-- --------------------------------------------------------------------------
-- Health meta MVP subset
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_meta.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL,
  appointment_at TIMESTAMPTZ NOT NULL,
  appointment_type TEXT,
  notes_encrypted BYTEA,
  source_document_id UUID REFERENCES core.upload_documents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_user_time ON health_meta.appointments(user_id, appointment_at DESC);

CREATE TABLE IF NOT EXISTS health_meta.insurance_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payer_name TEXT,
  member_id_encrypted BYTEA,
  group_number_encrypted BYTEA,
  plan_type TEXT,
  card_front_document_id UUID REFERENCES core.upload_documents(id) ON DELETE SET NULL,
  card_back_document_id UUID REFERENCES core.upload_documents(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_cards_user ON health_meta.insurance_cards(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS health_meta.insurance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  insurance_card_id UUID REFERENCES health_meta.insurance_cards(id) ON DELETE SET NULL,
  document_id UUID NOT NULL REFERENCES core.upload_documents(id) ON DELETE CASCADE,
  document_kind TEXT NOT NULL CHECK (document_kind IN ('card_front', 'card_back', 'policy', 'claim', 'other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_documents_user ON health_meta.insurance_documents(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS health_meta.basic_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL,
  record_date DATE,
  value_text_encrypted BYTEA,
  source_document_id UUID REFERENCES core.upload_documents(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_basic_records_user_type ON health_meta.basic_records(user_id, record_type, record_date DESC);

-- --------------------------------------------------------------------------
-- Trigger helpers
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_upload_documents_updated_at ON core.upload_documents;
CREATE TRIGGER trigger_upload_documents_updated_at
  BEFORE UPDATE ON core.upload_documents
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();

DROP TRIGGER IF EXISTS trigger_ingestion_jobs_updated_at ON core.ingestion_jobs;
CREATE TRIGGER trigger_ingestion_jobs_updated_at
  BEFORE UPDATE ON core.ingestion_jobs
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();

DROP TRIGGER IF EXISTS trigger_account_connections_updated_at ON finance.account_connections;
CREATE TRIGGER trigger_account_connections_updated_at
  BEFORE UPDATE ON finance.account_connections
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();

DROP TRIGGER IF EXISTS trigger_health_appointments_updated_at ON health_meta.appointments;
CREATE TRIGGER trigger_health_appointments_updated_at
  BEFORE UPDATE ON health_meta.appointments
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();

DROP TRIGGER IF EXISTS trigger_insurance_cards_updated_at ON health_meta.insurance_cards;
CREATE TRIGGER trigger_insurance_cards_updated_at
  BEFORE UPDATE ON health_meta.insurance_cards
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();

DROP TRIGGER IF EXISTS trigger_basic_records_updated_at ON health_meta.basic_records;
CREATE TRIGGER trigger_basic_records_updated_at
  BEFORE UPDATE ON health_meta.basic_records
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();

CREATE OR REPLACE FUNCTION core.enqueue_ingestion_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, public
AS $$
BEGIN
  IF NEW.ingest_status IN ('pending', 'queued') THEN
    INSERT INTO core.ingestion_jobs (document_id, user_id, job_type, status, parser_version)
    VALUES (NEW.id, NEW.user_id, 'ingest', 'queued', NEW.parser_version)
    ON CONFLICT DO NOTHING;

    NEW.ingest_status := 'queued';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enqueue_ingestion_job ON core.upload_documents;
CREATE TRIGGER trigger_enqueue_ingestion_job
  BEFORE INSERT ON core.upload_documents
  FOR EACH ROW
  EXECUTE FUNCTION core.enqueue_ingestion_job();

-- --------------------------------------------------------------------------
-- Queue claim/complete functions for edge workers
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.claim_ingestion_jobs(
  p_limit INT DEFAULT 10,
  p_worker_id TEXT DEFAULT 'worker'
)
RETURNS SETOF core.ingestion_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT j.id
    FROM core.ingestion_jobs j
    WHERE j.status = 'queued'
      AND j.run_after <= now()
      AND j.attempts < j.max_attempts
    ORDER BY j.created_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 10), 1)
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE core.ingestion_jobs j
    SET status = 'processing',
        attempts = j.attempts + 1,
        locked_at = now(),
        locked_by = p_worker_id,
        updated_at = now(),
        last_error = NULL
    FROM candidates c
    WHERE j.id = c.id
    RETURNING j.*
  )
  SELECT * FROM claimed;
END;
$$;

CREATE OR REPLACE FUNCTION core.complete_ingestion_job(
  p_job_id UUID,
  p_status TEXT,
  p_result JSONB DEFAULT NULL,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, public
AS $$
DECLARE
  v_document_id UUID;
BEGIN
  IF p_status NOT IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid job completion status: %', p_status;
  END IF;

  UPDATE core.ingestion_jobs
  SET status = p_status,
      result_json = p_result,
      last_error = p_error,
      completed_at = now(),
      updated_at = now()
  WHERE id = p_job_id
  RETURNING document_id INTO v_document_id;

  IF v_document_id IS NULL THEN
    RAISE EXCEPTION 'Ingestion job not found: %', p_job_id;
  END IF;

  UPDATE core.upload_documents
  SET ingest_status = CASE WHEN p_status = 'completed' THEN 'completed' ELSE 'failed' END,
      parsed_payload = COALESCE(p_result, parsed_payload),
      error_text = p_error,
      processed_at = now(),
      updated_at = now()
  WHERE id = v_document_id;
END;
$$;

REVOKE ALL ON FUNCTION core.claim_ingestion_jobs(INT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION core.complete_ingestion_job(UUID, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.claim_ingestion_jobs(INT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION core.complete_ingestion_job(UUID, TEXT, JSONB, TEXT) TO service_role;

-- --------------------------------------------------------------------------
-- Storage-trigger: create ingestion record when object is uploaded directly
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.enqueue_from_storage_object()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, public
AS $$
DECLARE
  v_user_id UUID;
  v_domain TEXT;
  v_file_name TEXT;
BEGIN
  IF NEW.bucket_id NOT IN ('documents', 'insurance-cards') THEN
    RETURN NEW;
  END IF;

  -- Expect path format: <user_id>/<domain>/<filename>
  v_user_id := NULLIF(split_part(NEW.name, '/', 1), '')::uuid;
  v_domain := NULLIF(split_part(NEW.name, '/', 2), '');
  v_file_name := split_part(NEW.name, '/', 3);

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_domain IS NULL OR length(v_domain) = 0 THEN
    v_domain := CASE WHEN NEW.bucket_id = 'insurance-cards' THEN 'health' ELSE 'other' END;
  END IF;

  IF v_file_name IS NULL OR length(v_file_name) = 0 THEN
    v_file_name := NEW.name;
  END IF;

  INSERT INTO core.upload_documents (
    user_id,
    domain,
    bucket_id,
    storage_path,
    original_filename,
    detected_file_type,
    mime_type,
    file_size_bytes,
    checksum_sha256,
    ingest_status,
    metadata
  ) VALUES (
    v_user_id,
    v_domain,
    NEW.bucket_id,
    NEW.name,
    v_file_name,
    COALESCE(UPPER(split_part(v_file_name, '.', array_length(string_to_array(v_file_name, '.'), 1))), 'OTHER'),
    COALESCE(NEW.metadata->>'mimetype', 'application/octet-stream'),
    COALESCE((NEW.metadata->>'size')::bigint, 1),
    encode(digest(NEW.name || COALESCE(NEW.updated_at::text, now()::text), 'sha256'), 'hex'),
    'queued',
    jsonb_build_object('source', 'storage.trigger')
  )
  ON CONFLICT (bucket_id, storage_path) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Never block storage writes due to queue bookkeeping.
    RAISE NOTICE 'enqueue_from_storage_object failed for %: %', NEW.name, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enqueue_from_storage_object ON storage.objects;
CREATE TRIGGER trigger_enqueue_from_storage_object
  AFTER INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION core.enqueue_from_storage_object();

-- --------------------------------------------------------------------------
-- RLS policies
-- --------------------------------------------------------------------------
ALTER TABLE core.upload_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.document_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.account_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.transactions_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_meta.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_meta.insurance_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_meta.insurance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_meta.basic_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mvp_upload_documents_select_own" ON core.upload_documents;
CREATE POLICY "mvp_upload_documents_select_own" ON core.upload_documents
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mvp_upload_documents_insert_own" ON core.upload_documents;
CREATE POLICY "mvp_upload_documents_insert_own" ON core.upload_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mvp_upload_documents_update_own" ON core.upload_documents;
CREATE POLICY "mvp_upload_documents_update_own" ON core.upload_documents
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mvp_ingestion_jobs_select_own" ON core.ingestion_jobs;
CREATE POLICY "mvp_ingestion_jobs_select_own" ON core.ingestion_jobs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mvp_document_facts_select_own" ON core.document_facts;
CREATE POLICY "mvp_document_facts_select_own" ON core.document_facts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mvp_document_facts_insert_own" ON core.document_facts;
CREATE POLICY "mvp_document_facts_insert_own" ON core.document_facts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mvp_finance_connections_own" ON finance.account_connections;
CREATE POLICY "mvp_finance_connections_own" ON finance.account_connections
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mvp_finance_transactions_own" ON finance.transactions_inbox;
CREATE POLICY "mvp_finance_transactions_own" ON finance.transactions_inbox
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mvp_health_appointments_own" ON health_meta.appointments;
CREATE POLICY "mvp_health_appointments_own" ON health_meta.appointments
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mvp_health_insurance_cards_own" ON health_meta.insurance_cards;
CREATE POLICY "mvp_health_insurance_cards_own" ON health_meta.insurance_cards
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mvp_health_insurance_docs_own" ON health_meta.insurance_documents;
CREATE POLICY "mvp_health_insurance_docs_own" ON health_meta.insurance_documents
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mvp_health_basic_records_own" ON health_meta.basic_records;
CREATE POLICY "mvp_health_basic_records_own" ON health_meta.basic_records
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role full access (required for edge workers)
DROP POLICY IF EXISTS "mvp_upload_documents_service_role" ON core.upload_documents;
CREATE POLICY "mvp_upload_documents_service_role" ON core.upload_documents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "mvp_ingestion_jobs_service_role" ON core.ingestion_jobs;
CREATE POLICY "mvp_ingestion_jobs_service_role" ON core.ingestion_jobs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "mvp_document_facts_service_role" ON core.document_facts;
CREATE POLICY "mvp_document_facts_service_role" ON core.document_facts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "mvp_finance_connections_service_role" ON finance.account_connections;
CREATE POLICY "mvp_finance_connections_service_role" ON finance.account_connections
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "mvp_finance_transactions_service_role" ON finance.transactions_inbox;
CREATE POLICY "mvp_finance_transactions_service_role" ON finance.transactions_inbox
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "mvp_health_appointments_service_role" ON health_meta.appointments;
CREATE POLICY "mvp_health_appointments_service_role" ON health_meta.appointments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "mvp_health_insurance_cards_service_role" ON health_meta.insurance_cards;
CREATE POLICY "mvp_health_insurance_cards_service_role" ON health_meta.insurance_cards
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "mvp_health_insurance_docs_service_role" ON health_meta.insurance_documents;
CREATE POLICY "mvp_health_insurance_docs_service_role" ON health_meta.insurance_documents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "mvp_health_basic_records_service_role" ON health_meta.basic_records;
CREATE POLICY "mvp_health_basic_records_service_role" ON health_meta.basic_records
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------------
-- Storage bucket for insurance cards (private)
-- --------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'insurance-cards',
  'insurance-cards',
  FALSE,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "mvp_insurance_cards_upload" ON storage.objects;
CREATE POLICY "mvp_insurance_cards_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'insurance-cards'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "mvp_insurance_cards_read" ON storage.objects;
CREATE POLICY "mvp_insurance_cards_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'insurance-cards'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "mvp_insurance_cards_update" ON storage.objects;
CREATE POLICY "mvp_insurance_cards_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'insurance-cards'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'insurance-cards'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "mvp_insurance_cards_delete" ON storage.objects;
CREATE POLICY "mvp_insurance_cards_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'insurance-cards'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
