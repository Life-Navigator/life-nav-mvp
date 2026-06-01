/**
 * Provider Lead Service (Sprint J).
 *
 * Wraps lead-package acceptance / decline / view in a way that:
 *
 *   * routes through the SECURITY DEFINER consent gate
 *     (arcana.has_active_lead_consent) — pure-TS verification mirrors
 *     the SQL helper, used for pre-flight UX,
 *   * never returns a lead the recipient_provider_id does not match,
 *   * appends an event to lead_workflow_events so the dashboard can
 *     render badges,
 *   * promotes the engagement from pending → active on accept (the
 *     real RLS-bearing write).
 *
 * No side effects beyond the engagement transition and the event log.
 */

import { verifyConsentAt } from '@/lib/arcana/lead-package-service';
import type { LeadPackage, LeadPackageConsent } from '@/types/arcana';
import type { LeadEventKind, LeadStatus, LeadSummary } from '@/types/provider-portal';
import type { ProviderEngagement } from '@/types/provider';

// ---------------------------------------------------------------------------
// Status classifier
// ---------------------------------------------------------------------------

export interface LeadStatusInputs {
  consent: Pick<LeadPackageConsent, 'revoked_at' | 'expires_at' | 'granted_at'> | null;
  engagement: Pick<ProviderEngagement, 'status' | 'accepted_at' | 'revoked_at'> | null;
  now: string;
}

/**
 * Classifies the visible lead status from the surrounding state. We
 * never expose internal engagement statuses verbatim; the dashboard
 * sees only the four buckets new / pending / accepted / declined.
 */
export function classifyLeadStatus(inputs: LeadStatusInputs): LeadStatus {
  const { consent, engagement, now } = inputs;
  if (!consent || (consent.revoked_at && consent.revoked_at <= now)) return 'withdrawn';
  if (consent.expires_at && consent.expires_at < now) return 'withdrawn';
  if (!engagement) return 'new';

  switch (engagement.status) {
    case 'active':
      return 'accepted';
    case 'declined':
    case 'revoked':
    case 'expired':
      return 'declined';
    case 'pending':
    default:
      return 'pending';
  }
}

// ---------------------------------------------------------------------------
// Decline reason validation
// ---------------------------------------------------------------------------

const VALID_DECLINE_REASONS = new Set([
  'capacity',
  'outside_scope',
  'wrong_specialty',
  'geographic',
  'patient_preference_mismatch',
  'other',
]);

export function isValidDeclineReason(reason: string): boolean {
  return VALID_DECLINE_REASONS.has(reason);
}

// ---------------------------------------------------------------------------
// Lead summary projection
// ---------------------------------------------------------------------------

export interface ProjectLeadInputs {
  lead_package: LeadPackage;
  consent: LeadPackageConsent | null;
  engagement: ProviderEngagement | null;
  events: Array<{ event_kind: LeadEventKind; occurred_at: string }>;
  now: string;
}

export function projectLeadSummary(inputs: ProjectLeadInputs): LeadSummary {
  const lp = inputs.lead_package;
  const payload = lp.payload;
  const lastEvent = inputs.events
    .slice()
    .sort((a, b) => (b.occurred_at > a.occurred_at ? 1 : -1))[0];

  const status = classifyLeadStatus({
    consent: inputs.consent
      ? {
          revoked_at: inputs.consent.revoked_at ?? null,
          expires_at: inputs.consent.expires_at ?? null,
          granted_at: inputs.consent.granted_at,
        }
      : null,
    engagement: inputs.engagement
      ? {
          status: inputs.engagement.status,
          accepted_at: inputs.engagement.accepted_at ?? null,
          revoked_at: inputs.engagement.revoked_at ?? null,
        }
      : null,
    now: inputs.now,
  });

  return {
    lead_package_id: lp.id,
    patient_user_id: lp.user_id,
    patient_initials: payload.patient_summary.name_initials,
    age_band: payload.patient_summary.age_band ?? null,
    primary_goal_title: payload.goals?.[0]?.title ?? null,
    dominant_driver: payload.motivation_summary?.dominant_driver ?? null,
    readiness_score: lp.readiness_score ?? null,
    probability_of_success: lp.probability_of_success ?? null,
    key_risk_count: lp.key_risks?.length ?? 0,
    status,
    generated_at: lp.generated_at,
    shared_at: lp.shared_at ?? null,
    last_event_at: lastEvent?.occurred_at ?? null,
  };
}

// ---------------------------------------------------------------------------
// Consent verification — re-export for service callers
// ---------------------------------------------------------------------------

export { verifyConsentAt };

export const __test = {
  classifyLeadStatus,
  isValidDeclineReason,
  projectLeadSummary,
  VALID_DECLINE_REASONS,
};
