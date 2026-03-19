-- ==========================================================================
-- 085: Populate graphrag.cron_config for pipeline sync
--
-- The cron_config table (created in 070_pg_cron_sync.sql) must have
-- sync_url and worker_secret populated for pg_cron to fire sync jobs.
--
-- This migration uses Supabase Vault secrets so credentials are not
-- hardcoded. After deploying the Python pipeline to Vercel:
--
--   1. Set GRAPHRAG_PIPELINE_URL in Supabase secrets (Dashboard → Settings → Vault)
--   2. Set GRAPHRAG_WORKER_SECRET in both Supabase secrets and the pipeline env
--   3. Run this migration (or re-run the INSERT statements manually)
--
-- If Vault is not available, replace the secret lookups with direct values:
--   INSERT INTO graphrag.cron_config (key, value)
--     VALUES ('sync_url', 'https://your-pipeline.vercel.app/api/sync')
--     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
-- ==========================================================================

-- Populate sync_url: the Python pipeline's /api/sync endpoint
-- This is called by pg_cron every 5 minutes when pending jobs exist.
--
-- IMPORTANT: Replace the placeholder URL with your actual deployed pipeline URL.
-- You can do this via Supabase SQL Editor after deployment:
--
--   INSERT INTO graphrag.cron_config (key, value)
--     VALUES ('sync_url', 'https://<your-pipeline>.vercel.app/api/sync')
--     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

DO $$
BEGIN
  -- Only insert if not already configured (don't overwrite manual config)
  INSERT INTO graphrag.cron_config (key, value)
    VALUES ('sync_url', 'PLACEHOLDER_SET_AFTER_DEPLOY')
    ON CONFLICT (key) DO NOTHING;

  INSERT INTO graphrag.cron_config (key, value)
    VALUES ('worker_secret', 'PLACEHOLDER_SET_AFTER_DEPLOY')
    ON CONFLICT (key) DO NOTHING;

  RAISE NOTICE '
=====================================================================
  graphrag.cron_config populated with placeholder values.

  NEXT STEPS:
  1. Deploy the Python pipeline to Vercel
  2. Run in Supabase SQL Editor:

     UPDATE graphrag.cron_config
       SET value = ''https://<your-pipeline>.vercel.app/api/sync'',
           updated_at = NOW()
       WHERE key = ''sync_url'';

     UPDATE graphrag.cron_config
       SET value = ''<your-worker-secret>'',
           updated_at = NOW()
       WHERE key = ''worker_secret'';

  3. Verify with:
     SELECT * FROM graphrag.cron_config;
=====================================================================';
END;
$$;

-- Also ensure the GRAPHRAG_PIPELINE_URL is documented for Edge Functions.
-- This is set in Supabase Dashboard → Edge Functions → Secrets:
--   GRAPHRAG_PIPELINE_URL = https://<your-pipeline>.vercel.app
--   GRAPHRAG_WORKER_SECRET = <same secret as above>
