-- 108_user_persona_profile.sql
--
-- Beta "sample financial profile" metadata. Persisted so the dashboard and
-- recommendation engine can distinguish personas using career/family/goals/
-- risk/income/financial-behavior context (independent of the Plaid-derived
-- numbers), and promoted into the knowledge graph alongside the financial data.

CREATE TABLE IF NOT EXISTS public.user_persona_profile (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL UNIQUE,
  persona_id           text NOT NULL,
  display_name         text,
  life_stage           text,
  profession           text,
  family               text,
  income_type          text,
  spending_pattern     text,
  asset_profile        text,
  liability_profile    text,
  investment_profile   text,
  risk_profile         text,
  financial_complexity text,
  config_source        text,
  primary_goals        jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected_insights    jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_persona_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS upp_select_own ON public.user_persona_profile;
CREATE POLICY upp_select_own ON public.user_persona_profile
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS upp_service_all ON public.user_persona_profile;
CREATE POLICY upp_service_all ON public.user_persona_profile
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.user_persona_profile TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_persona_profile TO service_role;

-- Promote persona metadata into the graph (graphrag.sync_queue → worker →
-- Neo4j + Qdrant) so GraphRAG retrieval is persona-aware, mirroring the
-- financial_accounts sync trigger.
CREATE OR REPLACE FUNCTION public.trigger_persona_profile_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = graphrag, public
AS $$
BEGIN
  PERFORM graphrag.enqueue_sync(
    NEW.user_id, 'persona_profile', NEW.id, 'public.user_persona_profile', 'upsert',
    to_jsonb(NEW)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'persona_profile sync trigger: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_graphrag_persona_profile_sync ON public.user_persona_profile;
CREATE TRIGGER trigger_graphrag_persona_profile_sync
  AFTER INSERT OR UPDATE ON public.user_persona_profile
  FOR EACH ROW EXECUTE FUNCTION public.trigger_persona_profile_sync();
