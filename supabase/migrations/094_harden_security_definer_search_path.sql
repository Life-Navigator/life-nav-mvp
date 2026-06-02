-- ============================================================================
-- 094: Harden SECURITY DEFINER functions — pin search_path
--
-- Sprint N.2 Phase 5 platform hardening.
--
-- Without an explicit `search_path`, a SECURITY DEFINER function inherits
-- the caller's search_path. A malicious caller can shadow built-in
-- objects (operator, function, table) in a transient schema and weaponize
-- the elevated privileges. Supabase's database linter flags this as
-- "Function Search Path Mutable" (level: WARN).
--
-- This migration enumerates every SECURITY DEFINER function in the
-- managed schemas and pins its `search_path` to the safe default:
--
--   ALTER FUNCTION <fn>(<args>) SET search_path = public, pg_catalog, pg_temp
--
-- It then self-tests by asserting no SECURITY DEFINER function in those
-- schemas remains without a pinned search_path.
--
-- The migration is idempotent: ALTER FUNCTION ... SET overwrites the
-- prior config; the self-test passes once all functions are pinned.
-- ============================================================================

DO $$
DECLARE
  fn RECORD;
  managed_schemas TEXT[] := ARRAY[
    'public',
    'governance',
    'graphrag',
    'ingestion',
    'ops',
    'platform',
    'connectors',
    'models',
    'auth_ext'
  ];
  altered_count INT := 0;
BEGIN
  FOR fn IN
    SELECT n.nspname  AS schema_name,
           p.proname  AS function_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef = TRUE                 -- SECURITY DEFINER
      AND n.nspname = ANY (managed_schemas)
      AND NOT EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::TEXT[])) cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_catalog, pg_temp',
      fn.schema_name, fn.function_name, fn.args
    );
    altered_count := altered_count + 1;
  END LOOP;

  RAISE NOTICE '094: pinned search_path on % SECURITY DEFINER function(s)', altered_count;
END $$;

-- ----------------------------------------------------------------------------
-- Self-test — fail the migration if any SECURITY DEFINER function in the
-- managed schemas is still missing an explicit search_path.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  bad RECORD;
  bad_list TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOR bad IN
    SELECT n.nspname AS schema_name, p.proname AS function_name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef = TRUE
      AND n.nspname IN (
        'public','governance','graphrag','ingestion','ops',
        'platform','connectors','models','auth_ext'
      )
      AND NOT EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::TEXT[])) cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    bad_list := bad_list || (bad.schema_name || '.' || bad.function_name);
  END LOOP;

  IF array_length(bad_list, 1) > 0 THEN
    RAISE EXCEPTION '094 self-test: SECURITY DEFINER functions without search_path: %', bad_list;
  END IF;
END $$;
