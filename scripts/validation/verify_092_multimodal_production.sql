-- ==========================================================================
-- 092 verifier — Multimodal Production (Sprint N.1 / N.2 hardening).
--
-- Assertions:
--   1. The three Sprint N.1 tables exist in ingestion:
--        malware_scans, extraction_telemetry, multimodal_cost_meter
--   2. RLS enabled on each.
--   3. The check helpers exist: is_scanner, is_telemetry_status,
--      is_cost_kind, is_scan_status (091 dependency).
--   4. Invalid scanner / status / cost_kind values are REJECTED by CHECK.
--   5. Cross-user RLS leak: User A cannot read User B's malware_scans row.
--   6. Public views ingestion_malware_scans / ingestion_extraction_telemetry
--      / ingestion_multimodal_cost_meter exist.
-- ==========================================================================
BEGIN;

-- ---- 1. Tables present --------------------------------------------------
DO $$
DECLARE
  t TEXT;
  required TEXT[] := ARRAY[
    'ingestion.malware_scans',
    'ingestion.extraction_telemetry',
    'ingestion.multimodal_cost_meter'
  ];
  parts TEXT[];
BEGIN
  FOREACH t IN ARRAY required LOOP
    parts := string_to_array(t, '.');
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = parts[1] AND c.relname = parts[2] AND c.relkind = 'r'
    ) THEN
      RAISE EXCEPTION '092: missing table %', t;
    END IF;
  END LOOP;
END $$;

-- ---- 2. RLS enabled ------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  parts TEXT[];
  rls BOOLEAN;
  rls_targets TEXT[] := ARRAY[
    'ingestion.malware_scans',
    'ingestion.extraction_telemetry',
    'ingestion.multimodal_cost_meter'
  ];
BEGIN
  FOREACH t IN ARRAY rls_targets LOOP
    parts := string_to_array(t, '.');
    SELECT c.relrowsecurity INTO rls
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = parts[1] AND c.relname = parts[2];
    IF NOT rls THEN
      RAISE EXCEPTION '092: RLS not enabled on %', t;
    END IF;
  END LOOP;
END $$;

-- ---- 3. Check helpers exist ---------------------------------------------
DO $$
DECLARE
  fns TEXT[] := ARRAY['is_scanner','is_telemetry_status','is_cost_kind','is_scan_status'];
  fn TEXT;
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'ingestion' AND p.proname = fn
    ) THEN
      RAISE EXCEPTION '092: missing ingestion.%() helper', fn;
    END IF;
  END LOOP;
END $$;

-- ---- 4. Seed two users + reject invalid enum values ---------------------
DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES
    ('00000000-0000-0000-0000-00000Mmscan1','mm-1@lifenav.test',crypt('x',gen_salt('bf')),NOW(),NOW()),
    ('00000000-0000-0000-0000-00000Mmscan2','mm-2@lifenav.test',crypt('x',gen_salt('bf')),NOW(),NOW())
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO public.profiles (id, email) VALUES
  ('00000000-0000-0000-0000-00000Mmscan1','mm-1@lifenav.test'),
  ('00000000-0000-0000-0000-00000Mmscan2','mm-2@lifenav.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ingestion.files (id, user_id, display_name, file_kind, modality, size_bytes, source)
VALUES
  ('00000000-0000-0000-0000-00000MmFile01','00000000-0000-0000-0000-00000Mmscan1','a.txt','txt','document',10,'test'),
  ('00000000-0000-0000-0000-00000MmFile02','00000000-0000-0000-0000-00000Mmscan2','b.txt','txt','document',10,'test')
ON CONFLICT (id) DO NOTHING;

-- 4a. Invalid scanner REJECTED
DO $$
DECLARE blocked BOOLEAN := FALSE;
BEGIN
  BEGIN
    INSERT INTO ingestion.malware_scans (user_id, file_id, scanner, status)
    VALUES (
      '00000000-0000-0000-0000-00000Mmscan1',
      '00000000-0000-0000-0000-00000MmFile01',
      'totally_made_up_scanner', 'clean'
    );
  EXCEPTION WHEN check_violation OR others THEN blocked := TRUE; END;
  IF NOT blocked THEN RAISE EXCEPTION '092: accepted bogus scanner'; END IF;
END $$;

-- 4b. Invalid status REJECTED
DO $$
DECLARE blocked BOOLEAN := FALSE;
BEGIN
  BEGIN
    INSERT INTO ingestion.malware_scans (user_id, file_id, scanner, status)
    VALUES (
      '00000000-0000-0000-0000-00000Mmscan1',
      '00000000-0000-0000-0000-00000MmFile01',
      'clamav', 'invented_status'
    );
  EXCEPTION WHEN check_violation OR others THEN blocked := TRUE; END;
  IF NOT blocked THEN RAISE EXCEPTION '092: accepted bogus scan status'; END IF;
END $$;

-- 4c. Invalid cost_kind REJECTED
DO $$
DECLARE blocked BOOLEAN := FALSE;
BEGIN
  BEGIN
    INSERT INTO ingestion.multimodal_cost_meter (
      user_id, extractor_name, cost_kind, cost_usd_micros, units
    ) VALUES (
      '00000000-0000-0000-0000-00000Mmscan1',
      'vision-prod', 'invented_kind', 0, 1
    );
  EXCEPTION WHEN check_violation OR others THEN blocked := TRUE; END;
  IF NOT blocked THEN RAISE EXCEPTION '092: accepted bogus cost_kind'; END IF;
END $$;

-- ---- 5. Cross-user RLS leak test -----------------------------------------
INSERT INTO ingestion.malware_scans (id, user_id, file_id, scanner, status)
VALUES
  ('00000000-0000-0000-0000-00000MmScn01','00000000-0000-0000-0000-00000Mmscan1','00000000-0000-0000-0000-00000MmFile01','clamav','clean'),
  ('00000000-0000-0000-0000-00000MmScn02','00000000-0000-0000-0000-00000Mmscan2','00000000-0000-0000-0000-00000MmFile02','clamav','clean')
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE n INT;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-00000Mmscan1')::text, true);
  PERFORM set_config('role','authenticated',true);

  SELECT COUNT(*) INTO n FROM ingestion.malware_scans WHERE id = '00000000-0000-0000-0000-00000MmScn02';
  IF n <> 0 THEN
    RAISE EXCEPTION '092 RLS LEAK: User A saw User B malware_scans row';
  END IF;

  RESET role;
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ---- 6. Public views exist ----------------------------------------------
DO $$
DECLARE
  v TEXT;
  views TEXT[] := ARRAY[
    'ingestion_malware_scans',
    'ingestion_extraction_telemetry',
    'ingestion_multimodal_cost_meter'
  ];
BEGIN
  FOREACH v IN ARRAY views LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = v AND c.relkind = 'v'
    ) THEN
      RAISE EXCEPTION '092: missing public view %', v;
    END IF;
  END LOOP;
END $$;

ROLLBACK;
