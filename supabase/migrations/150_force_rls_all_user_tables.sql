-- 150 — Sprint 27 Security Gate: FORCE row-level security on EVERY app table that has RLS
-- enabled but not forced (closes the owner-bypass gap platform-wide). Reference/system schemas
-- excluded. Idempotent.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS sch, c.relname AS tbl
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='r' AND c.relrowsecurity=true AND c.relforcerowsecurity=false
      AND n.nspname IN ('core','finance','health','health_meta','career','education','family',
                        'decision','documents','reporting','analytics','platform','recommendations','graphrag')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', r.sch, r.tbl);
  END LOOP;
END $$;
