'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { MessageKind } from '@/types/provider-portal';

interface Props {
  engagementId: string;
  patientUserId: string;
}

const KINDS: Array<{ value: MessageKind; label: string }> = [
  { value: 'follow_up_request', label: 'Follow-up request' },
  { value: 'review_request', label: 'Review request' },
  { value: 'clarification_request', label: 'Clarification' },
  { value: 'general_note', label: 'General note' },
];

export function MessageComposer({ engagementId, patientUserId }: Props) {
  const router = useRouter();
  const [kind, setKind] = useState<MessageKind>('general_note');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function send() {
    setErr(null);
    startTransition(async () => {
      const r = await fetch('/api/provider/portal/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          engagement_id: engagementId,
          patient_user_id: patientUserId,
          kind,
          subject: subject || undefined,
          body,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr(j?.reason ?? j?.error ?? `request failed (${r.status})`);
        return;
      }
      setSubject('');
      setBody('');
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as MessageKind)}
          className="rounded border border-slate-300 px-2 py-1 text-sm bg-white dark:bg-slate-900 dark:border-slate-700"
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject (optional)"
          className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm bg-white dark:bg-slate-900 dark:border-slate-700"
        />
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Write a message…"
        className="block w-full rounded border border-slate-300 px-2 py-1 text-sm bg-white dark:bg-slate-900 dark:border-slate-700"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={send}
          disabled={busy || !body.trim()}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Send
        </button>
        {err ? <span className="text-xs text-rose-600">{err}</span> : null}
      </div>
    </div>
  );
}
