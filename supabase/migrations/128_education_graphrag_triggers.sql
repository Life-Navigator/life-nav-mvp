-- 128_education_graphrag_triggers.sql — GraphRAG enqueue triggers for the education schema.
--
-- enum-before-trigger: added ONLY after the Education worker enum variants
-- (education_profile, education_goal, …, education_recommendation) shipped + tests passed +
-- worker deployed. Mirrors Finance/Health/Career (migration 120/124): one generic trigger fn
-- (entity_type via TG_ARGV) + one trigger per table. to_jsonb(NEW) carries the full row so
-- the worker fan-out (education_recommendation -> Evidence/Assumption/Tradeoff/AdviceBoundary)
-- has its JSON columns.

CREATE OR REPLACE FUNCTION education.enqueue_education_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, education, graphrag, pg_catalog, pg_temp
AS $$
DECLARE
  v_op TEXT;
  v_etype TEXT := TG_ARGV[0];
BEGIN
  v_op := CASE TG_OP WHEN 'DELETE' THEN 'delete' ELSE 'upsert' END;
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, v_etype, OLD.id, 'education.' || TG_TABLE_NAME, v_op, to_jsonb(OLD));
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, v_etype, NEW.id, 'education.' || TG_TABLE_NAME, v_op, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('education_profiles', 'education_profile'),
    ('education_goals', 'education_goal'),
    ('learning_paths', 'learning_path'),
    ('schools', 'school'),
    ('programs', 'program'),
    ('certifications', 'certification'),
    ('program_comparisons', 'program_comparison'),
    ('education_recommendations', 'education_recommendation')
  ) AS t(tbl, etype) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_graphrag_%1$s ON education.%1$I', r.tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_graphrag_%1$s AFTER INSERT OR UPDATE OR DELETE ON education.%1$I '
      'FOR EACH ROW EXECUTE FUNCTION education.enqueue_education_sync(%2$L)', r.tbl, r.etype);
  END LOOP;
END $$;
