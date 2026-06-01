import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { classifyEngagementGroup } from '@/types/provider-portal';
import { Card, PageHeader } from '@/components/portal/provider/PortalShell';
import { EngagementBadge } from '@/components/portal/provider/StatusBadge';
import type { ProviderEngagement } from '@/types/provider';

export const dynamic = 'force-dynamic';

export default async function ProviderClientsPage() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect('/auth/login');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');
  const sb = supabase as any;
  const prof = await sb.from('provider_profiles').select('id').eq('user_id', user.id).maybeSingle();
  if (!prof.data) return null;

  const r = await sb.from('provider_engagements').select('*').eq('provider_id', prof.data.id);
  const engs = (r.data ?? []) as ProviderEngagement[];
  const counts = { active: 0, paused: 0, completed: 0 };
  for (const e of engs) {
    const g = classifyEngagementGroup(e.status);
    if (g === 'active') counts.active++;
    else if (g === 'paused') counts.paused++;
    else if (g === 'completed') counts.completed++;
  }

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`Active: ${counts.active} · Paused: ${counts.paused} · Completed: ${counts.completed}`}
      />
      <Card>
        {engs.length === 0 ? (
          <p className="text-sm text-slate-500">No engagements yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Patient</th>
                <th>Status</th>
                <th>Scope</th>
                <th>Accepted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {engs.map((e) => (
                <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2">
                    {(e.metadata?.patient_initials as string | undefined) ?? '—'}
                  </td>
                  <td>
                    <EngagementBadge status={e.status} />
                  </td>
                  <td className="text-xs text-slate-500">{e.allowed_domains.join(', ')}</td>
                  <td className="text-xs text-slate-500">
                    {e.accepted_at ? new Date(e.accepted_at).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <Link
                      className="text-emerald-700 hover:underline"
                      href={`/portal/provider/clients/${e.id}`}
                    >
                      Open →
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
