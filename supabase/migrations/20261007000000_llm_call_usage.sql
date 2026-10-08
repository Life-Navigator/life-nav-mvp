-- 20261007000000_llm_call_usage.sql — per-CALL LLM token + cost ledger (Phase 0: token ledger)
--
-- WHY A NEW TABLE RATHER THAN AN EXISTING ONE
-- -------------------------------------------
-- Three usage surfaces already exist and none of them can answer "what does a turn cost?":
--
--   analytics.advisor_turns   One row per TURN with prompt/completion/total_tokens. But a single turn
--                             makes up to FOUR provider calls (initial, retry, model-fallback, repair
--                             — advisor_orchestrator.py), and each call overwrote the wrapper's
--                             `last_usage`. The turn therefore recorded only the LAST call, so a turn
--                             that retried and repaired billed three generations and logged one. It
--                             also has no cost column at all.
--   analytics.model_usage     Monthly per-user CALL COUNTERS for plan/quota enforcement. Counters, not
--                             tokens; deliberately coarse. Still the right table for quota.
--   ops.llm_usage_meter       Correct shape (tokens_in/out + cost_usd_micros) and already created by
--                             migration 116 — but `ops` is NOT in the PostgREST exposed-schema list
--                             (supabase/config.toml), so core-api literally cannot write to it. The TS
--                             tier reaches it another way; the Python tier that makes the actual model
--                             calls cannot. Exposing `ops` to PostgREST to fix that would widen the
--                             public API surface for a diagnostics table — the wrong trade.
--
-- So: one row per provider CALL, in `analytics` (already exposed, already the home of advisor_turns).
-- Per-call granularity is what makes the undercount structurally impossible — a retry cannot overwrite
-- another call's row the way it overwrote a shared variable.
--
-- Privacy: tokens, costs and model identifiers only. NO prompt text, NO response text, NO user
-- content of any kind — unlike advisor_turns, which holds message bodies for debugging. That keeps
-- this table cheap to retain and safe to aggregate. Service-role only regardless.

