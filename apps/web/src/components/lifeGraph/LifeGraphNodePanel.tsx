'use client';

import { useState } from 'react';
import { ChevronRight, Maximize2 } from 'lucide-react';
import type { LifeGraphNode, LifeGraphLink, GraphRecommendation } from '@/types/lifeGraph';
import { DOMAIN_META } from '@/types/lifeGraph';

const TABS = ['Overview', 'Data', 'Sources', 'Impact', 'History'] as const;
type Tab = (typeof TABS)[number];

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-100">{value}</div>
    </div>
  );
}

function pct(v?: number) {
  return v == null ? '—' : `${Math.round(v * 100)}%`;
}

export default function LifeGraphNodePanel({
  node,
  links,
  recommendations,
  onExpand,
}: {
  node: LifeGraphNode | null;
  links: LifeGraphLink[];
  recommendations: GraphRecommendation[];
  onExpand: (n: LifeGraphNode) => void;
}) {
  const [tab, setTab] = useState<Tab>('Overview');

  if (!node) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03] ring-1 ring-white/5">
          <Maximize2 className="h-5 w-5 text-slate-500" />
        </div>
        <div className="text-sm font-medium text-slate-300">Select a node</div>
        <p className="max-w-[200px] text-xs text-slate-500">
          Click any node to see what it is, the data behind it, and what depends on it. Double-click
          to zoom into its neighborhood.
        </p>
      </div>
    );
  }

  const meta = DOMAIN_META[node.domain] || DOMAIN_META.core;
  const conns = links.filter((l) => l.source === node.id || l.target === node.id);
  const avgStrength = conns.length ? conns.reduce((n, l) => n + l.strength, 0) / conns.length : 0;
  const recs = recommendations.filter(
    (r) =>
      node.recommendationIds?.includes(r.id) ||
      r.affectedGoals.includes(node.label) ||
      r.domain === node.domain
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/5 p-4">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: meta.color, boxShadow: `0 0 10px ${meta.color}` }}
          />
          <span
            className="text-[11px] font-medium uppercase tracking-wide"
            style={{ color: meta.glow }}
          >
            {meta.label}
          </span>
        </div>
        <h2 className="mt-1.5 text-lg font-semibold leading-tight text-white">{node.label}</h2>
        <p className="mt-1 text-xs text-slate-400">{node.description || node.type}</p>
        <button
          onClick={() => onExpand(node)}
          className="mt-3 inline-flex items-center gap-1 rounded-lg bg-violet-500/15 px-2.5 py-1.5 text-xs font-medium text-violet-200 ring-1 ring-inset ring-violet-400/20 hover:bg-violet-500/25"
        >
          Expand neighborhood <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 p-4">
        <Stat label="Type" value={<span className="capitalize">{node.type}</span>} />
        <Stat label="Score" value={node.score != null ? Math.round(node.score) : '—'} />
        <Stat label="Importance" value={pct(node.importance)} />
        <Stat label="Confidence" value={pct(node.confidence)} />
        <Stat label="Connections" value={conns.length} />
        <Stat label="Avg strength" value={pct(avgStrength)} />
      </div>

      <div className="flex gap-1 border-y border-white/5 px-3">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative px-2.5 py-2 text-xs font-medium transition-colors ${
              tab === t ? 'text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t}
            {tab === t && (
              <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-violet-400" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 text-sm">
        {tab === 'Overview' && (
          <div className="space-y-3 text-slate-300">
            <p className="text-[13px] leading-relaxed">
              {node.description || 'A node in your life knowledge graph.'}
            </p>
            <div className="text-xs text-slate-500">
              Last updated:{' '}
              <span className="text-slate-300">
                {node.lastUpdated ? new Date(node.lastUpdated).toLocaleDateString() : '—'}
              </span>
            </div>
          </div>
        )}

        {tab === 'Data' &&
          (node.calculation ? (
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Calculation</div>
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 font-mono text-[11px] leading-relaxed text-slate-300">
                {node.calculation.formula}
              </div>
              {node.calculation.adjustments.map((a) => (
                <div key={a.label} className="flex justify-between text-xs">
                  <span className="text-slate-400">{a.label}</span>
                  <span className={a.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {a.delta >= 0 ? '+' : ''}
                    {Math.round(a.delta * 100)}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyTab text="No computed inputs for this node yet — it's a recorded datapoint." />
          ))}

        {tab === 'Sources' &&
          (node.sourceIds?.length ? (
            <ul className="space-y-1.5">
              {node.sourceIds.map((s, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs"
                >
                  <span className="text-slate-300">{s}</span>
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                    Verified
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyTab text="Source provenance is shown on the data-source panel for connected datapoints." />
          ))}

        {tab === 'Impact' &&
          (recs.length ? (
            <ul className="space-y-2">
              {recs.slice(0, 6).map((r) => (
                <li key={r.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <div className="text-[13px] font-medium text-slate-100">{r.title}</div>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-400">{r.expectedImpact}</span>
                    <span className="text-slate-500">conf {pct(r.confidence)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyTab text="No recommendations currently depend on this node." />
          ))}

        {tab === 'History' &&
          (node.lineage?.length ? (
            <ol className="relative space-y-3 border-l border-white/10 pl-4">
              {node.lineage.map((s, i) => (
                <li key={i}>
                  <span className="absolute -left-[5px] mt-1 h-2 w-2 rounded-full bg-violet-400" />
                  <div className="text-[13px] font-medium text-slate-200">{s.label}</div>
                  <div className="text-xs text-slate-500">{s.detail}</div>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyTab text="No lineage trail recorded yet for this node." />
          ))}
      </div>
    </div>
  );
}

function EmptyTab({ text }: { text: string }) {
  return <p className="text-xs leading-relaxed text-slate-500">{text}</p>;
}
