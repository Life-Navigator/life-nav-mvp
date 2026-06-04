-- 105_finance_graphrag_api_grants.sql
--
-- The `finance` and `graphrag` schemas are in PostgREST's exposed db_schema
-- list, but the API roles (service_role / authenticated) were never granted
-- access to their tables — so REST calls returned 403 ("permission denied"),
-- which left the web app unable to read or write financial data at all.
--
-- This grants the minimum needed for:
--   * the server-side persona-activation flow (service_role) to persist Plaid
--     items / accounts / transactions and enqueue graph-promotion jobs, and
--   * the authenticated dashboard reads (RLS still scopes rows per user).
--
-- Idempotent: GRANT/ALTER DEFAULT PRIVILEGES can be re-run safely.

-- Schema usage.
GRANT USAGE ON SCHEMA finance  TO service_role, authenticated;
GRANT USAGE ON SCHEMA graphrag TO service_role, authenticated;

-- finance: service_role writes (bypasses RLS); authenticated reads under RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA finance TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA finance TO authenticated;
GRANT USAGE, SELECT                  ON ALL SEQUENCES  IN SCHEMA finance TO service_role, authenticated;

-- graphrag: service_role drives the sync queue + enqueue function.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA graphrag TO service_role;
GRANT USAGE, SELECT                  ON ALL SEQUENCES  IN SCHEMA graphrag TO service_role;
GRANT EXECUTE ON FUNCTION graphrag.enqueue_sync(uuid, text, uuid, text, text, jsonb)
  TO service_role, authenticated;

-- Future tables in these schemas inherit the same grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA finance
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA graphrag
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
