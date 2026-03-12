-- ==========================================================================
-- 050: GraphRAG Schema
-- Sync queue for Neo4j Aura + Qdrant Cloud, query cache
-- ==========================================================================

CREATE SCHEMA IF NOT EXISTS graphrag;
GRANT USAGE ON SCHEMA graphrag TO authenticated, service_role;

-- Sync queue: tracks entities that need syncing to Neo4j + Qdrant
CREATE TABLE IF NOT EXISTS graphrag.sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  source_table TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
  payload JSONB NOT NULL DEFAULT '{}',
  neo4j_synced BOOLEAN NOT NULL DEFAULT FALSE,
  qdrant_synced BOOLEAN NOT NULL DEFAULT FALSE,
  sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'processing', 'completed', 'failed', 'dead')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_sync_queue_pending ON graphrag.sync_queue(sync_status, created_at)
  WHERE sync_status = 'pending';
CREATE INDEX idx_sync_queue_user ON graphrag.sync_queue(user_id);

ALTER TABLE graphrag.sync_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync_queue_service" ON graphrag.sync_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Query cache
CREATE TABLE IF NOT EXISTS graphrag.query_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  query_hash TEXT NOT NULL,
  query_text TEXT NOT NULL,
  response JSONB NOT NULL,
  sources JSONB,
  confidence NUMERIC(4,3),
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour')
);

CREATE INDEX idx_query_cache_lookup ON graphrag.query_cache(user_id, query_hash, expires_at);

ALTER TABLE graphrag.query_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cache_own" ON graphrag.query_cache
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cache_service" ON graphrag.query_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Enqueue function: called by triggers on source tables
CREATE OR REPLACE FUNCTION graphrag.enqueue_sync(
  p_user_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_source_table TEXT,
  p_operation TEXT DEFAULT 'upsert',
  p_payload JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = graphrag, public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO graphrag.sync_queue (
    user_id, entity_type, entity_id, source_table, operation, payload
  ) VALUES (
    p_user_id, p_entity_type, p_entity_id, p_source_table, p_operation, p_payload
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Claim function: used by Edge Function sync worker
CREATE OR REPLACE FUNCTION graphrag.claim_sync_jobs(
  p_limit INT DEFAULT 50
)
RETURNS SETOF graphrag.sync_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = graphrag, public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id FROM graphrag.sync_queue
    WHERE sync_status = 'pending'
      AND attempts < max_attempts
    ORDER BY created_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 50), 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE graphrag.sync_queue q
  SET sync_status = 'processing',
      attempts = q.attempts + 1
  FROM candidates c
  WHERE q.id = c.id
  RETURNING q.*;
END;
$$;

-- Complete function
CREATE OR REPLACE FUNCTION graphrag.complete_sync_job(
  p_job_id UUID,
  p_neo4j_synced BOOLEAN DEFAULT FALSE,
  p_qdrant_synced BOOLEAN DEFAULT FALSE,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = graphrag, public
AS $$
BEGIN
  UPDATE graphrag.sync_queue
  SET neo4j_synced = COALESCE(p_neo4j_synced, neo4j_synced),
      qdrant_synced = COALESCE(p_qdrant_synced, qdrant_synced),
      sync_status = CASE
        WHEN p_error IS NOT NULL AND attempts >= max_attempts THEN 'dead'
        WHEN p_error IS NOT NULL THEN 'failed'
        WHEN COALESCE(p_neo4j_synced, FALSE) AND COALESCE(p_qdrant_synced, FALSE) THEN 'completed'
        ELSE 'pending'
      END,
      last_error = p_error,
      processed_at = NOW()
  WHERE id = p_job_id;
END;
$$;

-- Permissions
REVOKE ALL ON FUNCTION graphrag.enqueue_sync FROM PUBLIC;
REVOKE ALL ON FUNCTION graphrag.claim_sync_jobs FROM PUBLIC;
REVOKE ALL ON FUNCTION graphrag.complete_sync_job FROM PUBLIC;
GRANT EXECUTE ON FUNCTION graphrag.enqueue_sync TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION graphrag.claim_sync_jobs TO service_role;
GRANT EXECUTE ON FUNCTION graphrag.complete_sync_job TO service_role;

-- =========================================
-- Triggers to enqueue syncs on data changes
-- =========================================

-- Goals sync trigger
CREATE OR REPLACE FUNCTION graphrag.trigger_goal_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = graphrag, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, 'goal', OLD.id, 'public.goals', 'delete',
      jsonb_build_object('title', OLD.title, 'category', OLD.category)
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, 'goal', NEW.id, 'public.goals', 'upsert',
      to_jsonb(NEW)
    );
    RETURN NEW;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'graphrag goal sync trigger: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_graphrag_goal_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_goal_sync();

-- Financial accounts sync trigger
CREATE OR REPLACE FUNCTION graphrag.trigger_financial_account_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = graphrag, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, 'financial_account', OLD.id, 'finance.financial_accounts', 'delete',
      jsonb_build_object('account_name', OLD.account_name, 'account_type', OLD.account_type)
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, 'financial_account', NEW.id, 'finance.financial_accounts', 'upsert',
      to_jsonb(NEW) - 'account_number_encrypted' - 'routing_number_encrypted'
    );
    RETURN NEW;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'graphrag financial_account sync trigger: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_graphrag_financial_account_sync
  AFTER INSERT OR UPDATE OR DELETE ON finance.financial_accounts
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_financial_account_sync();

-- Risk assessment sync trigger
CREATE OR REPLACE FUNCTION graphrag.trigger_risk_assessment_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = graphrag, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, 'risk_assessment', OLD.id, 'public.risk_assessments', 'delete', '{}'
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, 'risk_assessment', NEW.id, 'public.risk_assessments', 'upsert',
      to_jsonb(NEW)
    );
    RETURN NEW;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'graphrag risk_assessment sync trigger: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_graphrag_risk_assessment_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.risk_assessments
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_risk_assessment_sync();

-- Career profile sync trigger
CREATE OR REPLACE FUNCTION graphrag.trigger_career_profile_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = graphrag, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, 'career_profile', OLD.id, 'public.career_profiles', 'delete', '{}'
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, 'career_profile', NEW.id, 'public.career_profiles', 'upsert',
      to_jsonb(NEW)
    );
    RETURN NEW;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'graphrag career_profile sync trigger: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_graphrag_career_profile_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.career_profiles
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_career_profile_sync();
