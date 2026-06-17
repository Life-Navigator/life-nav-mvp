-- 20260616120000_pilot_routing.sql — Selective routing usage ledger + pilot feedback (RLS).
--
-- Two tables for the 20-person private beta:
--   analytics.model_usage   — per (tenant,user,month) call/report/fallback counters for plan enforcement +
--                             economics. Service-role ONLY (written best-effort from the orchestrator;
--                             read for enforcement/analytics). No client access.
--   analytics.pilot_feedback — per-turn user feedback (thumbs/ratings/NPS). OWNER may insert + read their own;
--                             service-role reads all (admin analytics). Mirrors analytics.events RLS posture.

-- ── Usage ledger ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics.model_usage (
    tenant_id        uuid NOT NULL,
    user_id          uuid NOT NULL,
    period           text NOT NULL,                 -- 'YYYY-MM' (monthly bucket; no destructive reset)
    premium_calls    integer NOT NULL DEFAULT 0,
    standard_calls   integer NOT NULL DEFAULT 0,
    reports          integer NOT NULL DEFAULT 0,
    safety_fallbacks integer NOT NULL DEFAULT 0,
    model_fallbacks  integer NOT NULL DEFAULT 0,
    estimated_cost   numeric NOT NULL DEFAULT 0,
    updated_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id, period)
);
CREATE INDEX IF NOT EXISTS model_usage_user_idx ON analytics.model_usage (user_id, period);

ALTER TABLE analytics.model_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.model_usage FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_model_usage ON analytics.model_usage;
CREATE POLICY service_model_usage ON analytics.model_usage FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON analytics.model_usage TO service_role;  -- intentionally NO authenticated/anon grant

-- Atomic increment helper (avoids read-modify-write races). Service-role invokes via PostgREST RPC.
CREATE OR REPLACE FUNCTION analytics.bump_model_usage(
    p_tenant uuid, p_user uuid, p_period text,
    p_premium int DEFAULT 0, p_standard int DEFAULT 0, p_reports int DEFAULT 0,
    p_safety int DEFAULT 0, p_fallbacks int DEFAULT 0, p_cost numeric DEFAULT 0)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
    INSERT INTO analytics.model_usage AS m (tenant_id, user_id, period, premium_calls, standard_calls,
        reports, safety_fallbacks, model_fallbacks, estimated_cost, updated_at)
    VALUES (p_tenant, p_user, p_period, p_premium, p_standard, p_reports, p_safety, p_fallbacks, p_cost, now())
    ON CONFLICT (tenant_id, user_id, period) DO UPDATE SET
        premium_calls    = m.premium_calls    + EXCLUDED.premium_calls,
        standard_calls   = m.standard_calls   + EXCLUDED.standard_calls,
        reports          = m.reports          + EXCLUDED.reports,
        safety_fallbacks = m.safety_fallbacks + EXCLUDED.safety_fallbacks,
        model_fallbacks  = m.model_fallbacks  + EXCLUDED.model_fallbacks,
        estimated_cost   = m.estimated_cost   + EXCLUDED.estimated_cost,
        updated_at       = now();
$$;
REVOKE ALL ON FUNCTION analytics.bump_model_usage(uuid,uuid,text,int,int,int,int,int,numeric) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION analytics.bump_model_usage(uuid,uuid,text,int,int,int,int,int,numeric) TO service_role;

-- ── Pilot feedback ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics.pilot_feedback (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                uuid NOT NULL,
    tenant_id              uuid,
    turn_id                uuid,
    conversation_id        text,
    created_at             timestamptz NOT NULL DEFAULT now(),
    thumbs                 text CHECK (thumbs IN ('up','down')),
    trust_rating           integer CHECK (trust_rating BETWEEN 1 AND 5),
    usefulness_rating      integer CHECK (usefulness_rating BETWEEN 1 AND 5),
    recommendation_quality integer CHECK (recommendation_quality BETWEEN 1 AND 5),
    advisor_comparison     text,    -- e.g. 'better_than_chatgpt' | 'same' | 'worse' (free-form, validated app-side)
    nps                    integer CHECK (nps BETWEEN 0 AND 10),
    comment                text
);
CREATE INDEX IF NOT EXISTS pilot_feedback_user_idx    ON analytics.pilot_feedback (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pilot_feedback_created_idx ON analytics.pilot_feedback (created_at DESC);

ALTER TABLE analytics.pilot_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.pilot_feedback FORCE ROW LEVEL SECURITY;
-- Owner may insert + read their OWN feedback; service-role sees all (admin analytics).
DROP POLICY IF EXISTS own_pilot_feedback_ins ON analytics.pilot_feedback;
CREATE POLICY own_pilot_feedback_ins ON analytics.pilot_feedback FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS own_pilot_feedback_sel ON analytics.pilot_feedback;
CREATE POLICY own_pilot_feedback_sel ON analytics.pilot_feedback FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS service_pilot_feedback ON analytics.pilot_feedback;
CREATE POLICY service_pilot_feedback ON analytics.pilot_feedback FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT, INSERT ON analytics.pilot_feedback TO authenticated;
GRANT ALL ON analytics.pilot_feedback TO service_role;

-- Admin rollup (service-role read): counts/rates only, last 90 days. No PII beyond aggregates.
CREATE OR REPLACE VIEW analytics.pilot_feedback_summary AS
SELECT
    count(*)                                                            AS total_feedback,
    count(*) FILTER (WHERE thumbs = 'up')                               AS thumbs_up,
    count(*) FILTER (WHERE thumbs = 'down')                             AS thumbs_down,
    round(avg(trust_rating), 2)                                         AS avg_trust,
    round(avg(usefulness_rating), 2)                                    AS avg_usefulness,
    round(avg(recommendation_quality), 2)                              AS avg_recommendation_quality,
    round(avg(nps), 1)                                                  AS avg_nps,
    count(*) FILTER (WHERE nps >= 9)                                    AS nps_promoters,
    count(*) FILTER (WHERE nps <= 6)                                    AS nps_detractors,
    count(*) FILTER (WHERE nps IS NOT NULL)                             AS nps_responses
FROM analytics.pilot_feedback
WHERE created_at > now() - interval '90 days';
GRANT SELECT ON analytics.pilot_feedback_summary TO service_role;
