-- 120_health_graphrag_triggers.sql — GraphRAG enqueue triggers for the health schema.
--
-- enum-before-trigger: added ONLY after the worker enum variants (health_profile,
-- sleep_log, vital, …, health_recommendation) shipped + tests passed + worker deployed.
-- One generic trigger function (entity_type passed via TG_ARGV) + one trigger per table.
-- to_jsonb(NEW) carries the full row so the worker fan-out (health_recommendation ->
-- Evidence/Assumption/Tradeoff/AdviceBoundary) has its JSON columns.

CREATE OR REPLACE FUNCTION health.enqueue_health_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, health, graphrag, pg_catalog, pg_temp
AS $$
DECLARE
  v_op TEXT;
  v_etype TEXT := TG_ARGV[0];
BEGIN
  v_op := CASE TG_OP WHEN 'DELETE' THEN 'delete' ELSE 'upsert' END;
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, v_etype, OLD.id, 'health.' || TG_TABLE_NAME, v_op, to_jsonb(OLD));
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, v_etype, NEW.id, 'health.' || TG_TABLE_NAME, v_op, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('health_profiles', 'health_profile'),
    ('health_goals', 'health_goal'),
    ('wellness_habits', 'wellness_habit'),
    ('activity_logs', 'activity_log'),
    ('sleep_logs', 'sleep_log'),
    ('nutrition_logs', 'nutrition_log'),
    ('supplement_logs', 'supplement_log'),
    ('vitals', 'vital'),
    ('lab_markers', 'lab_marker'),
    ('body_metrics', 'body_metric'),
    ('workout_logs', 'workout_log'),
    ('health_insurance_plans', 'health_insurance_plan'),
    ('health_spending_accounts', 'health_spending_account'),
    ('medical_expenses', 'medical_expense'),
    ('benefit_deadlines', 'benefit_deadline'),
    ('health_recommendations', 'health_recommendation')
  ) AS t(tbl, etype) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_graphrag_%1$s ON health.%1$I', r.tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_graphrag_%1$s AFTER INSERT OR UPDATE OR DELETE ON health.%1$I '
      'FOR EACH ROW EXECUTE FUNCTION health.enqueue_health_sync(%2$L)', r.tbl, r.etype);
  END LOOP;
END $$;
