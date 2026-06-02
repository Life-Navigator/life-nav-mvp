-- ==========================================================================
-- 093 verifier — Enterprise Foundation & API Platform (Sprint P).
--
-- Assertions:
--   1. platform / connectors / models schemas exist.
--   2. 9 expected tables exist.
--   3. RLS enabled on every table.
--   4. platform.is_tenant_member() SECURITY DEFINER helper exists with
--      pinned search_path.
--   5. Seed: ≥ 11 BYOM models + ≥ 12 connectors registered.
--   6. Cross-tenant RLS leak: User A (member of tenant T1 only) cannot
--      read tenant T2 rows.
--   7. tenant_api_keys.key_hash uniqueness is enforced.
-- ==========================================================================
BEGIN;

-- ---- 1. Schemas ----------------------------------------------------------
DO $$
DECLARE
  s TEXT;
  schemas TEXT[] := ARRAY['platform','connectors','models'];
BEGIN
  FOREACH s IN ARRAY schemas LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = s) THEN
      RAISE EXCEPTION '093: schema % is missing', s;
    END IF;
  END LOOP;
END $$;

-- ---- 2. Tables present ---------------------------------------------------
DO $$
DECLARE
  t TEXT;
  parts TEXT[];
  required TEXT[] := ARRAY[
    'platform.tenants',
    'platform.tenant_users',
    'platform.tenant_api_keys',
    'platform.tenant_api_usage',
    'platform.tenant_quotas',
    'connectors.connector_registry',
    'connectors.tenant_connections',
    'models.model_registry',
    'models.tenant_model_overrides'
  ];
BEGIN
  FOREACH t IN ARRAY required LOOP
    parts := string_to_array(t, '.');
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = parts[1] AND c.relname = parts[2] AND c.relkind = 'r'
    ) THEN
      RAISE EXCEPTION '093: missing table %', t;
    END IF;
  END LOOP;
END $$;

-- ---- 3. RLS enabled on every table --------------------------------------
DO $$
DECLARE
  t TEXT;
  parts TEXT[];
  rls BOOLEAN;
  rls_targets TEXT[] := ARRAY[
    'platform.tenants',
    'platform.tenant_users',
    'platform.tenant_api_keys',
    'platform.tenant_api_usage',
    'platform.tenant_quotas',
    'connectors.connector_registry',
    'connectors.tenant_connections',
    'models.model_registry',
    'models.tenant_model_overrides'
  ];
BEGIN
  FOREACH t IN ARRAY rls_targets LOOP
    parts := string_to_array(t, '.');
    SELECT c.relrowsecurity INTO rls
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = parts[1] AND c.relname = parts[2];
    IF NOT rls THEN
      RAISE EXCEPTION '093: RLS not enabled on %', t;
    END IF;
  END LOOP;
END $$;

-- ---- 4. is_tenant_member helper exists with pinned search_path ---------
DO $$
DECLARE
  cfg TEXT[];
  pinned BOOLEAN := FALSE;
BEGIN
  SELECT p.proconfig INTO cfg
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'platform' AND p.proname = 'is_tenant_member'
  LIMIT 1;
  IF cfg IS NULL THEN
    RAISE EXCEPTION '093: platform.is_tenant_member is missing';
  END IF;
  FOR i IN 1..array_length(cfg,1) LOOP
    IF cfg[i] LIKE 'search_path=%' THEN pinned := TRUE; END IF;
  END LOOP;
  IF NOT pinned THEN
    RAISE EXCEPTION '093: platform.is_tenant_member missing pinned search_path';
  END IF;
END $$;

-- ---- 5. Seeded models + connectors --------------------------------------
DO $$
DECLARE n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM models.model_registry;
  IF n < 11 THEN
    RAISE EXCEPTION '093: expected ≥ 11 seeded models, found %', n;
  END IF;

  SELECT COUNT(*) INTO n FROM connectors.connector_registry;
  IF n < 12 THEN
    RAISE EXCEPTION '093: expected ≥ 12 seeded connectors, found %', n;
  END IF;
END $$;

-- ---- 6. Cross-tenant RLS leak test --------------------------------------
DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at) VALUES
    ('00000000-0000-0000-0000-00000Tnusr01','tn-1@lifenav.test',crypt('x',gen_salt('bf')),NOW(),NOW()),
    ('00000000-0000-0000-0000-00000Tnusr02','tn-2@lifenav.test',crypt('x',gen_salt('bf')),NOW(),NOW())
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO platform.tenants (id, slug, display_name, isolation_mode)
VALUES
  ('00000000-0000-0000-0000-0000Tenan0001','tenant-a','Tenant A','shared'),
  ('00000000-0000-0000-0000-0000Tenan0002','tenant-b','Tenant B','shared')
ON CONFLICT (id) DO NOTHING;

INSERT INTO platform.tenant_users (tenant_id, user_id, role)
VALUES
  ('00000000-0000-0000-0000-0000Tenan0001','00000000-0000-0000-0000-00000Tnusr01','owner'),
  ('00000000-0000-0000-0000-0000Tenan0002','00000000-0000-0000-0000-00000Tnusr02','owner')
ON CONFLICT DO NOTHING;

DO $$
DECLARE n INT;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-00000Tnusr01')::text, true);
  PERFORM set_config('role','authenticated', true);

  SELECT COUNT(*) INTO n FROM platform.tenants WHERE id = '00000000-0000-0000-0000-0000Tenan0002';
  IF n <> 0 THEN
    RAISE EXCEPTION '093 RLS LEAK: User A saw Tenant B row';
  END IF;

  RESET role;
  PERFORM set_config('request.jwt.claims','',true);
END $$;

-- ---- 7. tenant_api_keys.key_hash uniqueness -----------------------------
DO $$
DECLARE blocked BOOLEAN := FALSE;
BEGIN
  INSERT INTO platform.tenant_api_keys (id, tenant_id, prefix, key_hash, label, created_by)
  VALUES
    ('00000000-0000-0000-0000-000Apikey0001','00000000-0000-0000-0000-0000Tenan0001','lnk_test_aaa',
     'hash_collision_test', 'first', '00000000-0000-0000-0000-00000Tnusr01')
  ON CONFLICT DO NOTHING;
  BEGIN
    INSERT INTO platform.tenant_api_keys (id, tenant_id, prefix, key_hash, label, created_by)
    VALUES
      ('00000000-0000-0000-0000-000Apikey0002','00000000-0000-0000-0000-0000Tenan0001','lnk_test_bbb',
       'hash_collision_test', 'second', '00000000-0000-0000-0000-00000Tnusr01');
  EXCEPTION WHEN unique_violation THEN
    blocked := TRUE;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION '093: duplicate key_hash should be rejected by unique constraint';
  END IF;
END $$;

ROLLBACK;
