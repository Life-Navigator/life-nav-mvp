import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { loadDashboard } from '@/lib/provider/portal-loaders';
import { Card, PageHeader, StatTile } from '@/components/portal/provider/PortalShell';
import {
  EngagementBadge,
  LeadStatusBadge,
  SeverityBadge,
} from '@/components/portal/provider/StatusBadge';

export const dynamic = 'force-dynamic';

export default async function ProviderDashboardPage() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect('/auth/login');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');
  const sb = supabase as any;
  const prof = await sb.from('provider_profiles').select('id').eq('user_id', user.id).maybeSingle();
  if (!prof.data) return null;

  const d = await loadDashboard(sb, prof.data.id);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Leads, active clients, at-risk signals, and quick metrics."
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Active clients" value={d.metrics.active_clients} />
        <StatTile
          label="Acceptance rate"
          value={(d.metrics.recommendation_acceptance_rate * 100).toFixed(0) + '%'}
          emphasis={d.metrics.recommendation_acceptance_rate >= 0.4 ? 'good' : 'neutral'}
        />
        <StatTile
          label="Completion rate"
          value={(d.metrics.completion_rate * 100).toFixed(0) + '%'}
          emphasis={d.metrics.completion_rate >= 0.5 ? 'good' : 'neutral'}
        />
        <StatTile
          label="Mean outcome quality"
          value={
            d.metrics.mean_outcome_quality != null
              ? (d.metrics.mean_outcome_quality * 100).toFixed(0) + '%'
              : '—'
          }
        />
      </section>

      <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold">My Leads</h2>
          <div className="mt-1 flex gap-4 text-xs text-slate-500">
            <span>
              New: <strong>{d.leads.new_count}</strong>
            </span>
            <span>
              Pending: <strong>{d.leads.pending_count}</strong>
            </span>
            <span>
              Accepted: <strong>{d.leads.accepted_count}</strong>
            </span>
            <span>
              Declined: <strong>{d.leads.declined_count}</strong>
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {d.leads.rows.length === 0 ? (
              <li className="text-sm text-slate-500">No leads yet.</li>
            ) : (
              d.leads.rows.slice(0, 8).map((l) => (
                <li
                  key={l.lead_package_id}
                  className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2 text-sm"
                >
                  <div>
                    <Link
                      href={`/portal/provider/leads/${l.lead_package_id}`}
                      className="font-medium hover:underline"
                    >
                      {l.patient_initials}
                      {l.age_band ? ` · ${l.age_band}` : ''}
                    </Link>
                    {l.primary_goal_title ? (
                      <div className="text-xs text-slate-500">{l.primary_goal_title}</div>
                    ) : null}
                  </div>
                  <LeadStatusBadge status={l.status} />
                </li>
              ))
            )}
          </ul>
          <Link
            href="/portal/provider/leads"
            className="mt-3 inline-block text-sm text-emerald-700 hover:underline"
          >
            View all leads →
          </Link>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">My Clients</h2>
          <div className="mt-1 flex gap-4 text-xs text-slate-500">
            <span>
              Active: <strong>{d.clients.active_count}</strong>
            </span>
            <span>
              Paused: <strong>{d.clients.paused_count}</strong>
            </span>
            <span>
              Completed: <strong>{d.clients.completed_count}</strong>
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {d.clients.rows.length === 0 ? (
              <li className="text-sm text-slate-500">No clients yet.</li>
            ) : (
              d.clients.rows.slice(0, 8).map((c) => (
                <li
                  key={c.engagement_id}
                  className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2 text-sm"
                >
                  <div>
                    <Link
                      href={`/portal/provider/clients/${c.engagement_id}`}
                      className="font-medium hover:underline"
                    >
                      {c.patient_initials}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {c.open_recommendation_count} open rec(s) · prob{' '}
                      {c.most_recent_probability != null
                        ? (c.most_recent_probability * 100).toFixed(0) + '%'
                        : '—'}
                    </div>
                  </div>
                  <EngagementBadge status={c.status} />
                </li>
              ))
            )}
          </ul>
          <Link
            href="/portal/provider/clients"
            className="mt-3 inline-block text-sm text-emerald-700 hover:underline"
          >
            View all clients →
          </Link>
        </Card>
      </section>

      <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold">At-Risk Clients</h2>
          {d.at_risk.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No at-risk flags right now.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {d.at_risk.map((r) => (
                <li
                  key={r.engagement_id}
                  className="border-t border-slate-100 dark:border-slate-800 pt-2 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/portal/provider/clients/${r.engagement_id}`}
                      className="font-medium hover:underline"
                    >
                      {r.patient_initials}
                    </Link>
                    <SeverityBadge severity={r.severity} />
                  </div>
                  <div className="text-xs text-slate-500">{r.reasons.join(' · ')}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Upcoming Reviews</h2>
          {d.upcoming.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Nothing in the next 30 days.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {d.upcoming.map((u, i) => (
                <li
                  key={i}
                  className="border-t border-slate-100 dark:border-slate-800 pt-2 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/portal/provider/clients/${u.engagement_id}`}
                      className="font-medium hover:underline"
                    >
                      {u.patient_initials}
                    </Link>
                    <span className="text-xs uppercase text-slate-500">
                      {u.kind.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Due {new Date(u.due_at).toLocaleDateString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </>
  );
}
