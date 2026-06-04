-- 109_funnel_event_types.sql
-- Add beta-activation funnel event types to the analytics.is_event_type()
-- whitelist (CHECK on analytics.user_events). Idempotent.

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
    'provider_referral_accepted'
  )
$function$;
