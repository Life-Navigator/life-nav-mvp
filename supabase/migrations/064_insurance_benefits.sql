-- ==========================================================================
-- 064: Insurance & Benefits
--
--   * insurance_plans      — one row per plan a user is enrolled in
--   * insurance_documents  — uploaded artifacts (card, policy PDF, summary)
--                            with OCR extraction status
--   * insurance_extracted_facts — structured facts pulled by OCR worker
--
--   Sensitive fields (member_id, group_number, raw OCR text) are stored
--   encrypted via core.encrypt_text() / core.decrypt_text() (pgcrypto AES256
--   defined in 009_mvp_ingestion_pipeline.sql). The encrypted columns hold
--   bytea-as-text; the decrypted forms are never persisted.
--
--   Service role bypass exists for the OCR worker.
-- ==========================================================================

-- -------------------------------------------------------------------------
-- 0. Encryption helper exposed to authenticated users.
--
--   core.encrypt_text() in 009 is service-role-only. We need a thin
--   SECURITY DEFINER wrapper so the authenticated user can hand us a
--   plaintext and get back the encrypted form to store. The key is read
--   from app runtime config (the same source used by 011 token storage)
--   so it never touches the JWT or the request body.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.encrypt_with_app_key(plaintext TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, public
AS $$
DECLARE
  v_key TEXT;
  v_cipher BYTEA;
BEGIN
  IF plaintext IS NULL OR length(trim(plaintext)) = 0 THEN
    RETURN NULL;
  END IF;
  v_key := current_setting('app.settings.encryption_key', true);
  IF v_key IS NULL OR length(trim(v_key)) = 0 THEN
    RAISE EXCEPTION 'encryption key is not configured';
  END IF;
  v_cipher := core.encrypt_text(plaintext, v_key);
  RETURN encode(v_cipher, 'base64');
END;
$$;

REVOKE ALL ON FUNCTION core.encrypt_with_app_key(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.encrypt_with_app_key(TEXT) TO authenticated, service_role;


-- -------------------------------------------------------------------------
-- 1. insurance_plans
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.insurance_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  plan_type TEXT NOT NULL
    CHECK (plan_type IN (
      'medical', 'dental', 'vision',
      'pharmacy', 'mental_health',
      'long_term_disability', 'short_term_disability',
      'life', 'accident', 'critical_illness',
      'auto', 'home', 'renters', 'umbrella',
      'pet', 'other'
    )),
  carrier TEXT,
  plan_name TEXT,
  plan_id_external TEXT,                  -- non-sensitive plan code (e.g. 'BCBS_PPO_500')

  -- Sensitive identifiers (encrypted)
  member_id_encrypted TEXT,
  group_number_encrypted TEXT,

  effective_date DATE,
  termination_date DATE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  source_of_coverage TEXT,                -- 'employer', 'marketplace', 'medicare', 'medicaid', 'va', 'private'

  -- Costs (annual unless noted)
  monthly_premium NUMERIC,
  annual_deductible NUMERIC,
  deductible_met_ytd NUMERIC,
  out_of_pocket_max NUMERIC,
  out_of_pocket_met_ytd NUMERIC,
  copay_primary_care NUMERIC,
  copay_specialist NUMERIC,
  copay_er NUMERIC,
  copay_urgent_care NUMERIC,
  coinsurance_percent NUMERIC(5,2)
    CHECK (coinsurance_percent IS NULL OR coinsurance_percent BETWEEN 0 AND 100),

  -- Pharmacy / prescription coverage
  prescription_coverage_tier_json JSONB DEFAULT '{}',   -- arbitrary plan-specific structure

  -- Account eligibility
  hsa_eligible BOOLEAN,
  fsa_eligible BOOLEAN,
  hra_eligible BOOLEAN,

  -- Network info
  network_type TEXT,                     -- 'hmo', 'ppo', 'epo', 'hdhp', etc.
  network_restrictions TEXT,

  -- Wellness benefit references
  wellness_benefits_summary TEXT,

  source TEXT NOT NULL DEFAULT 'onboarding',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_plans_user
  ON public.insurance_plans(user_id, plan_type);
CREATE INDEX IF NOT EXISTS idx_insurance_plans_user_active
  ON public.insurance_plans(user_id, is_active);

ALTER TABLE public.insurance_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insurance_plans_owner_all" ON public.insurance_plans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "insurance_plans_service_role" ON public.insurance_plans
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER set_insurance_plans_updated_at
  BEFORE UPDATE ON public.insurance_plans
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 2. insurance_documents
--   Uploaded artifacts (storage_key in Supabase Storage). OCR worker
--   updates ocr_status + ocr_completed_at.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.insurance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  insurance_plan_id UUID REFERENCES public.insurance_plans(id) ON DELETE SET NULL,

  document_type TEXT NOT NULL
    CHECK (document_type IN ('insurance_card_front', 'insurance_card_back', 'policy_pdf', 'benefits_summary', 'eob', 'other')),
  storage_bucket TEXT NOT NULL DEFAULT 'insurance',
  storage_key TEXT NOT NULL,                 -- path in storage bucket
  filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT,

  -- OCR pipeline state
  ocr_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  ocr_completed_at TIMESTAMPTZ,
  ocr_error TEXT,
  ocr_raw_text_encrypted TEXT,              -- encrypted raw OCR string

  source TEXT NOT NULL DEFAULT 'upload',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_docs_user
  ON public.insurance_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_docs_plan
  ON public.insurance_documents(insurance_plan_id) WHERE insurance_plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_insurance_docs_ocr
  ON public.insurance_documents(ocr_status) WHERE ocr_status IN ('pending', 'processing');

ALTER TABLE public.insurance_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insurance_docs_owner_all" ON public.insurance_documents
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "insurance_docs_service_role" ON public.insurance_documents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER set_insurance_docs_updated_at
  BEFORE UPDATE ON public.insurance_documents
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 3. insurance_extracted_facts
--   Structured facts the OCR worker pulled out of a document. Each fact
--   carries provenance (document_id + bounding box JSONB) plus a confidence
--   score so the user can be asked to approve/correct.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.insurance_extracted_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  insurance_document_id UUID NOT NULL REFERENCES public.insurance_documents(id) ON DELETE CASCADE,
  insurance_plan_id UUID REFERENCES public.insurance_plans(id) ON DELETE SET NULL,

  fact_key TEXT NOT NULL,                    -- 'deductible', 'oop_max', 'carrier', 'plan_name', ...
  fact_value_text TEXT,
  fact_value_numeric NUMERIC,
  fact_value_date DATE,
  bbox JSONB,                                 -- {page, x, y, w, h}
  confidence_score NUMERIC(3,2)
    CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1)),
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'ocr',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ins_facts_user      ON public.insurance_extracted_facts(user_id);
CREATE INDEX IF NOT EXISTS idx_ins_facts_doc       ON public.insurance_extracted_facts(insurance_document_id);
CREATE INDEX IF NOT EXISTS idx_ins_facts_user_key  ON public.insurance_extracted_facts(user_id, fact_key);

ALTER TABLE public.insurance_extracted_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ins_facts_owner_all" ON public.insurance_extracted_facts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ins_facts_service_role" ON public.insurance_extracted_facts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER set_ins_facts_updated_at
  BEFORE UPDATE ON public.insurance_extracted_facts
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 4. Storage bucket placeholder is created out-of-band via
--    `supabase storage create-bucket insurance --public=false`. The
--    storage RLS lives in 007_scenario_lab_storage.sql style code; we
--    do not duplicate that here, only document the bucket name.
-- -------------------------------------------------------------------------
COMMENT ON COLUMN public.insurance_documents.storage_bucket IS
  'Supabase Storage bucket name. Defaults to "insurance"; create with `supabase storage create-bucket insurance --public=false`.';
