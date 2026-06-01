import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { loadClientWorkspace, loadMessageThread } from '@/lib/provider/portal-loaders';
import { Card, PageHeader, StatTile } from '@/components/portal/provider/PortalShell';
import { MessageComposer } from '@/components/portal/provider/MessageComposer';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ engagementId: string }>;
}

export default async function ProviderClientWorkspacePage({ params }: Props) {
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

  const workspace = await loadClientWorkspace(sb, prof.data.id, engagementId);
  if ('error' in workspace) {
    return (
      <Card>
        <p className="text-sm text-slate-500">Engagement not found.</p>
      </Card>
    );
  }
  const thread = await loadMessageThread(sb, engagementId, user.id);

  return (
    <>
      <PageHeader
        title={`Client — ${workspace.patient_initials}`}
        subtitle={`Scope: ${workspace.scope_domains.join(', ')}`}
        actions={
          <Link
            href={`/portal/provider/clients/${engagementId}/new-recommendation`}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            New recommendation
          </Link>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Issued" value={workspace.recommendation_stats.issued} />
        <StatTile label="Accepted" value={workspace.recommendation_stats.accepted} />
        <StatTile
          label="Completed"
          value={workspace.recommendation_stats.completed}
          emphasis="good"
        />
        <StatTile
          label="Completion rate"
          value={(workspace.recommendation_stats.completion_rate * 100).toFixed(0) + '%'}
        />
      </section>

      <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Goals</h2>
            <Link
              className="text-xs text-emerald-700 hover:underline"
              href={`/portal/provider/clients/${engagementId}/progress`}
            >
              Progress monitoring →
            </Link>
          </div>
          {workspace.goals.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No in-scope goals visible.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {workspace.goals.map((g) => (
                <li
                  key={g.goal_id}
                  className="border-t border-slate-100 dark:border-slate-800 pt-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{g.goal_title}</span>
                    <span className="text-xs text-slate-500">{g.domain}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    progress{' '}
                    {g.current_progress != null ? (g.current_progress * 100).toFixed(0) + '%' : '—'}
                    · prob{' '}
                    {g.probability_now != null ? (g.probability_now * 100).toFixed(0) + '%' : '—'}
                    {g.probability_delta != null ? (
                      <span
                        className={`ml-1 ${g.probability_delta < 0 ? 'text-rose-600' : 'text-emerald-600'}`}
                      >
                        ({g.probability_delta > 0 ? '+' : ''}
                        {(g.probability_delta * 100).toFixed(0)}%)
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Recent recommendations</h2>
          {workspace.recommendations.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">None issued yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {workspace.recommendations.slice(0, 6).map((r) => (
                <li key={r.id} className="border-t border-slate-100 dark:border-slate-800 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{r.title}</span>
                    <span className="text-xs text-slate-500 uppercase">{r.status}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {r.domain} · issued {new Date(r.issued_at).toLocaleDateString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="mt-6">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Messages</h2>
            <span className="text-xs text-slate-500">
              {thread.total} message(s) · {thread.unread_for_viewer} unread
            </span>
          </div>
          <ul className="mt-3 space-y-2 text-sm max-h-72 overflow-y-auto">
            {thread.messages.length === 0 ? (
              <li className="text-slate-500">No messages yet.</li>
            ) : (
              thread.messages
                .slice()
                .reverse()
                .map((m) => (
                  <li key={m.id} className="border-t border-slate-100 dark:border-slate-800 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">{m.sender_role}</span>
                      <span className="text-xs text-slate-500">
                        {new Date(m.created_at).toLocaleString()}
                      </span>
                    </div>
                    {m.subject ? (
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        {m.subject}
                      </div>
                    ) : null}
                    <div>{m.body}</div>
                  </li>
                ))
            )}
          </ul>
          <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
            <MessageComposer
              engagementId={engagementId}
              patientUserId={workspace.patient_user_id}
            />
          </div>
        </Card>
      </section>
    </>
  );
}
