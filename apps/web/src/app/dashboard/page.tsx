import DashboardClient from '@/components/dashboard/DashboardClient';
import ExecutiveSummary from '@/components/dashboard/ExecutiveSummary';
import LifeIntelligence from '@/components/dashboard/LifeIntelligence';
import MissionControl from '@/components/dashboard/MissionControl';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
import type { FirstInsight } from '@/lib/finance/first-insight';
import { getRecommendations, type Recommendation } from '@/lib/finance/recommendations';
import { recordUserEvent } from '@/lib/analytics/events';

export const dynamic = 'force-dynamic';

/**
 * Dashboard page. Auth + onboarding gating happen in middleware. We
 * server-compute the persona-aware recommendation set from the user's persisted
 * finance data; the top one renders as "Today's brief" and the full set (>=3
 * categorized moves) renders below it. One DB read for both. Deterministic — no
 * model call, no 502 surface.
 */
export default async function DashboardPage() {
  let firstInsight: FirstInsight | null = null;
  let recommendations: Recommendation[] = [];

  try {
    const supabase = await createServerSupabaseClient();
    const svc = createServiceRoleClient();
    if (supabase && svc) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const set = await getRecommendations(svc, user.id);
        if (set.has_data && set.recommendations.length > 0) {
          recommendations = set.recommendations;
          const top = set.recommendations[0];
          firstInsight = {
            headline: top.title,
            detail: top.detail,
            recommendation: top.action,
            severity: top.severity,
            metric: top.metric,
            persona_id: set.persona_id,
            has_data: true,
          };
          await recordUserEvent(svc, {
            user_id: user.id,
            event_type: 'first_insight_viewed',
            event_metadata: {
              persona_id: firstInsight.persona_id ?? null,
              severity: firstInsight.severity,
              metric: firstInsight.metric,
              recommendation_count: recommendations.length,
            },
            subject_kind: 'first_insight',
            subject_id: null,
          });
        }
      }
    }
  } catch {
    // Never block the dashboard on the insight; it degrades to null.
  }

  return (
    <>
      <div className="px-6 pt-6 max-w-[1400px] mx-auto w-full">
        {/* Executive summary (P4): readiness, vision, next best action, priorities, risks,
            opportunities, goal progress — 100% real data from /api/life/my-life + /api/goals,
            honest empty states. The trust-first hero of the dashboard. */}
        <div className="mb-6">
          <ExecutiveSummary />
        </div>
        {/* 1. Life snapshot (vision / primary objective / discovery), then status.
            Recommendations are NOT shown here — the top recommendation appears as a
            compact preview inside the Alerts & Notifications module below the domain
            cards (DashboardClient); the full list lives on /dashboard/recommendations. */}
        <LifeIntelligence />
        <MissionControl />
      </div>
      <DashboardClient firstInsight={firstInsight} />
    </>
  );
}
