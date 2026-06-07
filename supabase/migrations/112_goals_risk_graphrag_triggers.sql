-- 112_goals_risk_graphrag_triggers.sql
--
-- Goals + Risk Assessment graph promotion.
--
-- Background
-- ----------
-- public.goals and public.risk_assessments tables exist (migration 030
-- applied) but no trigger enqueues them onto graphrag.sync_queue. The
-- broken-chain migrations that would have done this (074, 076) were
-- skipped per the June 2 cherry-pick.
--
-- Consequence today:
--   * The Cypher generator's system prompt enumerates `:Goal` and
--     `:RiskAssessment` node labels.
--   * Zero such nodes exist in Neo4j personal.
--   * Every Cypher query against goals or risk returns empty.
--   * Advisor responses about goals or risk fall back to refusal even
--     when the user has goals on file (in Supabase).
--
-- This migration installs the smallest possible triggers that route
-- goals + risk_assessments through the existing graphrag.enqueue_sync
-- pipeline. Same shape as the trigger functions in migrations 050/055,
-- so the worker doesn't need to learn anything new — it already knows
-- how to handle entity_type='goal' and entity_type='risk_assessment'.
--
-- Idempotent (CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS).

-- ---------------------------------------------------------------------------
-- 1. goals → sync_queue
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_goal_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_op TEXT;
BEGIN
  v_op := CASE TG_OP WHEN 'DELETE' THEN 'delete' ELSE 'upsert' END;

  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id,
      'goal',
      OLD.id,
      'public.goals',
      v_op,
      to_jsonb(OLD)
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id,
      'goal',
      NEW.id,
      'public.goals',
      v_op,
      to_jsonb(NEW)
    );
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trigger_graphrag_goal_sync ON public.goals;
CREATE TRIGGER trigger_graphrag_goal_sync
AFTER INSERT OR UPDATE OR DELETE ON public.goals
FOR EACH ROW EXECUTE FUNCTION public.enqueue_goal_sync();

-- ---------------------------------------------------------------------------
-- 2. risk_assessments → sync_queue
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_risk_assessment_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_op TEXT;
BEGIN
  v_op := CASE TG_OP WHEN 'DELETE' THEN 'delete' ELSE 'upsert' END;

  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id,
      'risk_assessment',
      OLD.id,
      'public.risk_assessments',
      v_op,
      to_jsonb(OLD)
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id,
      'risk_assessment',
      NEW.id,
      'public.risk_assessments',
      v_op,
      to_jsonb(NEW)
    );
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trigger_graphrag_risk_assessment_sync ON public.risk_assessments;
CREATE TRIGGER trigger_graphrag_risk_assessment_sync
AFTER INSERT OR UPDATE OR DELETE ON public.risk_assessments
FOR EACH ROW EXECUTE FUNCTION public.enqueue_risk_assessment_sync();

-- ---------------------------------------------------------------------------
-- 3. Backfill existing rows so they hit the graph on the next worker tick.
--    Avoids the need for users to re-save their goals/risk profile.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT user_id, id FROM public.goals LOOP
    PERFORM graphrag.enqueue_sync(
      r.user_id, 'goal', r.id, 'public.goals', 'upsert',
      to_jsonb((SELECT g FROM public.goals g WHERE g.id = r.id))
    );
  END LOOP;
  FOR r IN SELECT user_id, id FROM public.risk_assessments LOOP
    PERFORM graphrag.enqueue_sync(
      r.user_id, 'risk_assessment', r.id, 'public.risk_assessments', 'upsert',
      to_jsonb((SELECT ra FROM public.risk_assessments ra WHERE ra.id = r.id))
    );
  END LOOP;
END $$;
