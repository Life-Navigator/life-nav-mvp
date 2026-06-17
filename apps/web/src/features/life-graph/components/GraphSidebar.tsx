'use client';

import Link from 'next/link';
import { Brain, Network, Clock, Database, Lightbulb, FileText } from 'lucide-react';
import type { GraphView } from '../types';

interface Props {
  view: GraphView;
  onSetView: (v: GraphView) => void;
  counts: { recommendations: number; sources: number };
}

const VIEWS: Array<{ key: GraphView; label: string; icon: typeof Brain; hint: string }> = [
  { key: 'brain', label: 'Brain View', icon: Brain, hint: 'Full 3D life graph' },
  { key: 'network', label: 'Network View', icon: Network, hint: 'Whole network, fit to view' },
  { key: 'timeline', label: 'Timeline View', icon: Clock, hint: 'Recently updated, newest first' },
  { key: 'sources', label: 'Data Sources', icon: Database, hint: 'Evidence + source tables only' },
  {
    key: 'recommendations',
    label: 'Recommendations',
    icon: Lightbulb,
    hint: 'Recommendation lineage only',
  },
];

export function GraphSidebar({ view, onSetView, counts }: Props) {
  return (
    <aside className="w-72 shrink-0 border-r border-white/10 bg-slate-950/80 p-4">
      <div className="text-xl font-semibold">Life Knowledge Graph</div>
      <div className="mt-1 text-xs text-slate-400">Explainable decision intelligence</div>

      <div className="mt-6 space-y-1 text-sm">
        {VIEWS.map(({ key, label, icon: Icon, hint }) => {
          const active = view === key;
          const badge =
            key === 'recommendations'
              ? counts.recommendations
              : key === 'sources'
                ? counts.sources
                : 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSetView(key)}
              title={hint}
              className={[
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition',
                active
                  ? 'bg-blue-500/15 text-blue-200 ring-1 ring-blue-400/30'
                  : 'text-slate-300 hover:bg-white/5',
              ].join(' ')}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {badge > 0 && (
                <span className="rounded-full bg-white/10 px-1.5 text-[10px] text-slate-300">
                  {badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Reports lives on its own page — a real route, not a graph filter. */}
        <Link
          href="/dashboard/reports"
          className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-300 transition hover:bg-white/5"
        >
          <FileText className="h-4 w-4 shrink-0" />
          <span className="flex-1">Reports</span>
        </Link>
      </div>

      <div className="mt-6 space-y-1 border-t border-white/10 pt-4 text-xs">
        <div className="px-3 pb-1 uppercase tracking-wide text-slate-500">Open in dashboard</div>
        <Link
          href="/dashboard/recommendations"
          className="block rounded-lg px-3 py-1.5 text-slate-400 hover:bg-white/5"
        >
          All recommendations →
        </Link>
        <Link
          href="/dashboard/documents"
          className="block rounded-lg px-3 py-1.5 text-slate-400 hover:bg-white/5"
        >
          Documents &amp; data sources →
        </Link>
      </div>
    </aside>
  );
}
