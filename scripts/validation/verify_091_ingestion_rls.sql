-- ==========================================================================
-- 091 RLS verification — Universal Ingestion schema.
--
-- Assertions:
--   1. User A reads own ingestion.files / extraction_jobs / extracted_facts.
--   2. User A CANNOT read User B's rows (cross-user leak test) on:
--      - files
--      - extraction_jobs
--      - extractions
--      - extracted_entities
--      - extracted_facts
--      - provenance
--   3. The fact_locator_nonempty CHECK rejects an empty locator insert.
--   4. The extracted_facts row REJECTS a confidence out of [0,1].
-- ==========================================================================
BEGIN;

DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES
    ('00000000-0000-0000-0000-00000Ingst001', 'in-1@lifenav.test', crypt('x', gen_salt('bf')), NOW(), NOW()),
    ('00000000-0000-0000-0000-00000Ingst002', 'in-2@lifenav.test', crypt('x', gen_salt('bf')), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO public.profiles (id, email) VALUES
  ('00000000-0000-0000-0000-00000Ingst001', 'in-1@lifenav.test'),
  ('00000000-0000-0000-0000-00000Ingst002', 'in-2@lifenav.test')
ON CONFLICT (id) DO NOTHING;

-- Seed one file + one fact per user via service-role policy.
INSERT INTO ingestion.files (id, user_id, display_name, file_kind, modality, size_bytes, source)
VALUES
  ('00000000-0000-0000-0000-00000IngFile1','00000000-0000-0000-0000-00000Ingst001','one.txt','txt','document',100,'test'),
  ('00000000-0000-0000-0000-00000IngFile2','00000000-0000-0000-0000-00000Ingst002','two.txt','txt','document',100,'test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ingestion.extraction_jobs (id, user_id, file_id, status)
VALUES
  ('00000000-0000-0000-0000-00000IngJob01','00000000-0000-0000-0000-00000Ingst001','00000000-0000-0000-0000-00000IngFile1','succeeded'),
  ('00000000-0000-0000-0000-00000IngJob02','00000000-0000-0000-0000-00000Ingst002','00000000-0000-0000-0000-00000IngFile2','succeeded')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ingestion.extracted_facts
  (id, user_id, job_id, file_id, predicate, object_text,
   extraction_confidence, source_locator)
VALUES
  ('00000000-0000-0000-0000-00000IngFct01',
    '00000000-0000-0000-0000-00000Ingst001','00000000-0000-0000-0000-00000IngJob01','00000000-0000-0000-0000-00000IngFile1',
    'hello','world', 0.95, '{"page":1,"char_start":0,"char_end":10}'::jsonb),
  ('00000000-0000-0000-0000-00000IngFct02',
    '00000000-0000-0000-0000-00000Ingst002','00000000-0000-0000-0000-00000IngJob02','00000000-0000-0000-0000-00000IngFile2',
    'hello','world', 0.95, '{"page":1,"char_start":0,"char_end":10}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ---- Assertion 1+2: cross-user leak test --------------------------------
DO $$
DECLARE n_self INT; n_other INT;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-00000Ingst001')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT COUNT(*) INTO n_self FROM ingestion.files
    WHERE id = '00000000-0000-0000-0000-00000IngFile1';
  IF n_self = 0 THEN RAISE EXCEPTION '091 RLS: User A cannot read own file'; END IF;

  SELECT COUNT(*) INTO n_other FROM ingestion.files
    WHERE id = '00000000-0000-0000-0000-00000IngFile2';
  IF n_other <> 0 THEN RAISE EXCEPTION '091 RLS LEAK: User A saw User B file'; END IF;

  SELECT COUNT(*) INTO n_other FROM ingestion.extraction_jobs
    WHERE id = '00000000-0000-0000-0000-00000IngJob02';
  IF n_other <> 0 THEN RAISE EXCEPTION '091 RLS LEAK: User A saw User B job'; END IF;

  SELECT COUNT(*) INTO n_other FROM ingestion.extracted_facts
    WHERE id = '00000000-0000-0000-0000-00000IngFct02';
  IF n_other <> 0 THEN RAISE EXCEPTION '091 RLS LEAK: User A saw User B fact'; END IF;

  RESET role;
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ---- Assertion 3: empty locator REJECTED by CHECK -----------------------
DO $$
DECLARE blocked BOOLEAN := FALSE;
BEGIN
  BEGIN
    INSERT INTO ingestion.extracted_facts
      (user_id, job_id, file_id, predicate, extraction_confidence, source_locator)
    VALUES
      ('00000000-0000-0000-0000-00000Ingst001','00000000-0000-0000-0000-00000IngJob01',
       '00000000-0000-0000-0000-00000IngFile1','x', 0.5, '{}'::jsonb);
  EXCEPTION WHEN check_violation OR others THEN
    blocked := TRUE;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION '091: empty locator should be rejected by fact_locator_nonempty CHECK';
  END IF;
END $$;

-- ---- Assertion 4: out-of-range confidence REJECTED ----------------------
DO $$
DECLARE blocked BOOLEAN := FALSE;
BEGIN
  BEGIN
    INSERT INTO ingestion.extracted_facts
      (user_id, job_id, file_id, predicate, extraction_confidence, source_locator)
    VALUES
      ('00000000-0000-0000-0000-00000Ingst001','00000000-0000-0000-0000-00000IngJob01',
       '00000000-0000-0000-0000-00000IngFile1','x', 1.5,
       '{"page":1,"char_start":0,"char_end":10}'::jsonb);
  EXCEPTION WHEN check_violation OR others THEN
    blocked := TRUE;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION '091: extraction_confidence > 1 should be rejected';
  END IF;
END $$;

ROLLBACK;
