-- WS-C — GraphRAG ingest-pipeline integrity (silent data loss + coverage holes).
--
-- Fixes three ways the pipeline silently dropped data, plus two headline-feature tables that never reached
-- the graph. All idempotent (safe to re-run). Additive: no data migration, no drops of existing objects.
--
-- 1) processing black hole: claim_sync_jobs only ever claimed 'pending', so a job flipped to 'processing'
--    by a worker that then died (OOM, redeploy, SIGKILL, network drop) was stranded FOREVER — nothing
--    reclaimed it. Add a claimed_at stamp and reclaim stale 'processing' rows.
-- 2) failed never retried: complete_sync_job set 'failed' on a transient error while attempts < max, but
--    claim only picked 'pending' — so the attempts<max retry budget was dead code and every transient
--    Neo4j/Qdrant blip lost the job. Also reclaim 'failed' (and 'processing') while attempts remain.
-- 3) partial-failure dead-end: the worker reports a one-sided sync as error="partial: ...", landing the job
--    in 'failed'. With (2) it now retries and idempotently re-upserts the side that didn't take.
-- 4/5) coverage holes: finance.financial_planning_goals and life.candidate_goals (the goal-persistence
--    feature) had NO graphrag trigger — tracked goals never reached Neo4j/Qdrant.

BEGIN;

-- (1) claimed_at: when the row was last handed to a worker. Lets us detect a stuck 'processing' job.
ALTER TABLE graphrag.sync_queue ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- (1)+(2)+(3) claim pending, RECLAIM stale 'processing' (worker crash), and RETRY 'failed'/partial —
-- all bounded by attempts < max_attempts so a permanently-broken job still terminates at 'dead' via
-- complete_sync_job. A 10-minute stale window is far longer than any real job (seconds).
CREATE OR REPLACE FUNCTION graphrag.claim_sync_jobs(p_limit INT DEFAULT 50)
RETURNS SETOF graphrag.sync_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = graphrag, public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id FROM graphrag.sync_queue
    WHERE attempts < max_attempts
      AND (
        sync_status = 'pending'
        OR sync_status = 'failed'
        OR (sync_status = 'processing' AND (claimed_at IS NULL OR claimed_at < NOW() - INTERVAL '10 minutes'))
      )
    ORDER BY created_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 50), 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE graphrag.sync_queue q
  SET sync_status = 'processing',
      attempts = q.attempts + 1,
      claimed_at = NOW()
  FROM candidates c
  WHERE q.id = c.id
  RETURNING q.*;
END;
$$;
REVOKE ALL ON FUNCTION graphrag.claim_sync_jobs FROM PUBLIC;

-- (4/5) Generic row->graph enqueue trigger. TG_ARGV[0] is the entity_type; source_table is derived from the
-- firing table so the worker/ontology can route it. Mirrors the per-domain triggers in 055/132/135/140.
CREATE OR REPLACE FUNCTION graphrag.enqueue_row_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = graphrag, public
AS $$
DECLARE
  v_op TEXT := CASE TG_OP WHEN 'DELETE' THEN 'delete' ELSE 'upsert' END;
  v_etype TEXT := TG_ARGV[0];
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, v_etype, OLD.id,
                                  TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, v_op, to_jsonb(OLD));
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, v_etype, NEW.id,
                                  TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, v_op, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_graphrag_financial_planning_goals ON finance.financial_planning_goals;
CREATE TRIGGER trg_graphrag_financial_planning_goals
  AFTER INSERT OR UPDATE OR DELETE ON finance.financial_planning_goals
  FOR EACH ROW EXECUTE FUNCTION graphrag.enqueue_row_sync('financial_planning_goal');

DROP TRIGGER IF EXISTS trg_graphrag_candidate_goals ON life.candidate_goals;
CREATE TRIGGER trg_graphrag_candidate_goals
  AFTER INSERT OR UPDATE OR DELETE ON life.candidate_goals
  FOR EACH ROW EXECUTE FUNCTION graphrag.enqueue_row_sync('candidate_goal');

COMMIT;
