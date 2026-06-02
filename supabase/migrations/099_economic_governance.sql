-- ============================================================================
-- 099: Economic Governance (Sprint O.0.2)
--
-- Adds the `economic` schema and its six core tables:
--
--   user_budgets       — per-user daily/weekly/monthly caps + current spend
--   platform_budget    — single-row monthly cap with threshold tracking
--   usage_events       — append-only per-call cost ledger
--   rate_limit_buckets — per (scope, owner) token-bucket state
--   circuit_breakers   — per-feature breaker state machine
--   abuse_events       — abuse-detector findings
--
-- All cost figures are stored in micro-USD (1 USD = 1,000,000 micros)
-- so we never lose precision on small per-call costs. Money never
-- flows through floats.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS economic;

-- ---- Enum helpers --------------------------------------------------------

CREATE OR REPLACE FUNCTION economic.is_budget_status(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$ SELECT p IN ('ACTIVE','WARNING','THROTTLED','BLOCKED') $$;

CREATE OR REPLACE FUNCTION economic.is_platform_status(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$ SELECT p IN ('NORMAL','INFORMATIONAL','ALERT','HIGH_ALERT','EMERGENCY','HARD_STOP') $$;

CREATE OR REPLACE FUNCTION economic.is_cost_dimension(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT p IN (
    'text_input','text_output','embedding',
    'vision_image','speech_minute','video_minute',
    'storage_gb_month','tool_call','other'
  )
$$;

CREATE OR REPLACE FUNCTION economic.is_rate_scope(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT p IN ('chat','upload','simulation','arcana','enterprise_api','governance_review')
$$;

CREATE OR REPLACE FUNCTION economic.is_breaker_state(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$ SELECT p IN ('CLOSED','HALF_OPEN','OPEN') $$;

CREATE OR REPLACE FUNCTION economic.is_abuse_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT p IN (
    'prompt_flooding','upload_flooding','cost_farming',
    'automation','retry_abuse','token_burn','api_abuse'
  )
$$;

CREATE OR REPLACE FUNCTION economic.is_abuse_action(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$ SELECT p IN ('WARN','THROTTLE','BLOCK','REVIEW') $$;

-- ============================================================================
-- 1. economic.user_budgets
-- ============================================================================
CREATE TABLE IF NOT EXISTS economic.user_budgets (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id                UUID,
  -- caps (micro-USD) — internal-beta defaults: $1 / $5 / $20
  daily_budget_micros      BIGINT NOT NULL DEFAULT 1_000_000      CHECK (daily_budget_micros   >= 0),
  weekly_budget_micros     BIGINT NOT NULL DEFAULT 5_000_000      CHECK (weekly_budget_micros  >= 0),
  monthly_budget_micros    BIGINT NOT NULL DEFAULT 20_000_000     CHECK (monthly_budget_micros >= 0),
  -- spend windows
  current_daily_micros     BIGINT NOT NULL DEFAULT 0              CHECK (current_daily_micros   >= 0),
  current_weekly_micros    BIGINT NOT NULL DEFAULT 0              CHECK (current_weekly_micros  >= 0),
  current_monthly_micros   BIGINT NOT NULL DEFAULT 0              CHECK (current_monthly_micros >= 0),
  -- window anchors (UTC)
  daily_window_start       DATE NOT NULL DEFAULT CURRENT_DATE,
  weekly_window_start      DATE NOT NULL DEFAULT date_trunc('week',  NOW())::DATE,
  monthly_window_start     DATE NOT NULL DEFAULT date_trunc('month', NOW())::DATE,
  -- state
  status                   TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (economic.is_budget_status(status)),
  status_changed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  /** Last warning emitted at; one warning per window threshold. */
  last_warning_at          TIMESTAMPTZ,
  /** Operator override — when set, soft thresholds are bypassed. */
  operator_override        BOOLEAN NOT NULL DEFAULT FALSE,
  operator_override_reason TEXT,
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ub_user   ON economic.user_budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_ub_tenant ON economic.user_budgets(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ub_status ON economic.user_budgets(status) WHERE status IN ('WARNING','THROTTLED','BLOCKED');


-- ============================================================================
-- 2. economic.platform_budget — single row keyed by 'singleton'
-- ============================================================================
CREATE TABLE IF NOT EXISTS economic.platform_budget (
  id                       TEXT PRIMARY KEY DEFAULT 'singleton',
  -- monthly cap (default $500)
  monthly_cap_micros       BIGINT NOT NULL DEFAULT 500_000_000  CHECK (monthly_cap_micros >= 0),
  current_monthly_micros   BIGINT NOT NULL DEFAULT 0            CHECK (current_monthly_micros >= 0),
  monthly_window_start     DATE NOT NULL DEFAULT date_trunc('month', NOW())::DATE,
  -- escalation status
  status                   TEXT NOT NULL DEFAULT 'NORMAL' CHECK (economic.is_platform_status(status)),
  status_changed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  /** Most recent threshold notification (50/75/90/95/100). */
  last_threshold_notified  INT NOT NULL DEFAULT 0,
  /** Operator override of hard-stop. Documented + audited. */
  operator_override        BOOLEAN NOT NULL DEFAULT FALSE,
  operator_override_reason TEXT,
  metadata                 JSONB NOT NULL DEFAULT '{}',
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (id = 'singleton')
);

-- Seed the singleton row if absent.
INSERT INTO economic.platform_budget (id) VALUES ('singleton')
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 3. economic.usage_events — per-call cost ledger
-- ============================================================================
CREATE TABLE IF NOT EXISTS economic.usage_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  tenant_id           UUID,
  -- what / where
  feature             TEXT NOT NULL,                  -- 'chat','upload.vision','upload.speech','simulation', ...
  provider            TEXT,                            -- 'gemini','openai','anthropic','local','other'
  model               TEXT,
  -- cost dimensions
  cost_dimension      TEXT NOT NULL CHECK (economic.is_cost_dimension(cost_dimension)),
  units               NUMERIC(20,4) NOT NULL DEFAULT 1, -- tokens, pages, minutes, images, calls
  unit_label          TEXT,
  cost_usd_micros     BIGINT NOT NULL DEFAULT 0      CHECK (cost_usd_micros >= 0),
  -- request linkage
  request_id          TEXT,
  governance_audit_id UUID,
  job_id              UUID,
  -- estimation vs actual
  estimated_micros    BIGINT,                          -- what the CostEstimator predicted
  estimation_error    NUMERIC(10,4),                    -- (actual - estimate) / max(estimate, 1)
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ue_user_time     ON economic.usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ue_tenant_time   ON economic.usage_events(tenant_id, created_at DESC) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ue_feature_time  ON economic.usage_events(feature, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ue_provider_time ON economic.usage_events(provider, created_at DESC) WHERE provider IS NOT NULL;


-- ============================================================================
-- 4. economic.rate_limit_buckets — token-bucket per (scope, owner)
-- ============================================================================
CREATE TABLE IF NOT EXISTS economic.rate_limit_buckets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope               TEXT NOT NULL CHECK (economic.is_rate_scope(scope)),
  /** Either user_id or tenant_id; both null only for global counters. */
  user_id             UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id           UUID,
  /** Bucket capacity (hour) — fills at refill_per_minute. */
  capacity            INT NOT NULL CHECK (capacity > 0),
  refill_per_minute   INT NOT NULL CHECK (refill_per_minute > 0),
  tokens_remaining    INT NOT NULL,
  /** Optional separate day-counter (for "100 chat / day" style caps). */
  daily_capacity      INT,
  daily_used          INT NOT NULL DEFAULT 0,
  daily_window_start  DATE NOT NULL DEFAULT CURRENT_DATE,
  last_refill_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scope, user_id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_rl_user   ON economic.rate_limit_buckets(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rl_tenant ON economic.rate_limit_buckets(tenant_id) WHERE tenant_id IS NOT NULL;


-- ============================================================================
-- 5. economic.circuit_breakers — feature-level breakers
-- ============================================================================
CREATE TABLE IF NOT EXISTS economic.circuit_breakers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature             TEXT NOT NULL UNIQUE,         -- 'upload.vision','provider.openai','chat',...
  state               TEXT NOT NULL DEFAULT 'CLOSED' CHECK (economic.is_breaker_state(state)),
  trigger_reason      TEXT,
  failure_count       INT NOT NULL DEFAULT 0,
  failure_threshold   INT NOT NULL DEFAULT 5,
  /** When the breaker opened. Used for the half-open recovery window. */
  opened_at           TIMESTAMPTZ,
  /** When to attempt recovery (transition to HALF_OPEN). */
  retry_at            TIMESTAMPTZ,
  /** Action to take while OPEN — degrade vs queue vs disable vs shutdown. */
  open_action         TEXT NOT NULL DEFAULT 'degrade',
  operator_override   BOOLEAN NOT NULL DEFAULT FALSE,
  metadata            JSONB NOT NULL DEFAULT '{}',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cb_state ON economic.circuit_breakers(state);


-- ============================================================================
-- 6. economic.abuse_events — abuse-detector findings
-- ============================================================================
CREATE TABLE IF NOT EXISTS economic.abuse_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  tenant_id           UUID,
  kind                TEXT NOT NULL CHECK (economic.is_abuse_kind(kind)),
  action_taken        TEXT NOT NULL CHECK (economic.is_abuse_action(action_taken)),
  signal              JSONB NOT NULL DEFAULT '{}',    -- counters / thresholds that fired
  feature             TEXT,
  severity            TEXT NOT NULL DEFAULT 'MODERATE' CHECK (severity IN ('LOW','MODERATE','HIGH','CRITICAL')),
  resolved_at         TIMESTAMPTZ,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ae_user_time ON economic.abuse_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ae_severity  ON economic.abuse_events(severity)
  WHERE severity IN ('HIGH','CRITICAL');


-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE economic.user_budgets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic.platform_budget    ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic.usage_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic.circuit_breakers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic.abuse_events       ENABLE ROW LEVEL SECURITY;

-- Owner read on user_budgets / usage_events / abuse_events.
DROP POLICY IF EXISTS ub_owner ON economic.user_budgets;
CREATE POLICY ub_owner ON economic.user_budgets
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS ub_service ON economic.user_budgets;
CREATE POLICY ub_service ON economic.user_budgets FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS ue_owner ON economic.usage_events;
CREATE POLICY ue_owner ON economic.usage_events
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS ue_service ON economic.usage_events;
CREATE POLICY ue_service ON economic.usage_events FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS ae_owner ON economic.abuse_events;
CREATE POLICY ae_owner ON economic.abuse_events
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS ae_service ON economic.abuse_events;
CREATE POLICY ae_service ON economic.abuse_events FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- platform_budget / rate_limit_buckets / circuit_breakers are
-- service-role only — operators access them via the dashboard route
-- which itself runs under the service-role client.
DROP POLICY IF EXISTS pb_service ON economic.platform_budget;
CREATE POLICY pb_service ON economic.platform_budget FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS rl_service ON economic.rate_limit_buckets;
CREATE POLICY rl_service ON economic.rate_limit_buckets FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS cb_service ON economic.circuit_breakers;
CREATE POLICY cb_service ON economic.circuit_breakers FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

GRANT SELECT ON economic.user_budgets       TO authenticated;
GRANT SELECT ON economic.usage_events       TO authenticated;
GRANT SELECT ON economic.abuse_events       TO authenticated;

-- Public views for the SDK.
CREATE OR REPLACE VIEW public.economic_user_budgets      AS SELECT * FROM economic.user_budgets;
CREATE OR REPLACE VIEW public.economic_usage_events      AS SELECT * FROM economic.usage_events;
CREATE OR REPLACE VIEW public.economic_abuse_events      AS SELECT * FROM economic.abuse_events;
CREATE OR REPLACE VIEW public.economic_platform_budget   AS SELECT * FROM economic.platform_budget;
CREATE OR REPLACE VIEW public.economic_rate_limit_buckets AS SELECT * FROM economic.rate_limit_buckets;
CREATE OR REPLACE VIEW public.economic_circuit_breakers  AS SELECT * FROM economic.circuit_breakers;

GRANT SELECT ON public.economic_user_budgets      TO authenticated;
GRANT SELECT ON public.economic_usage_events      TO authenticated;
GRANT SELECT ON public.economic_abuse_events      TO authenticated;

-- ============================================================================
-- Self-test
-- ============================================================================
DO $$
DECLARE
  expected TEXT[] := ARRAY[
    'user_budgets','platform_budget','usage_events',
    'rate_limit_buckets','circuit_breakers','abuse_events'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY expected LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='economic' AND c.relname=t AND c.relkind='r'
    ) THEN
      RAISE EXCEPTION '099 self-test: economic.% missing', t;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM economic.platform_budget WHERE id='singleton') THEN
    RAISE EXCEPTION '099 self-test: platform_budget singleton not seeded';
  END IF;
END $$;
