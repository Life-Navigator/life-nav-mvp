-- RLS Self-Test (MVP Supabase Ingestion)
-- Run in Supabase SQL editor or psql after migrations.

-- 1) Every table in core/finance/health_meta must have RLS enabled.
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('core', 'finance', 'health_meta')
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY 1, 2;

-- 2) Every table in core/finance/health_meta should have at least one policy.
SELECT
  t.schemaname AS schema_name,
  t.tablename AS table_name
FROM pg_tables t
LEFT JOIN pg_policies p
  ON p.schemaname = t.schemaname
 AND p.tablename = t.tablename
WHERE t.schemaname IN ('core', 'finance', 'health_meta')
GROUP BY t.schemaname, t.tablename
HAVING COUNT(p.policyname) = 0
ORDER BY 1, 2;

-- 3) Queue mutation should not be granted to authenticated directly.
-- Expected: zero rows.
SELECT
  grantee,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'core'
  AND table_name IN ('ingestion_jobs', 'ingestion_results', 'integration_tokens', 'internal_requests')
  AND grantee = 'authenticated'
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
ORDER BY 1, 2, 3, 4;

-- 4) Ensure RPC queue functions are executable by service_role.
-- Expected: every row has can_execute = true.
SELECT
  function_name,
  has_function_privilege(
    'service_role',
    function_signature,
    'EXECUTE'
  ) AS can_execute
FROM (
  VALUES
    ('claim_ingestion_jobs', 'core.claim_ingestion_jobs(integer,text,integer)'),
    ('complete_ingestion_job', 'core.complete_ingestion_job(uuid,jsonb)'),
    ('fail_ingestion_job', 'core.fail_ingestion_job(uuid,text,integer)'),
    ('register_internal_request', 'core.register_internal_request(text,text,text,integer)'),
    ('upsert_integration_token', 'core.upsert_integration_token(uuid,text,text,text,timestamp with time zone,text,text,text,jsonb,text)'),
    ('disconnect_integration', 'core.disconnect_integration(uuid,text)')
) AS f(function_name, function_signature);

-- 5) Storage bucket posture check for private buckets.
-- Expected: public = false for documents and insurance-cards.
SELECT id, name, public
FROM storage.buckets
WHERE id IN ('documents', 'insurance-cards')
ORDER BY id;
