-- 160_advisor_turns.sql — Advisor turn telemetry (P0.1 Observability)
--
-- One row per hybrid-advisor turn so every advisor response is diagnosable: why it said what it said,
-- why the validator rejected/repaired, why a fallback occurred, what graph context it saw, latency by
-- stage, and token cost. Written best-effort (non-blocking) from AdvisorOrchestrator._persist.
--
-- Privacy: this is an INTERNAL diagnostics table. It holds the user's message + the advisor's response +
-- the raw LLM output for debugging, so it is service-role ONLY — no authenticated/anon read or write.
-- Owner-scoped reads are NOT granted (unlike analytics.events); QA/compliance access goes through a
-- dedicated service-role ops view, never direct table access.

CREATE TABLE IF NOT EXISTS analytics.advisor_turns (
    turn_id                  uuid PRIMARY KEY,
    conversation_id          text,
    user_id                  uuid NOT NULL,
    created_at               timestamptz NOT NULL DEFAULT now(),
    -- timestamp the service stamped (matches the log line); created_at is the DB write time
    "timestamp"              timestamptz,
    prompt_version           text,
    -- outcome
    llm_status               text,                 -- enhanced | fallback:<reason> | disabled
    validator_result         text,                 -- accepted | repaired | rejected | n/a
    validator_reason         text,
    validator_repairs        jsonb DEFAULT '[]'::jsonb,
    fallback_used            boolean DEFAULT false,
    fallback_reason          text,
    -- latency
    latency_ms               numeric,
    stages_ms                jsonb DEFAULT '{}'::jsonb,   -- {deterministic_turn, context_build, plan, llm_generate, validate, compose}
    -- cost
    prompt_tokens            integer DEFAULT 0,
    completion_tokens        integer DEFAULT 0,
    total_tokens             integer DEFAULT 0,
    -- retrieval / grounding
    graph_edges_available    integer DEFAULT 0,
    relationships_referenced jsonb DEFAULT '[]'::jsonb,
    confidence               numeric,
    -- content (diagnostics only — service-role read)
    user_message             text,
    advisor_response         text,
    llm_response_raw         text
);

CREATE INDEX IF NOT EXISTS advisor_turns_user_idx       ON analytics.advisor_turns (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS advisor_turns_conv_idx       ON analytics.advisor_turns (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS advisor_turns_status_idx     ON analytics.advisor_turns (llm_status);
CREATE INDEX IF NOT EXISTS advisor_turns_created_idx    ON analytics.advisor_turns (created_at DESC);

ALTER TABLE analytics.advisor_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.advisor_turns FORCE ROW LEVEL SECURITY;

-- Service-role only. No authenticated/anon policy ⇒ those roles are denied (no PII exposure to clients).
DROP POLICY IF EXISTS service_advisor_turns ON analytics.advisor_turns;
CREATE POLICY service_advisor_turns ON analytics.advisor_turns FOR ALL TO service_role
    USING (true) WITH CHECK (true);

GRANT ALL ON analytics.advisor_turns TO service_role;
-- intentionally NO grant to authenticated/anon

-- Aggregate metrics view (P0.1 dashboard): single-row rollup over the last 30 days. No PII (counts/rates
-- only). service_role read only; the admin /v1/admin/advisor-metrics endpoint selects this.
CREATE OR REPLACE VIEW analytics.advisor_turn_metrics
WITH (security_invoker = true) AS
SELECT
    count(DISTINCT conversation_id) FILTER (WHERE conversation_id IS NOT NULL) AS total_sessions,
    count(*)                                                                    AS total_turns,
    count(*) FILTER (WHERE fallback_used)                                       AS fallback_turns,
    round(avg(CASE WHEN fallback_used THEN 1.0 ELSE 0.0 END), 4)                AS fallback_rate,
    count(*) FILTER (WHERE validator_result = 'rejected')                       AS validator_rejections,
    round(avg(CASE WHEN validator_result = 'rejected' THEN 1.0 ELSE 0.0 END), 4) AS validation_failure_rate,
    count(*) FILTER (WHERE validator_result = 'repaired')                       AS validator_repairs,
    round(avg(latency_ms)::numeric, 1)                                          AS avg_latency_ms,
    round((percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms))::numeric, 1) AS p95_latency_ms,
    round(avg(confidence)::numeric, 3)                                          AS avg_confidence,
    round(avg(graph_edges_available)::numeric, 2)                              AS avg_graph_edges,
    round(avg(total_tokens)::numeric, 0)                                        AS avg_total_tokens
FROM analytics.advisor_turns
WHERE created_at >= now() - interval '30 days';

GRANT SELECT ON analytics.advisor_turn_metrics TO service_role;

NOTIFY pgrst, 'reload schema';
