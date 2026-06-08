-- 118_financial_recommendations_graphrag_trigger.sql
-- GraphRAG enqueue trigger for finance.financial_recommendations.
--
-- enum-before-trigger: added ONLY after the worker enum variant
-- `financial_recommendation` (+ the evidence-graph fan-out) is deployed. The worker
-- fans the row's evidence_json / assumptions_json / tradeoffs_json / governance_verdict
-- into the recommendation's evidence subgraph (:Evidence/:Assumption/:Tradeoff/
-- :AdviceBoundary child nodes). Those children are worker-created from JSON, NOT
-- Supabase system-of-record tables, so they have NO triggers of their own.
--
-- to_jsonb(NEW) carries the full row (including the JSON columns) so the worker
-- fan-out has the data it needs.

CREATE OR REPLACE FUNCTION public.enqueue_financial_recommendation_sync()
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
      'financial_recommendation',
      OLD.id,
      'finance.financial_recommendations',
      v_op,
      to_jsonb(OLD)
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id,
      'financial_recommendation',
      NEW.id,
      'finance.financial_recommendations',
      v_op,
      to_jsonb(NEW)
    );
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trigger_graphrag_financial_recommendation_sync
  ON finance.financial_recommendations;
CREATE TRIGGER trigger_graphrag_financial_recommendation_sync
AFTER INSERT OR UPDATE OR DELETE ON finance.financial_recommendations
FOR EACH ROW EXECUTE FUNCTION public.enqueue_financial_recommendation_sync();
