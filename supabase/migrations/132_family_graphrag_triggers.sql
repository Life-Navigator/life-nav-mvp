-- 132_family_graphrag_triggers.sql — GraphRAG enqueue triggers for the family schema.
-- enum-before-trigger: added after the Family worker enum shipped + tests passed + deployed.
-- Mirrors Finance/Health/Career/Education. to_jsonb(NEW) carries the row so the worker fan-out
-- (family_recommendation -> Evidence/Assumption/Tradeoff/AdviceBoundary) has its JSON columns.

CREATE OR REPLACE FUNCTION family.enqueue_family_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, family, graphrag, pg_catalog, pg_temp
AS $$
DECLARE v_op TEXT; v_etype TEXT := TG_ARGV[0];
BEGIN
  v_op := CASE TG_OP WHEN 'DELETE' THEN 'delete' ELSE 'upsert' END;
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(OLD.user_id, v_etype, OLD.id, 'family.' || TG_TABLE_NAME, v_op, to_jsonb(OLD));
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(NEW.user_id, v_etype, NEW.id, 'family.' || TG_TABLE_NAME, v_op, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END; $$;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('family_profiles', 'family_profile'),
    ('dependents', 'dependent'),
    ('spouse_profiles', 'spouse_profile'),
    ('guardianship_plans', 'guardianship_plan'),
    ('estate_plans', 'estate_plan'),
    ('insurance_profiles', 'insurance_profile'),
    ('college_planning', 'college_planning'),
    ('family_recommendations', 'family_recommendation')
  ) AS t(tbl, etype) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_graphrag_%1$s ON family.%1$I', r.tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_graphrag_%1$s AFTER INSERT OR UPDATE OR DELETE ON family.%1$I '
      'FOR EACH ROW EXECUTE FUNCTION family.enqueue_family_sync(%2$L)', r.tbl, r.etype);
  END LOOP;
END $$;
