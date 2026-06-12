'use client';

import { Activity, Link2, Clock, ZoomIn, ZoomOut, Maximize, RotateCcw } from 'lucide-react';
import type { GraphMetrics } from '@/types/lifeGraph';

function Metric({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.03] ring-1 ring-white/5">
        <Icon className="h-4 w-4 text-violet-300" />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-sm font-semibold text-slate-100">
          {value} {sub && <span className="text-[11px] font-normal text-slate-500">{sub}</span>}
        </div>
      </div>
    </div>
  );
}

function CtrlBtn({
  onClick,
  children,
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.03] text-slate-400 ring-1 ring-white/5 hover:bg-white/[0.07] hover:text-white"
    >
      {children}
    </button>
  );
}

export default function LifeGraphAnalyticsStrip({
  metrics,
  onZoomIn,
  onZoomOut,
  onFit,
  onReset,
}: {
  metrics: GraphMetrics;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
}) {
  const top = metrics.strongestConnections[0];
  return (
    <div className="flex h-16 items-center justify-between border-t border-white/5 bg-[#0a0c14]/80 backdrop-blur-xl">
      <div className="flex items-center divide-x divide-white/5">
        <Metric
          icon={Activity}
          label="Network density"
          value={`${Math.round(metrics.networkDensity * 100)}%`}
        />
        <Metric
          icon={Link2}
          label="Strongest connection"
          value={top ? `${Math.round(top.strength * 100)}%` : '—'}
          sub={top ? `${truncate(top.from)} → ${truncate(top.to)}` : ''}
        />
        <Metric icon={Clock} label="Updates · 24h" value={String(metrics.updatesLast24h)} />
        <Metric
          icon={Activity}
          label="Nodes · links"
          value={`${metrics.nodeCount} · ${metrics.linkCount}`}
        />
      </div>
      <div className="flex items-center gap-1.5 px-4">
        <span className="mr-2 text-[10px] uppercase tracking-wide text-slate-500">
          {Math.round(metrics.verifiedSourcePct * 100)}% verified
        </span>
        <CtrlBtn onClick={onZoomIn} title="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </CtrlBtn>
        <CtrlBtn onClick={onZoomOut} title="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </CtrlBtn>
        <CtrlBtn onClick={onFit} title="Fit view">
          <Maximize className="h-4 w-4" />
        </CtrlBtn>
        <CtrlBtn onClick={onReset} title="Reset view">
          <RotateCcw className="h-4 w-4" />
        </CtrlBtn>
      </div>
    </div>
  );
}

function truncate(s: string) {
  return s.length > 16 ? s.slice(0, 15) + '…' : s;
}
