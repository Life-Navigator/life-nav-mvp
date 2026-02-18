-- ==========================================================================
-- MVP Ingestion Hardening
-- - idempotency keys
-- - lease-based claiming
-- - retry backoff and dead-letter states
-- - ingestion results idempotency ledger
-- - de-duplication for downstream writes
-- ==========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- --------------------------------------------------------------------------
-- Queue table hardening
-- --------------------------------------------------------------------------
ALTER TABLE core.ingestion_jobs
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS bucket_id TEXT,
  ADD COLUMN IF NOT EXISTS object_path TEXT,
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS source_event TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claim_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_by TEXT,
  ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'core' AND table_name = 'ingestion_jobs' AND column_name = 'run_after'
  ) THEN
    EXECUTE 'UPDATE core.ingestion_jobs SET next_run_at = COALESCE(next_run_at, run_after)';
  END IF;
END $$;

ALTER TABLE core.ingestion_jobs DROP COLUMN IF EXISTS run_after;
ALTER TABLE core.ingestion_jobs DROP COLUMN IF EXISTS locked_at;
ALTER TABLE core.ingestion_jobs DROP COLUMN IF EXISTS locked_by;

ALTER TABLE core.ingestion_jobs
  ALTER COLUMN max_attempts SET DEFAULT 5;

ALTER TABLE core.ingestion_jobs
  DROP CONSTRAINT IF EXISTS ingestion_jobs_status_check;

ALTER TABLE core.ingestion_jobs
  ADD CONSTRAINT ingestion_jobs_status_check
  CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'dead'));

ALTER TABLE core.ingestion_jobs
  DROP CONSTRAINT IF EXISTS ingestion_jobs_document_id_job_type_status_key;

