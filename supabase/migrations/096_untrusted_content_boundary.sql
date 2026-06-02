-- ============================================================================
-- 096: Untrusted Content Boundary (addendum Phases 3 + 4)
--
-- Adds the three trust-boundary columns to the ingestion provenance
-- tables so every extracted record carries an explicit declaration
-- of who is allowed to act on it:
--
--   trusted_source         BOOLEAN — default FALSE (external by default)
--   instruction_authority  TEXT    — default 'none' (data only)
--   content_origin         TEXT    — required at write time
--
-- Externally-sourced content can never be promoted to a higher
-- authority by inserting a new row. Service-role inserts must still
-- specify the origin honestly.
-- ============================================================================

-- ---- Enum helper ----------------------------------------------------------
CREATE OR REPLACE FUNCTION ingestion.is_instruction_authority(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$ SELECT p IN ('system','developer','governance','user','none') $$;

CREATE OR REPLACE FUNCTION ingestion.is_content_origin(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT p IN (
    'user_prompt','uploaded_file','pdf','ocr','docx','xlsx',
    'audio_transcript','video_transcript','image_extraction',
    'web','connector','provider_note','partner_document',
    'enterprise_knowledge','system','developer'
  )
$$;

-- ---- extracted_entities --------------------------------------------------
ALTER TABLE ingestion.extracted_entities
  ADD COLUMN IF NOT EXISTS trusted_source        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ingestion.extracted_entities
  ADD COLUMN IF NOT EXISTS instruction_authority TEXT NOT NULL DEFAULT 'none';
ALTER TABLE ingestion.extracted_entities
  ADD COLUMN IF NOT EXISTS content_origin        TEXT;

-- Add CHECKs after backfill; existing rows already have safe defaults.
ALTER TABLE ingestion.extracted_entities
  DROP CONSTRAINT IF EXISTS ext_entities_authority_chk;
ALTER TABLE ingestion.extracted_entities
  ADD CONSTRAINT ext_entities_authority_chk
  CHECK (ingestion.is_instruction_authority(instruction_authority));

ALTER TABLE ingestion.extracted_entities
  DROP CONSTRAINT IF EXISTS ext_entities_origin_chk;
ALTER TABLE ingestion.extracted_entities
  ADD CONSTRAINT ext_entities_origin_chk
  CHECK (content_origin IS NULL OR ingestion.is_content_origin(content_origin));

-- The hard invariant: external origins are never trusted and never
-- carry instruction authority beyond 'none'.
ALTER TABLE ingestion.extracted_entities
  DROP CONSTRAINT IF EXISTS ext_entities_trust_invariant;
ALTER TABLE ingestion.extracted_entities
  ADD CONSTRAINT ext_entities_trust_invariant
  CHECK (
    instruction_authority = 'none'
    OR (trusted_source = TRUE AND content_origin IN ('system','developer'))
  );

-- ---- extracted_relationships --------------------------------------------
ALTER TABLE ingestion.extracted_relationships
  ADD COLUMN IF NOT EXISTS trusted_source        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ingestion.extracted_relationships
  ADD COLUMN IF NOT EXISTS instruction_authority TEXT NOT NULL DEFAULT 'none';
ALTER TABLE ingestion.extracted_relationships
  ADD COLUMN IF NOT EXISTS content_origin        TEXT;

ALTER TABLE ingestion.extracted_relationships
  DROP CONSTRAINT IF EXISTS ext_rel_authority_chk;
ALTER TABLE ingestion.extracted_relationships
  ADD CONSTRAINT ext_rel_authority_chk
  CHECK (ingestion.is_instruction_authority(instruction_authority));

ALTER TABLE ingestion.extracted_relationships
  DROP CONSTRAINT IF EXISTS ext_rel_origin_chk;
ALTER TABLE ingestion.extracted_relationships
  ADD CONSTRAINT ext_rel_origin_chk
  CHECK (content_origin IS NULL OR ingestion.is_content_origin(content_origin));

ALTER TABLE ingestion.extracted_relationships
  DROP CONSTRAINT IF EXISTS ext_rel_trust_invariant;
ALTER TABLE ingestion.extracted_relationships
  ADD CONSTRAINT ext_rel_trust_invariant
  CHECK (
    instruction_authority = 'none'
    OR (trusted_source = TRUE AND content_origin IN ('system','developer'))
  );

-- ---- extracted_facts ----------------------------------------------------
ALTER TABLE ingestion.extracted_facts
  ADD COLUMN IF NOT EXISTS trusted_source        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ingestion.extracted_facts
  ADD COLUMN IF NOT EXISTS instruction_authority TEXT NOT NULL DEFAULT 'none';
ALTER TABLE ingestion.extracted_facts
  ADD COLUMN IF NOT EXISTS content_origin        TEXT;

ALTER TABLE ingestion.extracted_facts
  DROP CONSTRAINT IF EXISTS ext_facts_authority_chk;
ALTER TABLE ingestion.extracted_facts
  ADD CONSTRAINT ext_facts_authority_chk
  CHECK (ingestion.is_instruction_authority(instruction_authority));

ALTER TABLE ingestion.extracted_facts
  DROP CONSTRAINT IF EXISTS ext_facts_origin_chk;
ALTER TABLE ingestion.extracted_facts
  ADD CONSTRAINT ext_facts_origin_chk
  CHECK (content_origin IS NULL OR ingestion.is_content_origin(content_origin));

ALTER TABLE ingestion.extracted_facts
  DROP CONSTRAINT IF EXISTS ext_facts_trust_invariant;
ALTER TABLE ingestion.extracted_facts
  ADD CONSTRAINT ext_facts_trust_invariant
  CHECK (
    instruction_authority = 'none'
    OR (trusted_source = TRUE AND content_origin IN ('system','developer'))
  );

-- ============================================================================
-- Refresh the public views that proxy these tables so the SDK sees the
-- new columns without further changes.
-- ============================================================================
CREATE OR REPLACE VIEW public.ingestion_extracted_entities      AS SELECT * FROM ingestion.extracted_entities;
CREATE OR REPLACE VIEW public.ingestion_extracted_relationships AS SELECT * FROM ingestion.extracted_relationships;
CREATE OR REPLACE VIEW public.ingestion_extracted_facts         AS SELECT * FROM ingestion.extracted_facts;

-- ============================================================================
-- Self-test
-- ============================================================================
DO $$
DECLARE
  expected TEXT[] := ARRAY[
    'extracted_entities.trusted_source',
    'extracted_entities.instruction_authority',
    'extracted_entities.content_origin',
    'extracted_relationships.trusted_source',
    'extracted_relationships.instruction_authority',
    'extracted_relationships.content_origin',
    'extracted_facts.trusted_source',
    'extracted_facts.instruction_authority',
    'extracted_facts.content_origin'
  ];
  pair TEXT;
  parts TEXT[];
BEGIN
  FOREACH pair IN ARRAY expected LOOP
    parts := string_to_array(pair, '.');
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'ingestion'
        AND table_name = parts[1]
        AND column_name = parts[2]
    ) THEN
      RAISE EXCEPTION '096 self-test: missing column %', pair;
    END IF;
  END LOOP;
END $$;
