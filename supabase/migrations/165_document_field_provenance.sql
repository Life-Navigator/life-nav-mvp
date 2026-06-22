-- 165_document_field_provenance.sql
--
-- Document Intelligence Trust Sprint — P0 provenance foundation.
--
-- Adds the locators that make "where did this come from?" answerable in one click. The extraction
-- pipeline ALREADY computes a page + character span for every field (PdfReader pages + the label match
-- index) but discarded them at persistence. This migration gives document_fields a home for them, plus a
-- per-field review lifecycle so users can confirm/edit/reject low-confidence extractions.
--
-- Additive + idempotent. No existing data is touched (new columns default sensibly).

ALTER TABLE documents.document_fields
  ADD COLUMN IF NOT EXISTS page_number       INT,                              -- 1-based page the value was found on
  ADD COLUMN IF NOT EXISTS section           TEXT,                             -- the matched label/section
  ADD COLUMN IF NOT EXISTS char_start        INT,                              -- offset of the match in the doc text
  ADD COLUMN IF NOT EXISTS char_end          INT,                              -- end offset (for highlight)
  ADD COLUMN IF NOT EXISTS extraction_method TEXT NOT NULL DEFAULT 'regex',    -- regex | vision:<model> | whisper | manual
  ADD COLUMN IF NOT EXISTS extracted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS review_status     TEXT NOT NULL DEFAULT 'extracted';

-- Review lifecycle: extracted (machine) → needs_review (low conf) → user_confirmed | user_edited | rejected.
-- Advisor/readiness precedence: user_confirmed/user_edited > extracted(high-conf) > inferred(low/media).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_fields_review_status_chk'
  ) THEN
    ALTER TABLE documents.document_fields
      ADD CONSTRAINT document_fields_review_status_chk
      CHECK (review_status IN ('extracted','needs_review','user_confirmed','user_edited','rejected'));
  END IF;
END $$;

-- Backfill: existing rows keep 'extracted' (their default); flag the genuinely low-confidence ones so the
-- new review UI surfaces them. < 0.6 is the same threshold the service already uses for document status.
UPDATE documents.document_fields
   SET review_status = 'needs_review'
 WHERE review_status = 'extracted' AND confidence IS NOT NULL AND confidence < 0.6;

CREATE INDEX IF NOT EXISTS idx_document_fields_review
  ON documents.document_fields (user_id, review_status);
