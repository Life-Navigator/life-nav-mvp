-- ==========================================================================
-- 070: pg_cron + pg_net for GraphRAG Sync Scheduling
--
-- Replaces external cron (Vercel cron, GitHub Actions, etc.) with
-- Supabase-native pg_cron + pg_net. Calls the GraphRAG sync endpoint
-- every 5 minutes from within Postgres.
--
-- Requirements:
--   - pg_cron and pg_net extensions enabled in Supabase Dashboard
--     (Database → Extensions → search "pg_cron" / "pg_net" → enable)
--   - GRAPHRAG_WORKER_SECRET set as a Supabase secret
--   - GraphRAG sync Edge Function deployed
-- ==========================================================================

-- Enable extensions (idempotent — these may already be enabled via Dashboard)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Helper: Build the sync HTTP request
-- ---------------------------------------------------------------------------
-- We store the sync URL and secret in a config table so the cron job
-- can reference them without hardcoding. This is updated at deploy time.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS graphrag.cron_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE graphrag.cron_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cron_config_service_only" ON graphrag.cron_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE graphrag.cron_config IS
  'Runtime config for pg_cron sync jobs. Set sync_url and worker_secret after deploy.';

-- ---------------------------------------------------------------------------
-- Function: fire the sync HTTP request via pg_net
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION graphrag.fire_sync_request()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = graphrag, extensions, public
AS $$
DECLARE
  v_sync_url TEXT;
  v_worker_secret TEXT;
  v_request_id BIGINT;
  v_got_lock BOOLEAN;
BEGIN
  -- Advisory lock prevents stacked executions if sync runs > 5 min
  SELECT pg_try_advisory_lock(42) INTO v_got_lock;
  IF NOT v_got_lock THEN
    RAISE NOTICE 'graphrag.fire_sync_request: another sync in progress, skipping';
    RETURN;
  END IF;

  -- Read config
  SELECT value INTO v_sync_url FROM graphrag.cron_config WHERE key = 'sync_url';
  SELECT value INTO v_worker_secret FROM graphrag.cron_config WHERE key = 'worker_secret';

  IF v_sync_url IS NULL THEN
    PERFORM pg_advisory_unlock(42);
    RAISE NOTICE 'graphrag.fire_sync_request: sync_url not configured, skipping';
    RETURN;
  END IF;

  -- Check if there are pending jobs before making the HTTP call
  IF NOT EXISTS (
    SELECT 1 FROM graphrag.sync_queue
    WHERE sync_status = 'pending' AND attempts < max_attempts
    LIMIT 1
  ) THEN
    PERFORM pg_advisory_unlock(42);
    RETURN;  -- No work to do
  END IF;

  -- Fire async HTTP POST via pg_net
  SELECT net.http_post(
    url := v_sync_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-secret', COALESCE(v_worker_secret, '')
    ),
    body := '{"limit": 50}'::jsonb
  ) INTO v_request_id;

  PERFORM pg_advisory_unlock(42);
  RAISE NOTICE 'graphrag.fire_sync_request: dispatched request_id=%', v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION graphrag.fire_sync_request FROM PUBLIC;
GRANT EXECUTE ON FUNCTION graphrag.fire_sync_request TO service_role;

-- ---------------------------------------------------------------------------
-- Schedule: every 5 minutes
-- ---------------------------------------------------------------------------
-- pg_cron uses standard cron syntax. */5 = every 5 minutes.
-- The job runs as the database owner (postgres).
-- ---------------------------------------------------------------------------

SELECT cron.schedule(
  'graphrag-sync-every-5min',
  '*/5 * * * *',
  $$SELECT graphrag.fire_sync_request()$$
);

-- ---------------------------------------------------------------------------
-- Cleanup: purge completed sync_queue rows older than 7 days (daily at 3 AM)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION graphrag.purge_completed_jobs()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = graphrag, public
AS $$
BEGIN
  DELETE FROM graphrag.sync_queue
  WHERE sync_status = 'completed'
    AND processed_at < NOW() - INTERVAL '7 days';

  DELETE FROM graphrag.sync_queue
  WHERE sync_status = 'dead'
    AND processed_at < NOW() - INTERVAL '30 days';

  -- Purge expired query cache entries
  DELETE FROM graphrag.query_cache
  WHERE expires_at < NOW();
END;
$$;

REVOKE ALL ON FUNCTION graphrag.purge_completed_jobs FROM PUBLIC;
GRANT EXECUTE ON FUNCTION graphrag.purge_completed_jobs TO service_role;

SELECT cron.schedule(
  'graphrag-purge-daily',
  '0 3 * * *',
  $$SELECT graphrag.purge_completed_jobs()$$
);