CREATE OR REPLACE FUNCTION core.compute_ingestion_idempotency_key(
  p_user_id UUID,
  p_bucket_id TEXT,
  p_object_path TEXT,
  p_content_hash TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT encode(
    digest(
      coalesce(p_user_id::text, '') || '|' ||
      coalesce(p_bucket_id, '') || '|' ||
      coalesce(p_object_path, '') || '|' ||
      coalesce(p_content_hash, ''),
      'sha256'
    ),
    'hex'
  );
$$;

UPDATE core.ingestion_jobs
SET idempotency_key = core.compute_ingestion_idempotency_key(
  user_id,
  COALESCE(bucket_id, ''),
  COALESCE(object_path, document_id::text),
  content_hash
)
WHERE idempotency_key IS NULL;

ALTER TABLE core.ingestion_jobs
  ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ingestion_jobs_idempotency_key
  ON core.ingestion_jobs(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_claimable
  ON core.ingestion_jobs(status, next_run_at, claim_expires_at, attempts, created_at);

-- --------------------------------------------------------------------------
-- Results ledger for idempotent processing commits
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core.ingestion_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES core.ingestion_jobs(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES core.upload_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parser_version TEXT NOT NULL DEFAULT 'mvp-v1',
  status TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
  output_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id),
  UNIQUE(document_id, parser_version)
);

ALTER TABLE core.ingestion_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mvp_ingestion_results_select_own" ON core.ingestion_results;
CREATE POLICY "mvp_ingestion_results_select_own" ON core.ingestion_results
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mvp_ingestion_results_service_role" ON core.ingestion_results;
CREATE POLICY "mvp_ingestion_results_service_role" ON core.ingestion_results
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------------
-- De-duplication keys for downstream writes
-- --------------------------------------------------------------------------
ALTER TABLE finance.transactions_inbox
  ADD COLUMN IF NOT EXISTS ingestion_job_id UUID REFERENCES core.ingestion_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_row_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_inbox_job_row
  ON finance.transactions_inbox(ingestion_job_id, source_row_hash)
  WHERE ingestion_job_id IS NOT NULL AND source_row_hash IS NOT NULL;

ALTER TABLE health_meta.insurance_documents
  ADD COLUMN IF NOT EXISTS ingestion_job_id UUID REFERENCES core.ingestion_jobs(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_insurance_documents_doc_kind
  ON health_meta.insurance_documents(document_id, document_kind);

ALTER TABLE core.document_facts
  ADD COLUMN IF NOT EXISTS ingestion_job_id UUID REFERENCES core.ingestion_jobs(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_document_facts_source
  ON core.document_facts(document_id, fact_key, source);

-- --------------------------------------------------------------------------
-- Trigger updates (single deterministic idempotency key path)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.enqueue_ingestion_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, public
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF NEW.ingest_status IN ('pending', 'queued') THEN
    v_key := core.compute_ingestion_idempotency_key(
      NEW.user_id,
      NEW.bucket_id,
      NEW.storage_path,
      NEW.checksum_sha256
    );

    INSERT INTO core.ingestion_jobs (
      document_id,
      user_id,
      job_type,
      status,
      parser_version,
      idempotency_key,
      bucket_id,
      object_path,
      content_hash,
      source_event,
      next_run_at
    ) VALUES (
      NEW.id,
      NEW.user_id,
      'ingest',
      'queued',
      NEW.parser_version,
      v_key,
      NEW.bucket_id,
      NEW.storage_path,
      NEW.checksum_sha256,
      'document_insert',
      now()
    )
    ON CONFLICT (idempotency_key) DO UPDATE
      SET updated_at = now(),
          next_run_at = LEAST(core.ingestion_jobs.next_run_at, now())
      WHERE core.ingestion_jobs.status IN ('queued', 'failed', 'processing');

    NEW.ingest_status := 'queued';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enqueue_ingestion_job ON core.upload_documents;
CREATE TRIGGER trigger_enqueue_ingestion_job
  BEFORE INSERT OR UPDATE OF ingest_status, checksum_sha256, storage_path
  ON core.upload_documents
  FOR EACH ROW
  EXECUTE FUNCTION core.enqueue_ingestion_job();

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
  v_mime_type TEXT;
  v_file_size BIGINT;
  v_checksum TEXT;
BEGIN
  IF NEW.bucket_id NOT IN ('documents', 'insurance-cards') THEN
    RETURN NEW;
  END IF;

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

  v_mime_type := COALESCE(NEW.metadata->>'mimetype', 'application/octet-stream');
  v_file_size := COALESCE((NEW.metadata->>'size')::bigint, 1);
  v_checksum := COALESCE(
    NULLIF(NEW.metadata->>'checksumSha256', ''),
    NULLIF(NEW.metadata->>'checksum_sha256', ''),
    NULLIF(NEW.metadata->>'etag', ''),
    NULLIF(NEW.metadata->>'eTag', ''),
    encode(digest(NEW.name || COALESCE(NEW.updated_at::text, now()::text), 'sha256'), 'hex')
  );

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
    v_mime_type,
    v_file_size,
    v_checksum,
    'pending',
    jsonb_build_object('source', 'storage.trigger')
  )
  ON CONFLICT (bucket_id, storage_path) DO UPDATE
    SET file_size_bytes = EXCLUDED.file_size_bytes,
        mime_type = EXCLUDED.mime_type,
        checksum_sha256 = COALESCE(EXCLUDED.checksum_sha256, core.upload_documents.checksum_sha256),
        ingest_status = 'pending',
        parsed_payload = NULL,
        processed_at = NULL,
        error_text = NULL,
        updated_at = now();

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'enqueue_from_storage_object failed for %: %', NEW.name, SQLERRM;
    RETURN NEW;
END;
$$;

-- --------------------------------------------------------------------------
-- Lease-based queue operations
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.claim_ingestion_jobs(
  p_limit INT DEFAULT 10,
  p_worker_id TEXT DEFAULT 'worker',
  p_lease_seconds INT DEFAULT 300
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
    WHERE (
      (j.status IN ('queued', 'failed') AND j.next_run_at <= now())
      OR (j.status = 'processing' AND j.claim_expires_at <= now())
    )
      AND j.attempts < j.max_attempts
    ORDER BY j.created_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 10), 1)
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE core.ingestion_jobs j
    SET status = 'processing',
        attempts = j.attempts + 1,
        claimed_at = now(),
        claim_expires_at = now() + make_interval(secs => GREATEST(COALESCE(p_lease_seconds, 300), 30)),
        claimed_by = COALESCE(p_worker_id, 'worker'),
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
  p_result JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, public
AS $$
DECLARE
  v_document_id UUID;
BEGIN
  UPDATE core.ingestion_jobs
  SET status = 'completed',
      result_json = p_result,
      last_error = NULL,
      completed_at = now(),
      claim_expires_at = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      updated_at = now()
  WHERE id = p_job_id
  RETURNING document_id INTO v_document_id;

  IF v_document_id IS NULL THEN
    RAISE EXCEPTION 'Ingestion job not found: %', p_job_id;
  END IF;

  UPDATE core.upload_documents
  SET ingest_status = 'completed',
      parsed_payload = COALESCE(p_result, parsed_payload),
      error_text = NULL,
      processed_at = now(),
      updated_at = now()
  WHERE id = v_document_id;
END;
$$;

CREATE OR REPLACE FUNCTION core.fail_ingestion_job(
  p_job_id UUID,
  p_error TEXT,
  p_max_backoff_minutes INT DEFAULT 60
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, public
AS $$
DECLARE
  v_attempts INT;
  v_max_attempts INT;
  v_document_id UUID;
  v_backoff_minutes INT;
  v_status TEXT;
BEGIN
  SELECT attempts, max_attempts, document_id
    INTO v_attempts, v_max_attempts, v_document_id
  FROM core.ingestion_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF v_document_id IS NULL THEN
    RAISE EXCEPTION 'Ingestion job not found: %', p_job_id;
  END IF;

  v_backoff_minutes := LEAST((2 ^ GREATEST(v_attempts, 1))::INT, GREATEST(COALESCE(p_max_backoff_minutes, 60), 1));
  v_status := CASE WHEN v_attempts >= v_max_attempts THEN 'dead' ELSE 'failed' END;

  UPDATE core.ingestion_jobs
  SET status = v_status,
      last_error = left(COALESCE(p_error, 'unknown error'), 2000),
      next_run_at = CASE WHEN v_status = 'dead' THEN NULL ELSE now() + make_interval(mins => v_backoff_minutes) END,
      claim_expires_at = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      completed_at = CASE WHEN v_status = 'dead' THEN now() ELSE completed_at END,
      updated_at = now()
  WHERE id = p_job_id;

  UPDATE core.upload_documents
  SET ingest_status = CASE WHEN v_status = 'dead' THEN 'failed' ELSE ingest_status END,
      error_text = left(COALESCE(p_error, 'unknown error'), 2000),
      updated_at = now()
  WHERE id = v_document_id;
END;
$$;

REVOKE ALL ON FUNCTION core.claim_ingestion_jobs(INT, TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION core.complete_ingestion_job(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fail_ingestion_job(UUID, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.claim_ingestion_jobs(INT, TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION core.complete_ingestion_job(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION core.fail_ingestion_job(UUID, TEXT, INT) TO service_role;

-- --------------------------------------------------------------------------
-- Internal request replay protection (for private worker webhooks)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core.internal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE,
  source TEXT NOT NULL,
  payload_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_internal_requests_expires_at
  ON core.internal_requests(expires_at);

ALTER TABLE core.internal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mvp_internal_requests_service_role" ON core.internal_requests;
CREATE POLICY "mvp_internal_requests_service_role" ON core.internal_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION core.register_internal_request(
  p_request_id TEXT,
  p_source TEXT,
  p_payload_hash TEXT DEFAULT NULL,
  p_ttl_seconds INT DEFAULT 900
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, public
AS $$
DECLARE
  v_request_uuid UUID;
BEGIN
  DELETE FROM core.internal_requests WHERE expires_at <= now();

  BEGIN
    v_request_uuid := p_request_id::uuid;
  EXCEPTION
    WHEN others THEN
      RAISE EXCEPTION 'Invalid request_id UUID: %', p_request_id;
  END;

  INSERT INTO core.internal_requests (request_id, source, payload_hash, expires_at)
  VALUES (
    v_request_uuid,
    COALESCE(NULLIF(p_source, ''), 'unknown'),
    p_payload_hash,
    now() + make_interval(secs => GREATEST(COALESCE(p_ttl_seconds, 900), 60))
  )
  ON CONFLICT (request_id) DO NOTHING;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION core.register_internal_request(TEXT, TEXT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.register_internal_request(TEXT, TEXT, TEXT, INT) TO service_role;
