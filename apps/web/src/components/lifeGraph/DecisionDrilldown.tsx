'use client';

import { useEffect, useState } from 'react';
import { X, GitBranch, Loader2, FileText, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Renders the REAL decision intelligence graph from /api/decision/graph (Core API
// /v1/decision/workspace/graph) as an explainable lineage. No mock data — when the user has no decision
// workspace yet, it shows an honest "start a decision" state.

interface RawDNode {
  id: string;
  label?: string;
  title?: string;
  type?: string;
  color?: string;
  subtitle?: string;
  data?: Record<string, unknown>;
}
interface RawDEdge {
  from: string;
  to: string;
  rel?: string;
}
interface DecisionGraph {
  decision_type?: string;
  label?: string;
  question?: string;
  nodes?: RawDNode[];
  edges?: RawDEdge[];
  legend?: Record<string, string>;
  error?: string;
}

const COLOR_HEX: Record<string, string> = {
  GREEN: '#34d399',
  YELLOW: '#fbbf24',
  ORANGE: '#fb923c',
  RED: '#fb7185',
  BLUE: '#60a5fa',
  PURPLE: '#c084fc',
  SLATE: '#94a3b8',
  green: '#34d399',
  blue: '#60a5fa',
  purple: '#c084fc',
  red: '#fb7185',
  amber: '#fbbf24',
};

export default function DecisionDrilldown({
  decisionType,
  onClose,
}: {
  decisionType: string;
  onClose: () => void;
}) {
  const [graph, setGraph] = useState<DecisionGraph | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');

  useEffect(() => {
    let on = true;
    fetch('/api/decision/graph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision_type: decisionType }),
    })
      .then(async (r) => ({ ok: r.ok, body: (await r.json().catch(() => ({}))) as DecisionGraph }))
      .then(({ ok, body }) => {
        if (!on) return;
        if (ok && body.nodes && body.nodes.length > 0) {
          setGraph(body);
          setState('ready');
        } else {
          setState('empty');
        }
      })
      .catch(() => on && setState('error'));
    return () => {
      on = false;
    };
  }, [decisionType]);

  const grouped = group(graph?.nodes || []);

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[#070912]/95 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fuchsia-500/15 ring-1 ring-fuchsia-400/20">
            <GitBranch className="h-4 w-4 text-fuchsia-300" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">
              Decision drilldown
            </div>
            <div className="text-sm font-semibold text-white">
              {graph?.question || graph?.label || prettyType(decisionType)}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 ring-1 ring-white/5 hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {state === 'loading' && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-fuchsia-400" /> Loading the real decision
            lineage…
          </div>
        )}

        {state === 'error' && (
          <Empty
            icon={AlertCircle}
            title="Couldn't load this decision"
            body="The decision service didn't return a graph. Please try again."
          />
        )}

        {state === 'empty' && (
          <Empty
            icon={Sparkles}
            title="No decision built yet"
            body="This decision map is generated from your real data once you start a decision (e.g. a home purchase) in the Decision workspace. Nothing here is fabricated — the factors, weights, and scenarios appear only when your real inputs exist."
          />
        )}

        {state === 'ready' && graph && (
          <div className="mx-auto max-w-3xl space-y-6">
            {/* legend */}
            {graph.legend && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(graph.legend).map(([k, v]) => (
                  <span
                    key={k}
                    className="flex items-center gap-1.5 rounded-full bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300 ring-1 ring-white/5"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: COLOR_HEX[k] || '#94a3b8' }}
                    />
                    {v}
                  </span>
                ))}
              </div>
            )}

            {/* the real lineage, grouped by node role */}
            {grouped.map((g) => (
              <div key={g.role}>
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <g.icon className="h-3.5 w-3.5" style={{ color: g.color }} /> {g.role}
                  <span className="text-slate-600">· {g.nodes.length}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {g.nodes.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-lg border border-white/5 bg-white/[0.02] p-3"
                      style={{ borderLeft: `2px solid ${COLOR_HEX[n.color || ''] || g.color}` }}
                    >
                      <div className="text-[13px] font-medium text-slate-100">
                        {n.label || n.title || n.id}
                      </div>
                      {n.subtitle && (
                        <div className="mt-0.5 text-[11px] text-slate-500">{n.subtitle}</div>
                      )}
                      {n.data && (
                        <div className="mt-1.5 space-y-0.5">
                          {Object.entries(n.data)
                            .slice(0, 4)
                            .map(([k, v]) => (
                              <div key={k} className="flex justify-between text-[11px]">
                                <span className="text-slate-500">{k}</span>
                                <span className="text-slate-300">{String(v)}</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Empty({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/[0.03] ring-1 ring-white/5">
        <Icon className="h-6 w-6 text-fuchsia-300" />
      </div>
      <div className="text-base font-medium text-slate-200">{title}</div>
      <p className="max-w-md text-sm leading-relaxed text-slate-500">{body}</p>
    </div>
  );
}

function prettyType(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function group(nodes: RawDNode[]) {
  const roleOf = (n: RawDNode): { role: string; icon: LucideIcon; color: string } => {
    const t = (n.type || '').toLowerCase();
    if (t.includes('recommend'))
      return { role: 'Recommendations', icon: Sparkles, color: '#c084fc' };
    if (t.includes('evidence') || t.includes('finding'))
      return { role: 'Evidence & findings', icon: ShieldCheck, color: '#60a5fa' };
    if (t.includes('document')) return { role: 'Documents', icon: FileText, color: '#94a3b8' };
    if (t.includes('risk'))
      return { role: 'Risks & tradeoffs', icon: AlertCircle, color: '#fb7185' };
    return { role: 'Factors', icon: GitBranch, color: '#34d399' };
  };
  const map = new Map<
    string,
    { role: string; icon: LucideIcon; color: string; nodes: RawDNode[] }
  >();
  for (const n of nodes) {
    const r = roleOf(n);
    if (!map.has(r.role)) map.set(r.role, { ...r, nodes: [] });
    map.get(r.role)!.nodes.push(n);
  }
  const order = [
    'Recommendations',
    'Factors',
    'Evidence & findings',
    'Risks & tradeoffs',
    'Documents',
  ];
  return [...map.values()].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
}
