-- 110_observability_event_types.sql
-- Beta hardening: add the observability anchor + error event types surfaced by
-- the 20-user readiness audit (OBSERVABILITY_GAPS_REPORT.md). Without these the
-- funnel has no signup anchor and the known chat-502 / activation failures are
-- uncountable. Idempotent (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION analytics.is_event_type(p text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $function$
  SELECT p IN (
    'onboarding_started',
    'onboarding_completed',
    'goal_created',
    'goal_updated',
    'document_uploaded',
    'plaid_connected',
    'sample_financial_profile_selected',
    'sample_financial_profile_activated',
    'first_insight_viewed',
    'first_chat_message',
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
    'provider_referral_accepted',
    -- 110: observability funnel anchor + error/retention events
    'user_signed_up',
    'session_started',
    'persona_activation_failed',
    'model_call_failed'
  )
$function$;
