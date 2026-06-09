'use client';

// Decision Intelligence Graph (Sprint 15) — reasoning made visible. A clean, interactive
// mind-map: Documents → Analyses → Impacts → Tradeoffs/Risks → Recommendation → Readiness.
// Every node is clickable (opens a detail drawer); bezier connectors are drawn from measured
// node positions. Not Neo4j, not JSON — Miro/Figma-clean.

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

interface GNode {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  color: string;
  layer: number;
  detail: Record<string, unknown>;
}
interface GEdge {
  from: string;
  to: string;
}
interface Graph {
  label: string;
  question: string;
  layers: string[];
  nodes: GNode[];
  edges: GEdge[];
  legend: Record<string, string>;
}

const PRESETS = [
  ['new_job', 'New Job'],
  ['mba', 'MBA'],
  ['move', 'Move'],
  ['buy_house', 'Buy House'],
  ['retirement', 'Retirement'],
];
const C: Record<string, { dot: string; ring: string; edge: string }> = {
  green: { dot: 'bg-emerald-500', ring: 'ring-emerald-300', edge: '#10b981' },
  yellow: { dot: 'bg-amber-400', ring: 'ring-amber-300', edge: '#f59e0b' },
  orange: { dot: 'bg-orange-500', ring: 'ring-orange-300', edge: '#f97316' },
  red: { dot: 'bg-rose-500', ring: 'ring-rose-300', edge: '#f43f5e' },
  blue: { dot: 'bg-sky-500', ring: 'ring-sky-300', edge: '#0ea5e9' },
  purple: { dot: 'bg-violet-500', ring: 'ring-violet-300', edge: '#8b5cf6' },
  slate: { dot: 'bg-slate-400', ring: 'ring-slate-300', edge: '#94a3b8' },
};
const ICON: Record<string, string> = {
  document: '📄',
  analysis: '🧮',
  impact: '⚡',
  evidence: '🔎',
  assumption: '💭',
  tradeoff: '⚖️',
  risk: '⚠️',
  recommendation: '✅',
  readiness: '🧭',
  goal: '🎯',
};

