-- 107_analytics_grants_and_persona_event.sql
--
-- Two fixes that made user-event audit writes silently fail:
--   1) the `analytics` schema/table had no API-role grants (like finance), so
--      inserts via the public.analytics_user_events view were denied; and
--   2) analytics.user_events has CHECK (analytics.is_event_type(event_type)),
--      a whitelist function that didn't include the new persona event type.
--
-- Idempotent.

-- 1) Grants so the web app (service_role / authenticated) can write events.
GRANT USAGE ON SCHEMA analytics TO service_role, authenticated;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA analytics TO service_role, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA analytics TO service_role, authenticated;
GRANT INSERT, SELECT ON public.analytics_user_events TO service_role, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics
  GRANT SELECT, INSERT ON TABLES TO service_role, authenticated;

-- 2) Allow the persona-activation audit event type.
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
    'sample_financial_profile_activated',
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

-- 3) RLS INSERT policy — authenticated users may write their own events.
--    (analytics.user_events has RLS enabled; without this every recordUserEvent
--    via the authenticated client was silently denied.)
DROP POLICY IF EXISTS user_events_insert_own ON analytics.user_events;
CREATE POLICY user_events_insert_own ON analytics.user_events
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
