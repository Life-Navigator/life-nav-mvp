import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { loadAnalytics } from '@/lib/provider/portal-loaders';
import { Card, PageHeader, StatTile } from '@/components/portal/provider/PortalShell';

export const dynamic = 'force-dynamic';

export default async function ProviderAnalyticsPage() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect('/auth/login');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');
  const sb = supabase as any;
  const prof = await sb.from('provider_profiles').select('id').eq('user_id', user.id).maybeSingle();
  if (!prof.data) return null;
  const a = await loadAnalytics(sb, prof.data.id, 'monthly');

  const pct = (v?: number | null) => (v == null ? '—' : (v * 100).toFixed(0) + '%');
  return (
    <>
      <PageHeader title="Analytics" subtitle={`${a.period} starting ${a.period_start}`} />
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Active clients" value={a.active_clients} />
        <StatTile label="Acceptance" value={pct(a.acceptance_rate)} />
        <StatTile label="Completion" value={pct(a.completion_rate)} />
        <StatTile label="Outcome quality" value={pct(a.mean_outcome_quality)} />
        <StatTile label="Client retention" value={pct(a.client_retention_rate)} />
        <StatTile label="Readiness Δ" value={a.readiness_improvement_mean ?? '—'} />
        <StatTile label="Probability Δ" value={a.probability_improvement_mean ?? '—'} />
        <StatTile label="Goal completion" value={pct(a.goal_completion_rate)} />
      </section>
      <section className="mt-6">
        <Card>
          <h2 className="text-lg font-semibold">Effectiveness</h2>
          <p className="mt-2 text-3xl font-semibold">{pct(a.effectiveness_score)}</p>
          <p className="mt-1 text-xs text-slate-500">
            Composite of outcome quality, completion rate, readiness improvement, probability
            improvement, client retention, and goal completion. Null inputs are excluded from the
            average.
          </p>
        </Card>
      </section>
    </>
  );
}
