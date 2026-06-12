'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Network, AlertCircle } from 'lucide-react';
import type { LifeGraphData, LifeGraphNode } from '@/types/lifeGraph';
import LifeGraphSidebar from '@/components/lifeGraph/LifeGraphSidebar';
import LifeGraph3D, { type LifeGraph3DHandle } from '@/components/lifeGraph/LifeGraph3D';
import LifeGraphNodePanel from '@/components/lifeGraph/LifeGraphNodePanel';
import LifeGraphExplainabilityPanel from '@/components/lifeGraph/LifeGraphExplainabilityPanel';
import LifeGraphAnalyticsStrip from '@/components/lifeGraph/LifeGraphAnalyticsStrip';
import DecisionBreadcrumbs, { type Crumb } from '@/components/lifeGraph/DecisionBreadcrumbs';

export default function LifeGraphPage() {
  const [data, setData] = useState<LifeGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LifeGraphNode | null>(null);
  const [trail, setTrail] = useState<Crumb[]>([{ id: '__root__', label: 'Life Graph' }]);
  const [focusIds, setFocusIds] = useState<Set<string> | null>(null);
  const graphRef = useRef<LifeGraph3DHandle | null>(null);

  useEffect(() => {
    let on = true;
    fetch('/api/life-graph', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: LifeGraphData) => {
        if (on) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (on) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      on = false;
    };
  }, []);

  // first + second degree neighborhood for drilldown focus
  const neighborhood = useCallback(
    (id: string): Set<string> => {
      const ids = new Set<string>([id]);
      if (!data) return ids;
      const ref = (l: { source: string | { id: string }; target: string | { id: string } }) => ({
        s: typeof l.source === 'string' ? l.source : l.source.id,
        t: typeof l.target === 'string' ? l.target : l.target.id,
      });
      for (let hop = 0; hop < 2; hop++) {
        const frontier = [...ids];
        for (const l of data.links) {
          const { s, t } = ref(l);
          if (frontier.includes(s)) ids.add(t);
          if (frontier.includes(t)) ids.add(s);
        }
      }
      return ids;
    },
    [data]
  );

  const onSelect = useCallback((n: LifeGraphNode) => setSelected(n), []);

  const onExpand = useCallback(
    (n: LifeGraphNode) => {
      setSelected(n);
      setFocusIds(neighborhood(n.id));
      setTrail((prev) => {
        if (prev[prev.length - 1]?.id === n.id) return prev;
        return [
          ...prev,
          { id: n.id, label: n.label.length > 28 ? n.label.slice(0, 27) + '…' : n.label },
        ];
      });
      graphRef.current?.focusNode(n.id);
    },
    [neighborhood]
  );

  const jumpTo = useCallback(
    (index: number) => {
      setTrail((prev) => prev.slice(0, index + 1));
      if (index === 0) {
        setFocusIds(null);
        graphRef.current?.resetView();
      } else {
        const crumb = trail[index];
        setFocusIds(neighborhood(crumb.id));
        graphRef.current?.focusNode(crumb.id);
      }
    },
    [trail, neighborhood]
  );

  const back = useCallback(() => jumpTo(Math.max(0, trail.length - 2)), [jumpTo, trail.length]);

  const readiness = data?.metrics.lifeReadiness ?? 0;

  if (loading) {
    return (
      <Shell>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
            <span className="text-sm">Assembling your life knowledge graph…</span>
          </div>
        </div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="flex max-w-sm flex-col items-center gap-3 text-center">
            <AlertCircle className="h-7 w-7 text-rose-400" />
            <div className="text-sm font-medium text-slate-200">Couldn&apos;t load your graph</div>
            <p className="text-xs text-slate-500">{error}. Please sign in and try again.</p>
          </div>
        </div>
      </Shell>
    );
  }

  const empty = !data || data.nodes.length === 0;

  return (
    <Shell>
      {/* Top stat bar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/5 bg-[#0a0c14]/70 px-5 backdrop-blur-xl">
        <DecisionBreadcrumbs trail={trail} onJump={jumpTo} onBack={back} />
        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Life Readiness</div>
            <div className="text-lg font-semibold leading-none text-white">
              {readiness ? Math.round(readiness) : '—'}
              <span className="ml-0.5 text-xs font-normal text-slate-500">/100</span>
            </div>
          </div>
          <div className="h-9 w-px bg-white/10" />
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Nodes</div>
            <div className="text-lg font-semibold leading-none text-white">
              {data?.metrics.nodeCount ?? 0}
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Central graph canvas */}
        <div className="relative min-w-0 flex-1">
          {empty ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-500/10 ring-1 ring-violet-400/20">
                <Network className="h-7 w-7 text-violet-300" />
              </div>
              <div className="text-base font-medium text-slate-200">
                Your graph is still forming
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-slate-500">
                As you talk to your advisor, connect accounts, and add data, your real life
                objectives, dependencies, and decisions appear here — each one fully explainable.
                Nothing here is fabricated.
              </p>
            </div>
          ) : (
            <LifeGraph3D
              ref={graphRef}
              nodes={data!.nodes}
              links={data!.links}
              focusIds={focusIds}
              selectedId={selected?.id ?? null}
              onSelect={onSelect}
              onExpand={onExpand}
            />
          )}
          {focusIds && (
            <button
              onClick={() => jumpTo(0)}
              className="absolute left-4 top-4 z-10 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-slate-200 ring-1 ring-white/10 backdrop-blur hover:bg-white/[0.12]"
            >
              ← Back to full brain
            </button>
          )}
        </div>

        {/* Right: node details */}
        <div className="hidden w-[300px] shrink-0 border-l border-white/5 bg-[#0a0c14]/60 backdrop-blur-xl xl:block">
          <LifeGraphNodePanel
            node={selected}
            links={data?.links ?? []}
            recommendations={data?.recommendations ?? []}
            onExpand={onExpand}
          />
        </div>

        {/* Far-right: explainability */}
        <div className="hidden w-[320px] shrink-0 border-l border-white/5 bg-[#080a11]/70 backdrop-blur-xl 2xl:block">
          <LifeGraphExplainabilityPanel
            node={selected}
            recommendations={data?.recommendations ?? []}
            sources={data?.sources ?? []}
          />
        </div>
      </div>

      {/* Bottom analytics strip */}
      {!empty && data && (
        <LifeGraphAnalyticsStrip
          metrics={data.metrics}
          onZoomIn={() => graphRef.current?.zoomBy(0.8)}
          onZoomOut={() => graphRef.current?.zoomBy(1.25)}
          onFit={() => graphRef.current?.zoomToFit()}
          onReset={() => {
            jumpTo(0);
            setSelected(null);
          }}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#05060d] text-slate-200">
      <LifeGraphSidebar active="Life Graph" />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
