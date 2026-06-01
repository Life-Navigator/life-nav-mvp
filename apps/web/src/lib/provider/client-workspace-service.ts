/**
 * Client Workspace Service (Sprint J, Phase 3).
 *
 * Pure projection of the per-client view. Loader pulls the rows; this
 * function does the assembly. Scope filtering is the loader's job —
 * if a row arrives here, it has already passed RLS + has_access_to.
 */

import { computeRecommendationLifecycleStats } from './recommendation-service';
import type { ProviderDomain, ProviderRecommendation } from '@/types/provider';
import type { ClientWorkspaceGoalProgress, ClientWorkspaceView } from '@/types/provider-portal';

export interface ClientWorkspaceInputs {
  engagement_id: string;
  patient_user_id: string;
  patient_initials: string;
  scope_domains: ProviderDomain[];
  goals: ClientWorkspaceGoalProgress[];
  recommendations: ProviderRecommendation[];
  now: string;
}

export function assembleClientWorkspace(inputs: ClientWorkspaceInputs): ClientWorkspaceView {
  const stats = computeRecommendationLifecycleStats(inputs.recommendations);

  // Goal sort: by probability_delta descending (biggest drops first),
  // falling back to title for stability.
  const goals = inputs.goals.slice().sort((a, b) => {
    const da = a.probability_delta ?? 0;
    const db = b.probability_delta ?? 0;
    if (da !== db) return da - db;
    return a.goal_title.localeCompare(b.goal_title);
  });

  // Recommendation sort: most recent first; status open before closed.
  const recommendations = inputs.recommendations.slice().sort((a, b) => {
    const openA = ['issued', 'accepted', 'modified'].includes(a.status) ? 0 : 1;
    const openB = ['issued', 'accepted', 'modified'].includes(b.status) ? 0 : 1;
    if (openA !== openB) return openA - openB;
    return a.issued_at < b.issued_at ? 1 : a.issued_at > b.issued_at ? -1 : 0;
  });

  return {
    engagement_id: inputs.engagement_id,
    patient_user_id: inputs.patient_user_id,
    patient_initials: inputs.patient_initials,
    scope_domains: inputs.scope_domains,
    goals,
    recommendations,
    recommendation_stats: {
      issued: stats.issued,
      accepted: stats.accepted,
      completed: stats.completed,
      abandoned: stats.abandoned,
      rejected: stats.rejected,
      acceptance_rate: Number(stats.acceptance_rate.toFixed(4)),
      completion_rate: Number(stats.completion_rate.toFixed(4)),
    },
    xai_summary_url: `/api/provider/portal/clients/${encodeURIComponent(inputs.engagement_id)}/xai`,
    generated_at: inputs.now,
  };
}

export const __test = { assembleClientWorkspace };
