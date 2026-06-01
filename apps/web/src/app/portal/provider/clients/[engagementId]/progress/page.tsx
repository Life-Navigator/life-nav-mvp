import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { assembleProgressMonitoring } from '@/lib/provider/progress-monitoring-service';
import { Card, PageHeader, StatTile } from '@/components/portal/provider/PortalShell';
import type { BiometricObservation, LabResult } from '@/types/arcana';
import type { ProviderDomain, ProviderEngagement } from '@/types/provider';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ engagementId: string }>;
}

export default async function ProgressMonitoringPage({ params }: Props) {
  const { engagementId } = await params;
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect('/auth/login');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');
  const sb = supabase as any;
  const prof = await sb.from('provider_profiles').select('id').eq('user_id', user.id).maybeSingle();
  if (!prof.data) return null;

  const er = await sb
    .from('provider_engagements')
    .select('*')
    .eq('id', engagementId)
    .eq('provider_id', prof.data.id)
    .maybeSingle();
  if (!er.data) {
    return (
      <Card>
        <p className="text-sm text-slate-500">Engagement not found.</p>
      </Card>
    );
  }
  const eng = er.data as ProviderEngagement;
  if (eng.status !== 'active') {
    return (
      <Card>
        <p className="text-sm text-slate-500">Engagement is not active.</p>
      </Card>
    );
  }

  const [obsRes, labRes, probRes] = await Promise.all([
    sb
      .from('biometric_observations')
      .select('*')
      .eq('user_id', eng.patient_user_id)
      .order('collected_at', { ascending: false })
      .limit(400),
    sb
      .from('lab_results')
      .select('*')
      .eq('user_id', eng.patient_user_id)
      .order('collection_date', { ascending: false })
      .limit(200),
    sb
      .from('goal_probability_distribution')
      .select('most_likely_prob, computed_at')
      .eq('user_id', eng.patient_user_id)
      .order('computed_at', { ascending: false })
      .limit(2),
  ]);
  const view = assembleProgressMonitoring({
    engagement_id: engagementId,
    patient_user_id: eng.patient_user_id,
    scope_domains: eng.allowed_domains as ProviderDomain[],
    observations: (obsRes.data ?? []) as BiometricObservation[],
    labs: (labRes.data ?? []) as LabResult[],
    adherence: {},
    probability_current: probRes.data?.[0]?.most_likely_prob ?? null,
    probability_prior: probRes.data?.[1]?.most_likely_prob ?? null,
    goals_summary: [],
    now: new Date().toISOString(),
  });

  return (
    <>
      <PageHeader
        title="Progress monitoring"
        subtitle="Biometric trends, labs, compliance, and probability."
      />

      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatTile
          label="Probability now"
          value={
            view.probability.current != null
              ? (view.probability.current * 100).toFixed(0) + '%'
              : '—'
          }
        />
        <StatTile
          label="Probability prior"
          value={
            view.probability.prior != null ? (view.probability.prior * 100).toFixed(0) + '%' : '—'
          }
        />
        <StatTile
          label="Delta"
          value={
            view.probability.delta != null
              ? (view.probability.delta > 0 ? '+' : '') +
                (view.probability.delta * 100).toFixed(0) +
                '%'
              : '—'
          }
          emphasis={
            view.probability.delta != null
              ? view.probability.delta < 0
                ? 'bad'
                : 'good'
              : 'neutral'
          }
        />
      </section>

      <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold">Biometrics</h2>
          {view.biometrics.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No observations in window.</p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm">
              {view.biometrics.map((b) => (
                <li
                  key={b.metric_kind}
                  className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 py-1.5"
                >
                  <span className="capitalize">{b.metric_kind.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-slate-500">
                    {b.most_recent != null ? `${b.most_recent} ${b.points[0]?.unit ?? ''}` : '—'}
                    {b.delta != null ? (
                      <span
                        className={`ml-2 ${b.delta < 0 ? 'text-rose-600' : 'text-emerald-600'}`}
                      >
                        Δ {b.delta}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Labs</h2>
          {view.labs.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No lab results in window.</p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm">
              {view.labs.map((l) => (
                <li
                  key={l.lab_kind}
                  className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 py-1.5"
                >
                  <span>{l.lab_kind.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-slate-500">
                    {l.points[0]?.result_value ?? '—'} {l.points[0]?.unit ?? ''}
                    {l.points[0]?.flag ? (
                      <span className="ml-2 uppercase">{l.points[0].flag}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </>
  );
}
