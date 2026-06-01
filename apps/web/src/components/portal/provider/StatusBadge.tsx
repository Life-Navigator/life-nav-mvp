import type { LeadStatus } from '@/types/provider-portal';
import type { EngagementStatus } from '@/types/provider';

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const map: Record<LeadStatus, { label: string; cls: string }> = {
    new: {
      label: 'New',
      cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
    },
    pending: {
      label: 'Pending',
      cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
    },
    accepted: {
      label: 'Accepted',
      cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300',
    },
    declined: {
      label: 'Declined',
      cls: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    },
    withdrawn: {
      label: 'Withdrawn',
      cls: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
    },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

export function EngagementBadge({ status }: { status: EngagementStatus }) {
  const map: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-800',
    pending: 'bg-amber-100 text-amber-800',
    paused: 'bg-slate-200 text-slate-700',
    revoked: 'bg-rose-100 text-rose-800',
    expired: 'bg-rose-100 text-rose-800',
    declined: 'bg-slate-200 text-slate-700',
  };
  const cls = map[status] ?? 'bg-slate-200 text-slate-700';
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>
  );
}

export function SeverityBadge({ severity }: { severity: 'low' | 'medium' | 'high' }) {
  const cls =
    severity === 'high'
      ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
      : severity === 'medium'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
        : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{severity}</span>
  );
}
