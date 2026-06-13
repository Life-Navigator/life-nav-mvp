'use client';

import { useMemo } from 'react';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';
import type { LifeGraphWorkspace } from '../types';

interface Props {
  workspace: LifeGraphWorkspace;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
}

/** All metrics are computed from REAL workspace nodes/edges — no synthetic stats. */
export function GraphAnalyticsStrip({ workspace, onZoomIn, onZoomOut, onFit, onReset }: Props) {
  const m = useMemo(() => {
    const { nodes, edges, metrics } = workspace;
    const persisted = edges.filter((e) => e.provenance === 'persisted_edge').length;
    const verifiedPct = edges.length ? Math.round((persisted / edges.length) * 100) : 0;
    const strongest = edges.reduce<(typeof edges)[number] | null>(
      (best, e) => ((e.strength ?? 0) > (best?.strength ?? -1) ? e : best),
      null
    );
    const labelOf = (id?: string) => nodes.find((n) => n.id === id)?.label ?? id ?? '';
    const recommendations = nodes.filter((n) => n.type === 'recommendation').length;
    const evidence = nodes.filter((n) => n.type === 'evidence').length;
    return {
      nodeCount: metrics?.totalNodes ?? nodes.length,
      edgeCount: metrics?.totalEdges ?? edges.length,
      avgConfidence: metrics?.avgConfidence,
      verifiedPct,
      recommendations,
      evidence,
      strongest: strongest
        ? {
            label: `${labelOf(strongest.source)} ↔ ${labelOf(strongest.target)}`,
            strength: strongest.strength ?? 0,
          }
        : null,
    };
  }, [workspace]);

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-200">{value}</span>
    </div>
  );

  return (
    <div className="flex items-center justify-between gap-6 border-b border-white/10 bg-slate-950/60 px-6 py-2 backdrop-blur">
      <div className="flex items-center gap-6 overflow-x-auto">
        <Stat label="Nodes · Links" value={`${m.nodeCount} · ${m.edgeCount}`} />
        <Stat label="Recommendations" value={String(m.recommendations)} />
        <Stat label="Evidence" value={String(m.evidence)} />
        <Stat
          label="Avg confidence"
          value={m.avgConfidence != null ? `${Math.round(m.avgConfidence * 100)}%` : '—'}
        />
        <Stat label="Verified edges" value={`${m.verifiedPct}%`} />
        {m.strongest && (
          <Stat
            label="Strongest link"
            value={`${m.strongest.label} (${Math.round(m.strongest.strength * 100)}%)`}
          />
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {[
          { icon: ZoomIn, fn: onZoomIn, label: 'Zoom in' },
          { icon: ZoomOut, fn: onZoomOut, label: 'Zoom out' },
          { icon: Maximize2, fn: onFit, label: 'Fit view' },
          { icon: RotateCcw, fn: onReset, label: 'Reset' },
        ].map(({ icon: Icon, fn, label }) => (
          <button
            key={label}
            type="button"
            onClick={fn}
            title={label}
            aria-label={label}
            className="rounded-md border border-white/10 bg-white/5 p-1.5 text-slate-300 hover:bg-white/10"
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
