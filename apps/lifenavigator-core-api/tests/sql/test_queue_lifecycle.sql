-- Elite DB-backed test of the WS-C sync_queue reclaim/retry logic (migration 20260723000000 + 050).
-- Self-asserting: RAISE EXCEPTION on any failure; prints ALL PASS at the end. Run against a throwaway pg.
CREATE SCHEMA IF NOT EXISTS graphrag;
DROP TABLE IF EXISTS graphrag.sync_queue;
CREATE TABLE graphrag.sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT gen_random_uuid(),
  sync_status text NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending','processing','completed','failed','dead')),
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  neo4j_synced bool NOT NULL DEFAULT false,
  qdrant_synced bool NOT NULL DEFAULT false,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  claimed_at timestamptz
);

-- WS-C claim: pending OR failed OR stale-processing, bounded by attempts < max
CREATE OR REPLACE FUNCTION graphrag.claim_sync_jobs(p_limit INT DEFAULT 50)
RETURNS SETOF graphrag.sync_queue LANGUAGE plpgsql AS $f$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id FROM graphrag.sync_queue
    WHERE attempts < max_attempts
      AND (sync_status='pending' OR sync_status='failed'
           OR (sync_status='processing' AND (claimed_at IS NULL OR claimed_at < NOW() - INTERVAL '10 minutes')))
    ORDER BY created_at ASC LIMIT GREATEST(COALESCE(p_limit,50),1) FOR UPDATE SKIP LOCKED
  )
  UPDATE graphrag.sync_queue q SET sync_status='processing', attempts=q.attempts+1, claimed_at=NOW()
  FROM candidates c WHERE q.id=c.id RETURNING q.*;
END;$f$;

CREATE OR REPLACE FUNCTION graphrag.complete_sync_job(p_job_id UUID, p_neo4j BOOLEAN DEFAULT FALSE, p_qdrant BOOLEAN DEFAULT FALSE, p_error TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $f$
BEGIN
  UPDATE graphrag.sync_queue SET neo4j_synced=COALESCE(p_neo4j,neo4j_synced), qdrant_synced=COALESCE(p_qdrant,qdrant_synced),
    sync_status=CASE WHEN p_error IS NOT NULL AND attempts>=max_attempts THEN 'dead'
                     WHEN p_error IS NOT NULL THEN 'failed'
                     WHEN COALESCE(p_neo4j,FALSE) AND COALESCE(p_qdrant,FALSE) THEN 'completed' ELSE 'pending' END,
    last_error=p_error, processed_at=NOW() WHERE id=p_job_id;
END;$f$;

DO $t$
DECLARE s text; a int;
BEGIN
  -- 1) FAILED with attempts left IS reclaimed (the dead-code-retry bug fix)
  DELETE FROM graphrag.sync_queue;
  INSERT INTO graphrag.sync_queue(sync_status, attempts) VALUES ('failed', 1);
  PERFORM graphrag.claim_sync_jobs(10);
  SELECT sync_status, attempts INTO s, a FROM graphrag.sync_queue;
  IF s<>'processing' OR a<>2 THEN RAISE EXCEPTION '1 failed-retry: got %/%', s, a; END IF;

  -- 2) STALE processing IS reclaimed (the black-hole fix)
  DELETE FROM graphrag.sync_queue;
  INSERT INTO graphrag.sync_queue(sync_status, attempts, claimed_at) VALUES ('processing', 1, now() - interval '20 minutes');
  PERFORM graphrag.claim_sync_jobs(10);
  SELECT attempts INTO a FROM graphrag.sync_queue;
  IF a<>2 THEN RAISE EXCEPTION '2 stale-reclaim: attempts %', a; END IF;

  -- 3) FRESH processing is NOT reclaimed
  DELETE FROM graphrag.sync_queue;
  INSERT INTO graphrag.sync_queue(sync_status, attempts, claimed_at) VALUES ('processing', 1, now());
  PERFORM graphrag.claim_sync_jobs(10);
  SELECT attempts INTO a FROM graphrag.sync_queue;
  IF a<>1 THEN RAISE EXCEPTION '3 fresh-processing wrongly reclaimed: attempts %', a; END IF;

  -- 4) attempts>=max is NOT reclaimed (terminates, no infinite retry)
  DELETE FROM graphrag.sync_queue;
  INSERT INTO graphrag.sync_queue(sync_status, attempts, max_attempts) VALUES ('failed', 5, 5);
  PERFORM graphrag.claim_sync_jobs(10);
  SELECT sync_status INTO s FROM graphrag.sync_queue;
  IF s<>'failed' THEN RAISE EXCEPTION '4 exhausted job wrongly reclaimed: %', s; END IF;

  -- 5) complete: transient error while attempts left -> failed (retryable), not dead
  DELETE FROM graphrag.sync_queue;
  INSERT INTO graphrag.sync_queue(sync_status, attempts, max_attempts) VALUES ('processing', 2, 5) RETURNING id INTO s;
  PERFORM graphrag.complete_sync_job(s::uuid, false, false, 'partial: qdrant=false');
  SELECT sync_status INTO s FROM graphrag.sync_queue;
  IF s<>'failed' THEN RAISE EXCEPTION '5 transient error should be failed: %', s; END IF;

  RAISE NOTICE 'ALL QUEUE LIFECYCLE CHECKS PASSED';
END;$t$;
