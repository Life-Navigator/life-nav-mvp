-- 135_decision_graphrag_triggers.sql — GraphRAG enqueue trigger for the decision schema.
-- enum-before-trigger: after the LifeDecision/DecisionScenario enum shipped + deployed.
-- to_jsonb(NEW) carries scenarios_json + evidence/tradeoffs so the worker fan-out builds the
-- decision graph (LifeDecision -> DecisionScenario/Evidence/Tradeoff/AdviceBoundary).
CREATE OR REPLACE FUNCTION decision.enqueue_decision_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, decision, graphrag, pg_catalog, pg_temp
AS $$
DECLARE v_op TEXT;
BEGIN
  v_op := CASE TG_OP WHEN 'DELETE' THEN 'delete' ELSE 'upsert' END;
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, 'life_decision', OLD.id, 'decision.' || TG_TABLE_NAME, v_op, to_jsonb(OLD));
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, 'life_decision', NEW.id, 'decision.' || TG_TABLE_NAME, v_op, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END; $$;
DROP TRIGGER IF EXISTS trg_graphrag_decisions ON decision.decisions;
CREATE TRIGGER trg_graphrag_decisions AFTER INSERT OR UPDATE OR DELETE ON decision.decisions
  FOR EACH ROW EXECUTE FUNCTION decision.enqueue_decision_sync();
