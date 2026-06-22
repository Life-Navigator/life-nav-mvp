import DashboardClient from '@/components/dashboard/DashboardClient';
import ExecutiveSummary from '@/components/dashboard/ExecutiveSummary';
import LifeBrief from '@/components/dashboard/LifeBrief';
import LifeBriefExecutive from '@/components/dashboard/LifeBriefExecutive';
// NOTE: LifeIntelligence is intentionally NOT rendered on the dashboard (pilot UX cleanup) — it is
// pure internal reasoning (primary/competing objectives + confidence%). The component file is kept so
// it can live behind "My Life" later. Do not re-add the import here without that decision.
import MissionControl from '@/components/dashboard/MissionControl';
import RecentlyLearned from '@/components/dashboard/RecentlyLearned';
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

  // Dashboard order (pilot UX cleanup), top → bottom:
  //   1. DashboardClient — the operational overview (Welcome · domain Overviews · Alerts · Goals ·
  //      Quick Actions). The FIRST thing the user sees.
  //   2. LifeBrief — compact narrative card (collapsible).
  //   3. ExecutiveSummary — the page's single readiness ring + grounded priorities/risks/opps.
  //   4. MissionControl — enriched next-best-action + onboarding CTA (its own ring is hidden).
  // LifeIntelligence is intentionally removed (internal reasoning).
  return (
    <>
      <DashboardClient firstInsight={firstInsight} />
      <div className="px-6 pb-6 max-w-[1400px] mx-auto w-full">
        {/* Life Brief (Phase 6): grounded executive summary from REAL career + education
            readiness — title, summary, scores, confidence, next move, "why this brief".
            100% deterministic from /api/life-brief (no fabricated facts). */}
        <div className="mb-6">
          <LifeBriefExecutive />
        </div>
        {/* Life Brief (Experience Excellence): the narrative — their own life story, goals, tension,
            and next move in plain language. Compact by default; expandable to the full brief.
            100% real data from /api/life/my-life `life_brief`; honest "still forming" empty state. */}
        <div className="mb-6">
          <LifeBrief />
        </div>
        {/* Recently learned (UI/Backend Parity): surfaces extracted document facts (life.facts) so the
            user SEES what uploads taught the platform. 100% real data from /api/life/facts; hidden until
            there is something real to show. */}
        <div className="mb-6">
          <RecentlyLearned />
        </div>
        {/* Executive summary (P4): readiness ring, vision, next best action, priorities, risks,
            opportunities, goal progress — 100% real data from /api/life/my-life + /api/goals,
            honest empty states. Holds the page's single readiness ring. */}
        <div className="mb-6">
          <ExecutiveSummary />
        </div>
        {/* Mission Control: the enriched next-best-action + onboarding CTA. Its own readiness ring
            is hidden — only ExecutiveSummary shows a ring. The top recommendation also appears as a
            compact preview inside DashboardClient's Alerts module; full list on
            /dashboard/recommendations. */}
        <MissionControl />
      </div>
    </>
  );
}
