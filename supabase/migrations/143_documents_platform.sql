-- 143_documents_platform.sql — Document Intelligence Platform (Elite Sprint 10), schema only.
-- The data-acquisition layer: an uploaded document, its extracted structured fields (evidence),
-- and document recommendations. 116-RLS. Triggers ship separately (144) AFTER the worker enum
-- (Document/DocumentField) is deployed (enum-before-trigger).
CREATE SCHEMA IF NOT EXISTS documents;

CREATE TABLE IF NOT EXISTS documents.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  doc_type TEXT NOT NULL,          -- offer_letter / 401k_statement / life_insurance_policy / dd214 / ...
  category TEXT NOT NULL,          -- employment / benefits / insurance / financial / education / family_office / military
  title TEXT,
  file_ref TEXT,                   -- storage path/URL (binary lives in object storage, not here)
  status TEXT NOT NULL DEFAULT 'uploaded',   -- uploaded / extracted / needs_review / failed
  source_name TEXT,                -- issuer (employer, carrier, custodian, VA, ...)
  confidence NUMERIC,              -- overall extraction confidence 0..1
  effective_date DATE, expiry_date DATE, document_date DATE,
  extracted_json JSONB NOT NULL DEFAULT '{}'::jsonb,   -- the structured extraction
  affects_domains TEXT[] NOT NULL DEFAULT '{}',        -- finance/career/family/health/education
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS documents.document_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL, user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  field_key TEXT NOT NULL,         -- base_salary / equity_grant / coverage_amount / vested_balance / ...
  field_value TEXT, field_type TEXT,   -- money / date / percent / text / number
  confidence NUMERIC, unit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS documents.document_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  title TEXT NOT NULL, why_it_matters TEXT, priority TEXT NOT NULL DEFAULT 'medium',
  category TEXT, doc_type TEXT,
  evidence_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE INDEX IF NOT EXISTS idx_documents_user ON documents.documents(user_id, category);
CREATE INDEX IF NOT EXISTS idx_docfields_doc ON documents.document_fields(document_id);
CREATE INDEX IF NOT EXISTS idx_docrecs_user ON documents.document_recommendations(user_id);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['documents','document_fields','document_recommendations'] LOOP
    EXECUTE format('ALTER TABLE documents.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE documents.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$DROP POLICY IF EXISTS users_own_%1$s ON documents.%1$I$p$, t);
    EXECUTE format('CREATE POLICY users_own_%1$s ON documents.%1$I FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t);
    EXECUTE format($p$DROP POLICY IF EXISTS service_%1$s ON documents.%1$I$p$, t);
    EXECUTE format('CREATE POLICY service_%1$s ON documents.%1$I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON documents.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON documents.%I TO service_role', t);
  END LOOP;
END $$;
GRANT USAGE ON SCHEMA documents TO authenticated, service_role, anon;