export default function GraphPage() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [active, setActive] = useState('new_job');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<GNode | null>(null);
  const [paths, setPaths] = useState<{ d: string; color: string }[]>([]);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const load = useCallback(async (decision_type: string) => {
    setBusy(true);
    setSelected(null);
    setActive(decision_type);
    try {
      const r = await fetch('/api/decision/graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision_type }),
      });
      if (r.ok) setGraph(await r.json());
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load('new_job');
  }, [load]);

  const recompute = useCallback(() => {
    if (!graph || !canvasRef.current) return;
    const base = canvasRef.current.getBoundingClientRect();
    const colorOf: Record<string, string> = {};
    graph.nodes.forEach((n) => {
      colorOf[n.id] = n.color;
    });
    const next: { d: string; color: string }[] = [];
    for (const e of graph.edges) {
      const a = nodeRefs.current[e.from];
      const b = nodeRefs.current[e.to];
      if (!a || !b) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const x1 = ra.right - base.left,
        y1 = ra.top + ra.height / 2 - base.top;
      const x2 = rb.left - base.left,
        y2 = rb.top + rb.height / 2 - base.top;
      const mx = (x1 + x2) / 2;
      next.push({
        d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`,
        color: C[colorOf[e.from]]?.edge || '#cbd5e1',
      });
    }
    setPaths(next);
  }, [graph]);

  useLayoutEffect(() => {
    recompute();
  }, [graph, recompute]);
  useEffect(() => {
    const ro = new ResizeObserver(() => recompute());
    if (canvasRef.current) ro.observe(canvasRef.current);
    window.addEventListener('resize', recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, [recompute]);

  const byLayer = (l: number) => graph?.nodes.filter((n) => n.layer === l) ?? [];

  return (
    <div className="px-4 py-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900">Decision Intelligence Graph</h1>
        <p className="text-sm text-gray-500 mt-1">
          Your reasoning, made visible. Click any node to see the evidence behind it.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map(([v, l]) => (
            <button
              key={v}
              onClick={() => load(v)}
              disabled={busy}
              className={`px-3 py-1.5 rounded-full text-sm font-medium ${active === v ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-indigo-300'}`}
            >
              {l}
            </button>
          ))}
        </div>

        {busy && <div className="mt-8 text-gray-500">Drawing your reasoning graph…</div>}
      </div>

      {graph && (
        <div className="mt-5 flex gap-4 max-w-7xl mx-auto">
          {/* Canvas */}
          <div className="flex-1 overflow-x-auto rounded-2xl border border-gray-100 bg-[radial-gradient(circle,#eef2ff_1px,transparent_1px)] [background-size:18px_18px] p-6">
            <div ref={canvasRef} className="relative" style={{ minWidth: 1100 }}>
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ zIndex: 0 }}
              >
                {paths.map((p, i) => (
                  <path
                    key={i}
                    d={p.d}
                    stroke={p.color}
                    strokeWidth={2}
                    fill="none"
                    opacity={0.5}
                  />
                ))}
              </svg>
              <div className="relative flex gap-10" style={{ zIndex: 1 }}>
                {graph.layers.map((layerName, li) => (
                  <div key={li} className="flex flex-col gap-4 min-w-[150px]">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      {layerName}
                    </div>
                    {byLayer(li).map((n) => {
                      const c = C[n.color] || C.slate;
                      return (
                        <div
                          key={n.id}
                          ref={(el) => {
                            nodeRefs.current[n.id] = el;
                          }}
                          onClick={() => setSelected(n)}
                          className={`cursor-pointer rounded-xl bg-white shadow-sm hover:shadow-md transition p-3 ring-1 ring-gray-100 hover:ring-2 ${selected?.id === n.id ? `ring-2 ${c.ring}` : ''}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                            <span className="text-sm">{ICON[n.type] ?? '•'}</span>
                            <span className="text-sm font-semibold text-gray-800 leading-tight">
                              {n.title}
                            </span>
                          </div>
                          {n.subtitle && (
                            <div className="text-xs text-gray-400 mt-1 ml-5">{n.subtitle}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detail drawer */}
          <div className="w-80 shrink-0">
            <div className="sticky top-4 rounded-2xl border border-gray-100 bg-white shadow-sm p-5 min-h-[200px]">
              {selected ? (
                <>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-3 h-3 rounded-full ${(C[selected.color] || C.slate).dot}`}
                    />
                    <h3 className="font-semibold text-gray-900">
                      {ICON[selected.type]} {selected.title}
                    </h3>
                  </div>
                  <div className="text-xs uppercase tracking-wide text-gray-400 mt-1">
                    {selected.type}
                  </div>
                  <div className="mt-3 space-y-2 text-sm">{renderDetail(selected.detail)}</div>
                </>
              ) : (
                <div className="text-gray-400 text-sm">
                  Click a node to inspect the reasoning behind it.
                </div>
              )}
            </div>
            {/* Legend */}
            <div className="mt-3 rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
              <div className="text-xs font-semibold text-gray-500 mb-2">Legend</div>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(graph.legend).map(([color, label]) => (
                  <div key={color} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span className={`w-2.5 h-2.5 rounded-full ${(C[color] || C.slate).dot}`} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderDetail(detail: Record<string, unknown>): React.ReactNode {
  const entries = Object.entries(detail).filter(
    ([, v]) => v !== null && v !== undefined && v !== ''
  );
  if (entries.length === 0) return <div className="text-gray-400 text-xs">No further detail.</div>;
  return entries.map(([k, v]) => (
    <div key={k} className="border-b border-gray-50 pb-1.5">
      <div className="text-xs uppercase tracking-wide text-gray-400">{k.replace(/_/g, ' ')}</div>
      {Array.isArray(v) ? (
        <ul className="list-disc list-inside text-gray-700">
          {(v as unknown[]).map((x, i) => (
            <li key={i}>{typeof x === 'object' ? JSON.stringify(x) : String(x)}</li>
          ))}
        </ul>
      ) : typeof v === 'object' ? (
        <pre className="text-xs text-gray-600 whitespace-pre-wrap">
          {JSON.stringify(v, null, 1)}
        </pre>
      ) : (
        <div className="text-gray-800 font-medium">{String(v)}</div>
      )}
    </div>
  ));
}
