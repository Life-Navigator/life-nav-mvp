-- 140_finance_snapshot_triggers.sql — GraphRAG sync for finance snapshots (Sprint 7).
-- enum-before-trigger: NetWorthSnapshot/CashFlowSnapshot enum variants shipped with the finance
-- elite worker (migration 117) and are deployed. Snapshots -> :NetWorthSnapshot/:CashFlowSnapshot
-- nodes with the user-anchored HAS_SNAPSHOT edge, enabling time-series graph reasoning.
CREATE OR REPLACE FUNCTION finance.enqueue_snapshot_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, finance, graphrag, pg_catalog, pg_temp
AS $$
DECLARE v_op TEXT; v_etype TEXT := TG_ARGV[0];
BEGIN
  v_op := CASE TG_OP WHEN 'DELETE' THEN 'delete' ELSE 'upsert' END;
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, v_etype, OLD.id, 'finance.' || TG_TABLE_NAME, v_op, to_jsonb(OLD));
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, v_etype, NEW.id, 'finance.' || TG_TABLE_NAME, v_op, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END; $$;
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('net_worth_snapshots', 'net_worth_snapshot'),
    ('cash_flow_snapshots', 'cash_flow_snapshot')
  ) AS t(tbl, etype) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_graphrag_%1$s ON finance.%1$I', r.tbl);
    EXECUTE format('CREATE TRIGGER trg_graphrag_%1$s AFTER INSERT OR UPDATE OR DELETE ON finance.%1$I FOR EACH ROW EXECUTE FUNCTION finance.enqueue_snapshot_sync(%2$L)', r.tbl, r.etype);
  END LOOP;
END $$;
