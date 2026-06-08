-- 124_career_graphrag_triggers.sql — GraphRAG enqueue triggers for the career schema.
--
-- enum-before-trigger: added ONLY after the Career worker enum variants (career_profile,
-- career_goal, user_skill, job_target, compensation_record, career_recommendation, …)
-- shipped + tests passed + worker deployed (v14). Mirrors the proven Finance/Health
-- pattern (migration 120): one generic trigger fn (entity_type via TG_ARGV) + one
-- trigger per table. to_jsonb(NEW) carries the full row so the worker fan-out
-- (career_recommendation -> Evidence/Assumption/Tradeoff/AdviceBoundary) has its JSON cols.
--
-- X3 scope: SMALLEST safe validation set — 6 of the 17 career tables. The rest get
-- triggers in a later sprint once the architecture is proven end-to-end.

CREATE OR REPLACE FUNCTION career.enqueue_career_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, career, graphrag, pg_catalog, pg_temp
AS $$
DECLARE
  v_op TEXT;
  v_etype TEXT := TG_ARGV[0];
BEGIN
  v_op := CASE TG_OP WHEN 'DELETE' THEN 'delete' ELSE 'upsert' END;
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, v_etype, OLD.id, 'career.' || TG_TABLE_NAME, v_op, to_jsonb(OLD));
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, v_etype, NEW.id, 'career.' || TG_TABLE_NAME, v_op, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('career_profiles', 'career_profile'),
    ('career_goals', 'career_goal'),
    ('user_skills', 'user_skill'),
    ('job_targets', 'job_target'),
    ('compensation_records', 'compensation_record'),
    ('career_recommendations', 'career_recommendation')
  ) AS t(tbl, etype) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_graphrag_%1$s ON career.%1$I', r.tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_graphrag_%1$s AFTER INSERT OR UPDATE OR DELETE ON career.%1$I '
      'FOR EACH ROW EXECUTE FUNCTION career.enqueue_career_sync(%2$L)', r.tbl, r.etype);
  END LOOP;
END $$;
