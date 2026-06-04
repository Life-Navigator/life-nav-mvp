import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getRecommendations, type RecSeverity } from './recommendations';

/**
 * Server-side "First Insight" = the single highest-priority recommendation from
 * the persona-aware recommendation engine (see ./recommendations.ts), adapted to
 * the card's shape. Kept as a thin adapter so there is ONE source of truth for
 * recommendation content and compliance language (no model call; server-render
 * safe). For the full 3+ set, call getRecommendations directly.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Svc = SupabaseClient<any, any, any>;

export type InsightSeverity = RecSeverity;

export interface FirstInsight {
  headline: string;
  detail: string;
  recommendation: string;
  severity: InsightSeverity;
  metric: string;
  persona_id?: string;
  has_data: boolean;
}

export async function getFirstInsight(svc: Svc, userId: string): Promise<FirstInsight> {
  const set = await getRecommendations(svc, userId);

  if (!set.has_data || set.recommendations.length === 0) {
    return {
      headline: 'Activate a sample financial profile to see your first insight.',
      detail: 'Pick a profile and your office will read the accounts and brief you in seconds.',
      recommendation: 'Choose a sample financial profile to begin.',
      severity: 'neutral',
      metric: '',
      has_data: false,
    };
  }

  const top = set.recommendations[0];
  return {
    headline: top.title,
    detail: top.detail,
    recommendation: top.action,
    severity: top.severity,
    metric: top.metric,
    persona_id: set.persona_id,
    has_data: true,
  };
}
