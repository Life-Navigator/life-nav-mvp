import DashboardClient from '@/components/dashboard/DashboardClient';
import FirstInsightCard from '@/components/dashboard/FirstInsightCard';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getFirstInsight, type FirstInsight } from '@/lib/finance/first-insight';
import { recordUserEvent } from '@/lib/analytics/events';

export const dynamic = 'force-dynamic';

/**
 * Dashboard page. Auth + onboarding gating happen in middleware. We
 * server-compute the "First Insight" from the user's persisted finance data so
 * the dashboard shows a specific, true, money-relevant fact on first paint.
 */
export default async function DashboardPage() {
  let firstInsight: FirstInsight | null = null;

  try {
    const supabase = await createServerSupabaseClient();
    const svc = createServiceRoleClient();
    if (supabase && svc) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        firstInsight = await getFirstInsight(svc, user.id);
        if (firstInsight?.has_data) {
          await recordUserEvent(svc, {
            user_id: user.id,
            event_type: 'first_insight_viewed',
            event_metadata: {
              persona_id: firstInsight.persona_id ?? null,
              severity: firstInsight.severity,
              metric: firstInsight.metric,
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
      {firstInsight?.has_data && (
        <div className="px-6 pt-6 max-w-[1400px] mx-auto w-full">
          <FirstInsightCard insight={firstInsight} />
        </div>
      )}
      <DashboardClient firstInsight={firstInsight} />
    </>
  );
}