CREATE TABLE IF NOT EXISTS analytics.llm_call_usage (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at           timestamptz NOT NULL DEFAULT now(),
    -- correlation
    user_id              uuid,                        -- nullable: system/batch calls have no user
    turn_id              uuid,                        -- joins analytics.advisor_turns; NULL off the advisor path
    conversation_id      text,
    -- what ran
    -- The INTERNAL provider name (google_aistudio / google_vertex / vertex_anthropic / …), NOT the
    -- coarse 5-value `ops.is_llm_provider` slug. This table has no such CHECK, and the slug would
    -- erase which auth path served the call — the one thing this indexed column can answer that
    -- `model` cannot. The slug is kept in metadata->>'provider_slug' for coarse rollups.
    provider             text NOT NULL,
    model                text NOT NULL,               -- resolved model id actually called
    operation_kind       text NOT NULL,               -- advisor.generate | advisor.repair | relationship.interpret | ...
    call_index           integer NOT NULL DEFAULT 0,  -- 0-based position within the turn (retry=1, repair=2, ...)
    call_reason          text,                        -- initial | retry | model_fallback | repair
    -- tokens
    tokens_in            integer NOT NULL DEFAULT 0,
    -- Includes reasoning/"thinking" tokens: providers bill those at the OUTPUT rate, and Gemini
    -- reports them in `thoughtsTokenCount`, OUTSIDE `candidatesTokenCount`. Reading candidates alone
    -- understated the expensive side of the bill by a large multiple on 2.5-pro (the default model).
    tokens_out           integer NOT NULL DEFAULT 0,
    tokens_thoughts      integer NOT NULL DEFAULT 0,  -- reasoning subset of tokens_out (visibility only)
    tokens_cached_in     integer NOT NULL DEFAULT 0,  -- cache-HIT subset of tokens_in; proves caching engaged
    -- cache-WRITE subset of tokens_in. Priming a cache costs MORE than not caching (Anthropic ~1.25x
    -- input), so without this the first turn of every conversation looks cheaper than it was.
    tokens_cache_write_in integer NOT NULL DEFAULT 0,
    -- money (integer millionths of a USD — float dollars accumulate error across millions of rows)
    cost_usd_micros      bigint  NOT NULL DEFAULT 0,
    -- FALSE when the model had no entry in the price table, so cost_usd_micros is 0 because it is
    -- UNKNOWN, not because the call was free. Aggregations must filter on this or they silently
    -- understate the bill — the exact failure a cost ledger exists to prevent.
    cost_known           boolean NOT NULL DEFAULT false,
    latency_ms           integer,
    metadata             jsonb   NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS llm_call_usage_created_idx ON analytics.llm_call_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS llm_call_usage_user_idx    ON analytics.llm_call_usage (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS llm_call_usage_turn_idx    ON analytics.llm_call_usage (turn_id);
CREATE INDEX IF NOT EXISTS llm_call_usage_model_idx   ON analytics.llm_call_usage (model, created_at DESC);
CREATE INDEX IF NOT EXISTS llm_call_usage_op_idx      ON analytics.llm_call_usage (operation_kind, created_at DESC);

ALTER TABLE analytics.llm_call_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.llm_call_usage FORCE ROW LEVEL SECURITY;

-- Service-role only. No authenticated/anon policy ⇒ those roles are denied. Matches advisor_turns:
-- spend data is operator information, and a per-user cost figure is not something a client may read.
DROP POLICY IF EXISTS service_llm_call_usage ON analytics.llm_call_usage;
CREATE POLICY service_llm_call_usage ON analytics.llm_call_usage FOR ALL TO service_role
    USING (true) WITH CHECK (true);

GRANT ALL ON analytics.llm_call_usage TO service_role;
-- intentionally NO grant to authenticated/anon


-- ───────────────────────────────────────────────────────────────────────────────────────────────────
-- Rollup: the question Phase 0 exists to answer, as SQL rather than as a spreadsheet.
--
-- `cost_known_calls` vs `calls` is the honesty column: when they diverge, `cost_usd` is a FLOOR, not
-- the bill. `cache_hit_rate_pct` is the Phase 1 (prompt-caching) scoreboard — it reads 0 until a
-- stable system-prompt prefix exists, and that is exactly the before/after measurement.
-- ───────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW analytics.llm_cost_daily AS
SELECT
    date_trunc('day', created_at)::date            AS day,
    model,
    operation_kind,
    COUNT(*)                                       AS calls,
    COUNT(*) FILTER (WHERE cost_known)             AS cost_known_calls,
    SUM(tokens_in)                                 AS tokens_in,
    SUM(tokens_out)                                AS tokens_out,
    SUM(tokens_thoughts)                           AS tokens_thoughts,
    SUM(tokens_cached_in)                          AS tokens_cached_in,
    SUM(tokens_cache_write_in)                     AS tokens_cache_write_in,
    ROUND(SUM(cost_usd_micros) / 1000000.0, 6)     AS cost_usd,
    CASE WHEN SUM(tokens_in) > 0
         THEN ROUND(100.0 * SUM(tokens_cached_in) / SUM(tokens_in), 2)
         ELSE 0 END                                AS cache_hit_rate_pct,
    -- What fraction of billed output was reasoning rather than answer. On a thinking model this is
    -- often the larger half of the output bill, and it is invisible in `candidatesTokenCount`.
    CASE WHEN SUM(tokens_out) > 0
         THEN ROUND(100.0 * SUM(tokens_thoughts) / SUM(tokens_out), 2)
         ELSE 0 END                                AS thinking_share_pct,
    ROUND(AVG(latency_ms)::numeric, 0)             AS avg_latency_ms,
    -- Output tokens per second of wall clock. The throughput question, answerable from the two
    -- columns already here rather than from a vendor claim.
    --
    -- Note this counts BILLED output, which includes reasoning tokens. On a thinking model those
    -- are generated and charged but never shown, so billed throughput can look healthy while the
    -- user waits on a response that has not started arriving. Read it next to
    -- thinking_share_pct — a high share means most of the wait is reasoning, not answer.
    CASE WHEN SUM(latency_ms) > 0
         THEN ROUND(1000.0 * SUM(tokens_out) / SUM(latency_ms), 1)
         ELSE NULL END                             AS output_tokens_per_sec
FROM analytics.llm_call_usage
GROUP BY 1, 2, 3;

ALTER VIEW analytics.llm_cost_daily SET (security_invoker = true);
GRANT SELECT ON analytics.llm_cost_daily TO service_role;

-- Per-turn cost, which is the headline number. Rolling the CALLS up to a turn here (rather than
-- storing a turn total) is what keeps retries and repairs counted: `provider_calls` makes an
-- expensive turn's cause visible instead of averaging it away.
CREATE OR REPLACE VIEW analytics.llm_cost_per_turn AS
SELECT
    turn_id,
    MIN(created_at)                                AS started_at,
    MAX(user_id::text)::uuid                       AS user_id,
    COUNT(*)                                       AS provider_calls,
    BOOL_AND(cost_known)                           AS cost_fully_known,
    SUM(tokens_in)                                 AS tokens_in,
    SUM(tokens_out)                                AS tokens_out,
    SUM(tokens_cached_in)                          AS tokens_cached_in,
    ROUND(SUM(cost_usd_micros) / 1000000.0, 6)     AS cost_usd
FROM analytics.llm_call_usage
WHERE turn_id IS NOT NULL
GROUP BY turn_id;

ALTER VIEW analytics.llm_cost_per_turn SET (security_invoker = true);
GRANT SELECT ON analytics.llm_cost_per_turn TO service_role;
