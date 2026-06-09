-- 158 — Sprint 45 D6: FORCE RLS on the SAFE-TO-FORCE class — public tables that already have RLS
-- enabled AND are user_id-scoped (app-owned user data). Closes the owner-bypass gap for these
-- without touching no-user_id tables (needs-review) or system/Supabase-managed schemas.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='r' AND c.relrowsecurity AND NOT c.relforcerowsecurity AND n.nspname='public'
      AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='user_id')
  LOOP
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.relname);
  END LOOP;
END $$;
