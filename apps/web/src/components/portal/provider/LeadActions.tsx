'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Client component handling lead Accept / Decline.
 * Wraps the POST /api/provider/portal/leads/[leadId] action endpoint.
 */
export function LeadActions({
  leadId,
  alreadyAccepted,
}: {
  leadId: string;
  alreadyAccepted: boolean;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [reason, setReason] = useState<string>('other');
  const [err, setErr] = useState<string | null>(null);

  function run(action: 'accept' | 'decline') {
    setErr(null);
    startTransition(async () => {
      const r = await fetch(`/api/provider/portal/leads/${leadId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr(j?.error ?? `request failed (${r.status})`);
        return;
      }
      router.refresh();
    });
  }

  if (alreadyAccepted) {
    return (
      <div className="text-xs text-emerald-700 dark:text-emerald-400">Engagement is active.</div>
    );
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => run('accept')}
        disabled={busy}
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        Accept
      </button>
      <select
        className="rounded-md border border-slate-300 px-2 py-1 text-sm bg-white dark:bg-slate-900 dark:border-slate-700"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={busy}
      >
        <option value="capacity">Capacity</option>
        <option value="outside_scope">Outside scope</option>
        <option value="wrong_specialty">Wrong specialty</option>
        <option value="geographic">Geographic</option>
        <option value="patient_preference_mismatch">Preference mismatch</option>
        <option value="other">Other</option>
      </select>
      <button
        onClick={() => run('decline')}
        disabled={busy}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 dark:border-slate-700"
      >
        Decline
      </button>
      {err ? <span className="text-xs text-rose-600">{err}</span> : null}
    </div>
  );
}
