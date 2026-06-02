-- ============================================================================
-- 098: Internal Beta Instrumentation (Sprint O.0 Phases 5 + 6 + 7)
--
-- Three new schemas/tables for measurable internal beta:
--
--   analytics.user_events     — append-only stream of user-visible events.
--   public.decision_outcomes  — recommendation lifecycle (view/accept/.../complete).
--   feedback.recommendation_quality — structured quality / clarity / trust feedback.
--
-- RLS owner-read + service-role-write. Public views for the SDK.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS analytics;

-- ---- Enum helpers --------------------------------------------------------
CREATE OR REPLACE FUNCTION analytics.is_event_type(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT p IN (
    'onboarding_started',
    'onboarding_completed',
    'goal_created',
    'goal_updated',
    'document_uploaded',
    'plaid_connected',
    'recommendation_generated',
    'recommendation_viewed',
    'recommendation_accepted',
    'recommendation_ignored',
    'recommendation_dismissed',
    'recommendation_completed',
    'simulation_run',
    'simulation_compared',
    'arcana_intake_started',
    'arcana_intake_completed',
    'provider_referral_generated',
    'provider_referral_accepted'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_decision_outcome_state(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT p IN ('generated','viewed','accepted','ignored','dismissed','completed')
$$;

-- ============================================================================
-- analytics.user_events
-- ============================================================================
CREATE TABLE IF NOT EXISTS analytics.user_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id           UUID,
  event_type          TEXT NOT NULL CHECK (analytics.is_event_type(event_type)),
  event_metadata      JSONB NOT NULL DEFAULT '{}',
  /** Optional reference to the subject the event is about (recommendation,
   *  goal, simulation, ...). */
  subject_kind        TEXT,
  subject_id          UUID,
  /** Optional client context (route, user-agent fingerprint hash, etc). */
  context             JSONB NOT NULL DEFAULT '{}',
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ue_user_time
  ON analytics.user_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ue_event_time
  ON analytics.user_events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ue_tenant_time
  ON analytics.user_events(tenant_id, occurred_at DESC) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ue_subject
  ON analytics.user_events(subject_kind, subject_id);

ALTER TABLE analytics.user_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ue_owner ON analytics.user_events;
CREATE POLICY ue_owner ON analytics.user_events
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS ue_service ON analytics.user_events;
CREATE POLICY ue_service ON analytics.user_events
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE OR REPLACE VIEW public.analytics_user_events AS
  SELECT * FROM analytics.user_events;
GRANT SELECT ON public.analytics_user_events TO authenticated;

-- ============================================================================
-- public.decision_outcomes
--
-- One row per recommendation. State transitions are recorded by updating
-- the row + appending a row to `decision_outcome_events` (history).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.decision_outcomes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id   UUID NOT NULL UNIQUE,
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  /** Optional FK to the governance audit row that approved this rec. */
  governance_audit_id UUID,
  state               TEXT NOT NULL DEFAULT 'generated'
                       CHECK (public.is_decision_outcome_state(state)),
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  viewed_at           TIMESTAMPTZ,
  accepted_at         TIMESTAMPTZ,
  ignored_at          TIMESTAMPTZ,
  dismissed_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  /** Operator-assigned [0,1] quality score (offline scoring loop). */
  outcome_score       NUMERIC(3,2)
                       CHECK (outcome_score IS NULL OR (outcome_score BETWEEN 0 AND 1)),
  /** Optional free-text user feedback paired with the outcome. */
  user_feedback       TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_do_user_state
  ON public.decision_outcomes(user_id, state);
CREATE INDEX IF NOT EXISTS idx_do_state_time
  ON public.decision_outcomes(state, updated_at DESC);

ALTER TABLE public.decision_outcomes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS do_owner ON public.decision_outcomes;
CREATE POLICY do_owner ON public.decision_outcomes
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS do_owner_update ON public.decision_outcomes;
CREATE POLICY do_owner_update ON public.decision_outcomes
  FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS do_service ON public.decision_outcomes;
CREATE POLICY do_service ON public.decision_outcomes
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ---- Event history (state-transition trail) -----------------------------
CREATE TABLE IF NOT EXISTS public.decision_outcome_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_outcome_id UUID NOT NULL REFERENCES public.decision_outcomes(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_state          TEXT CHECK (from_state IS NULL OR public.is_decision_outcome_state(from_state)),
  to_state            TEXT NOT NULL CHECK (public.is_decision_outcome_state(to_state)),
  metadata            JSONB NOT NULL DEFAULT '{}',
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doe_decision
  ON public.decision_outcome_events(decision_outcome_id, occurred_at DESC);

ALTER TABLE public.decision_outcome_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS doe_owner ON public.decision_outcome_events;
CREATE POLICY doe_owner ON public.decision_outcome_events
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS doe_service ON public.decision_outcome_events;
CREATE POLICY doe_service ON public.decision_outcome_events
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ============================================================================
-- feedback.recommendation_quality
-- Structured per-recommendation feedback paired with the audit chain.
-- ============================================================================
CREATE TABLE IF NOT EXISTS feedback.recommendation_quality (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recommendation_id   UUID NOT NULL,
  decision_outcome_id UUID REFERENCES public.decision_outcomes(id) ON DELETE SET NULL,
  governance_audit_id UUID,
  helpfulness         TEXT NOT NULL
                        CHECK (helpfulness IN ('helpful','neutral','not_helpful')),
  explanation_clarity TEXT NOT NULL
                        CHECK (explanation_clarity IN ('clear','confusing')),
  trust               TEXT NOT NULL
                        CHECK (trust IN ('trust','neutral','distrust')),
  /** "Did this improve your situation?" – yes/no/unknown */
  outcome             TEXT NOT NULL DEFAULT 'unknown'
                        CHECK (outcome IN ('improved','no_change','worse','unknown')),
  free_text           TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rq_user_time
  ON feedback.recommendation_quality(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rq_recommendation
  ON feedback.recommendation_quality(recommendation_id);

ALTER TABLE feedback.recommendation_quality ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rq_owner ON feedback.recommendation_quality;
CREATE POLICY rq_owner ON feedback.recommendation_quality
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS rq_owner_insert ON feedback.recommendation_quality;
CREATE POLICY rq_owner_insert ON feedback.recommendation_quality
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS rq_service ON feedback.recommendation_quality;
CREATE POLICY rq_service ON feedback.recommendation_quality
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE OR REPLACE VIEW public.feedback_recommendation_quality AS
  SELECT * FROM feedback.recommendation_quality;
GRANT SELECT ON public.feedback_recommendation_quality TO authenticated;

CREATE OR REPLACE VIEW public.decision_outcomes_v AS
  SELECT * FROM public.decision_outcomes;
GRANT SELECT ON public.decision_outcomes_v TO authenticated;

-- ============================================================================
-- Self-test
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname='analytics' AND c.relname='user_events') THEN
    RAISE EXCEPTION '098 self-test: analytics.user_events missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname='public' AND c.relname='decision_outcomes') THEN
    RAISE EXCEPTION '098 self-test: public.decision_outcomes missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname='feedback' AND c.relname='recommendation_quality') THEN
    RAISE EXCEPTION '098 self-test: feedback.recommendation_quality missing';
  END IF;
END $$;
