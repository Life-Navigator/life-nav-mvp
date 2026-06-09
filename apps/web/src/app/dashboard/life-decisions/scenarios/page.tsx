'use client';

// Multi-Scenario Planning (Sprint 17) — chain decisions (Job + MBA + Move + Buy House) into a
// branching tree; each path shows readiness / net worth / retirement / confidence. Visual tree
// (depth = columns), connectors drawn from measured node positions. Projections, not guarantees.

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

type Status = 'green' | 'yellow' | 'orange' | 'red';
interface Outcome {
  readiness_index: number;
  readiness_status: Status;
  net_worth: number;
  retirement_ratio: number;
  confidence: number;
}
interface TNode {
  id: string;
  parent: string | null;
  depth: number;
  decision_type: string | null;
  option: string | null;
  label: string;
  is_leaf: boolean;
  outcome: Outcome;
}
interface Tree {
  decisions: string[];
  decision_labels: string[];
  nodes: TNode[];
  leaves: number;
  best_path_id: string | null;
  note: string;
}
interface Pick {
  decision_type: string;
  label: string;
  options: string[];
}

const SDOT: Record<Status, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  orange: 'bg-orange-500',
  red: 'bg-rose-500',
};
const money = (v: number) => `$${Math.round(v).toLocaleString()}`;

export default function ScenariosPage() {
  const [available, setAvailable] = useState<Pick[]>([]);
  const [chosen, setChosen] = useState<string[]>(['mba', 'new_job']);
  const [tree, setTree] = useState<Tree | null>(null);
  const [busy, setBusy] = useState(false);
  const [paths, setPaths] = useState<{ d: string; best: boolean }[]>([]);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    fetch('/api/decision/scenarios').then(async (r) =>
      r.ok ? setAvailable((await r.json()).decisions || []) : null
    );
  }, []);

  const build = useCallback(async (decisions: string[]) => {
    setBusy(true);
    try {
      const r = await fetch('/api/decision/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisions }),
      });
      if (r.ok) setTree(await r.json());
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    build(chosen);
  }, [chosen, build]);

  const toggle = (dt: string) =>
    setChosen((c) => (c.includes(dt) ? c.filter((x) => x !== dt) : c.length < 3 ? [...c, dt] : c));

  const recompute = useCallback(() => {
    if (!tree || !canvasRef.current) return;
    const base = canvasRef.current.getBoundingClientRect();
    const onBest = new Set<string>();
    if (tree.best_path_id) {
      let id: string | null = tree.best_path_id;
      const byId = Object.fromEntries(tree.nodes.map((n) => [n.id, n]));
      while (id) {
        onBest.add(id);
        id = byId[id]?.parent ?? null;
      }
    }
    const next: { d: string; best: boolean }[] = [];
    for (const n of tree.nodes) {
      if (!n.parent) continue;
      const a = nodeRefs.current[n.parent];
      const b = nodeRefs.current[n.id];
      if (!a || !b) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const x1 = ra.right - base.left,
        y1 = ra.top + ra.height / 2 - base.top;
      const x2 = rb.left - base.left,
        y2 = rb.top + rb.height / 2 - base.top;
      const mx = (x1 + x2) / 2;
      next.push({ d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, best: onBest.has(n.id) });
    }
    setPaths(next);
  }, [tree]);
  useLayoutEffect(() => {
    recompute();
  }, [tree, recompute]);
  useEffect(() => {
    const ro = new ResizeObserver(() => recompute());
    if (canvasRef.current) ro.observe(canvasRef.current);
    window.addEventListener('resize', recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, [recompute]);

  const depth = (d: number) => tree?.nodes.filter((n) => n.depth === d) ?? [];
  const maxDepth = tree ? Math.max(...tree.nodes.map((n) => n.depth)) : 0;

  return (
    <div className="px-4 py-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900">Multi-Scenario Planning</h1>
        <p className="text-sm text-gray-500 mt-1">
          Chain up to 3 decisions and compare every path — readiness, net worth, retirement,
          confidence.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400">Branch on:</span>
          {available.map((d) => (
            <button
              key={d.decision_type}
              onClick={() => toggle(d.decision_type)}
              disabled={busy || (!chosen.includes(d.decision_type) && chosen.length >= 3)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium ${chosen.includes(d.decision_type) ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-700 disabled:opacity-40'}`}
            >
              {d.label}
            </button>
          ))}
        </div>
        {busy && <div className="mt-6 text-gray-500">Branching your scenarios…</div>}
      </div>

      {tree && (
        <div className="mt-5 max-w-7xl mx-auto overflow-x-auto rounded-2xl border border-gray-100 bg-[radial-gradient(circle,#eef2ff_1px,transparent_1px)] [background-size:18px_18px] p-6">
          <div ref={canvasRef} className="relative" style={{ minWidth: 280 + maxDepth * 230 }}>
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: 0 }}
            >
              {paths.map((p, i) => (
                <path
                  key={i}
                  d={p.d}
                  stroke={p.best ? '#6366f1' : '#cbd5e1'}
                  strokeWidth={p.best ? 2.5 : 1.5}
                  fill="none"
                  opacity={p.best ? 0.9 : 0.5}
                />
              ))}
            </svg>
            <div className="relative flex gap-12" style={{ zIndex: 1 }}>
              {Array.from({ length: maxDepth + 1 }, (_, d) => (
                <div key={d} className="flex flex-col justify-center gap-4 min-w-[200px]">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {d === 0 ? 'Current State' : tree.decision_labels[d - 1]}
                  </div>
                  {depth(d).map((n) => {
                    const o = n.outcome;
                    const best = n.id === tree.best_path_id;
                    return (
                      <div
                        key={n.id}
                        ref={(el) => {
                          nodeRefs.current[n.id] = el;
                        }}
                        className={`rounded-xl bg-white shadow-sm p-3 ring-1 ${best ? 'ring-2 ring-indigo-400' : 'ring-gray-100'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${SDOT[o.readiness_status]}`}
                          />
                          <span className="text-sm font-semibold text-gray-800">{n.label}</span>
                          {best && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                              best
                            </span>
                          )}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
                          <span>Readiness</span>
                          <span className="text-right font-semibold text-gray-800">
                            {o.readiness_index}
                          </span>
                          <span>Net worth</span>
                          <span className="text-right font-semibold text-gray-800">
                            {money(o.net_worth)}
                          </span>
                          <span>Retirement</span>
                          <span className="text-right font-semibold text-gray-800">
                            {Math.round(o.retirement_ratio * 100)}%
                          </span>
                          <span>Confidence</span>
                          <span className="text-right font-semibold text-gray-800">
                            {Math.round(o.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">{tree.note}</p>
        </div>
      )}
    </div>
  );
}
