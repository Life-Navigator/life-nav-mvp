/**
 * User event stream — Sprint O.0 Phase 5.
 *
 *   recordUserEvent(supabase, { user_id, event_type, ... })
 *
 * Writes to `analytics.user_events` (via the `analytics_user_events`
 * public view). Best-effort: a write failure does NOT throw — the
 * runtime path the call lives on must not depend on telemetry.
 *
 * Event types are a fixed enum mirrored in the migration 098 CHECK.
 * Adding a new event type requires both a code change here and a
 * migration that extends the SQL helper.
 */

export type UserEventType =
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'goal_created'
  | 'goal_updated'
  | 'document_uploaded'
  | 'plaid_connected'
  | 'sample_financial_profile_activated'
  | 'recommendation_generated'
  | 'recommendation_viewed'
  | 'recommendation_accepted'
  | 'recommendation_ignored'
  | 'recommendation_dismissed'
  | 'recommendation_completed'
  | 'simulation_run'
  | 'simulation_compared'
  | 'arcana_intake_started'
  | 'arcana_intake_completed'
  | 'provider_referral_generated'
  | 'provider_referral_accepted';

export interface RecordUserEventInputs {
  user_id: string;
  tenant_id?: string | null;
  event_type: UserEventType;
  event_metadata?: Record<string, unknown>;
  subject_kind?: string;
  subject_id?: string;
  context?: Record<string, unknown>;
  occurred_at?: string;
}

export async function recordUserEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  inputs: RecordUserEventInputs
): Promise<void> {
  try {
    await supabase.from('analytics_user_events').insert({
      user_id: inputs.user_id,
      tenant_id: inputs.tenant_id ?? null,
      event_type: inputs.event_type,
      event_metadata: inputs.event_metadata ?? {},
      subject_kind: inputs.subject_kind ?? null,
      subject_id: inputs.subject_id ?? null,
      context: inputs.context ?? {},
      occurred_at: inputs.occurred_at ?? new Date().toISOString(),
    });
  } catch {
    /* best-effort */
  }
}
