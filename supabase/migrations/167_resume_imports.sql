-- 167_resume_imports.sql
--
-- Document Intelligence Trust Sprint — Phase 8 resume import pipeline.
--
-- Resume import is "just another document intelligence source": the uploaded resume is a normal
-- documents.documents row (doc_type='resume'); its STRUCTURED, multi-record extraction is staged here
-- as reviewable items. Nothing auto-imports — the user reviews each item, then approved items are
-- written to the real domain tables (career/education) with provenance kept in the row's metadata.
--
-- Additive + idempotent. 116-RLS (user-owns-rows + service-role), mirroring 143.

CREATE TABLE IF NOT EXISTS documents.resume_items (
  id               UUID PRIMARY KEY,
  user_id          UUID NOT NULL,
  tenant_id        UUID NOT NULL,
  document_id      UUID NOT NULL,                 -- the documents.documents resume row this came from
  section          TEXT NOT NULL,                 -- employment | volunteer | projects | education | certifications | skills
  fields           JSONB NOT NULL DEFAULT '{}'::jsonb,  -- the structured record (title/employer/dates/…)
  confidence       NUMERIC,
  page_number      INT,                           -- 1-based source page (NULL for DOCX/pasted text)
  section_label    TEXT,                          -- the resume heading the record was found under
  review_status    TEXT NOT NULL DEFAULT 'extracted',  -- extracted | needs_review | user_edited | imported | ignored
  target_table     TEXT,                          -- where it was imported (e.g. career.experience_records)
  target_record_id UUID,                          -- the imported domain row id (provenance back-link)
  imported_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT resume_items_section_chk
    CHECK (section IN ('employment','volunteer','projects','education','certifications','skills')),
  CONSTRAINT resume_items_review_chk
    CHECK (review_status IN ('extracted','needs_review','user_edited','imported','ignored'))
);

CREATE INDEX IF NOT EXISTS idx_resume_items_user_doc ON documents.resume_items (user_id, document_id);
CREATE INDEX IF NOT EXISTS idx_resume_items_review ON documents.resume_items (user_id, review_status);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['resume_items'] LOOP
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
