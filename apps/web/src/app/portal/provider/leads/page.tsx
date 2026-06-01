import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { loadLeadList } from '@/lib/provider/portal-loaders';
import { Card, PageHeader } from '@/components/portal/provider/PortalShell';
import { LeadStatusBadge } from '@/components/portal/provider/StatusBadge';

export const dynamic = 'force-dynamic';

export default async function ProviderLeadsPage() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect('/auth/login');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');
  const sb = supabase as any;
  const prof = await sb.from('provider_profiles').select('id').eq('user_id', user.id).maybeSingle();
  if (!prof.data) return null;

  const leads = await loadLeadList(sb, prof.data.id);
  return (
    <>
      <PageHeader title="Leads" subtitle="Patient lead packages awaiting review." />
      <Card>
        {leads.length === 0 ? (
          <p className="text-sm text-slate-500">
            No leads yet. They will appear here when a patient grants you consent.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Patient</th>
                <th>Primary goal</th>
                <th>Readiness</th>
                <th>Risks</th>
                <th>Generated</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr
                  key={l.lead_package_id}
                  className="border-t border-slate-100 dark:border-slate-800"
                >
                  <td className="py-2">
                    {l.patient_initials}
                    {l.age_band ? ` · ${l.age_band}` : ''}
                  </td>
                  <td>{l.primary_goal_title ?? '—'}</td>
                  <td>
                    {l.readiness_score != null ? (l.readiness_score * 100).toFixed(0) + '%' : '—'}
                  </td>
                  <td>{l.key_risk_count}</td>
                  <td>{new Date(l.generated_at).toLocaleDateString()}</td>
                  <td>
                    <LeadStatusBadge status={l.status} />
                  </td>
                  <td>
                    <Link
                      className="text-emerald-700 hover:underline"
                      href={`/portal/provider/leads/${l.lead_package_id}`}
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
