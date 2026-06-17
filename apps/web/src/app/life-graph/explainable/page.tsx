'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { fetchLifeGraphWorkspace, queryLifeGraph } from '@/features/life-graph/lifeGraphApi';
import type { GraphView, LifeGraphNode, LifeGraphWorkspace } from '@/features/life-graph/types';
import {
  LifeGraphCanvas,
  type GraphCameraApi,
} from '@/features/life-graph/components/LifeGraphCanvas';
import { NodeDetailsPanel } from '@/features/life-graph/components/NodeDetailsPanel';
import { GraphSidebar } from '@/features/life-graph/components/GraphSidebar';
import { GraphStoryHeader } from '@/features/life-graph/components/GraphStoryHeader';
import { GraphAnalyticsStrip } from '@/features/life-graph/components/GraphAnalyticsStrip';
import { GraphBreadcrumbs, type Crumb } from '@/features/life-graph/components/GraphBreadcrumbs';

const SOURCE_VIEW = new Set(['source', 'evidence']);
const REC_VIEW = new Set(['recommendation', 'evidence', 'source']);

export default function LifeGraphExplainablePage() {
  const [workspace, setWorkspace] = useState<LifeGraphWorkspace | null>(null);
  const [selectedNode, setSelectedNode] = useState<LifeGraphNode | null>(null);
  const [nodeRelevance, setNodeRelevance] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<GraphView>('brain');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [trail, setTrail] = useState<Crumb[]>([]);
  const cameraApi = useRef<GraphCameraApi | null>(null);

  useEffect(() => {
    setMounted(true);
    fetchLifeGraphWorkspace()
      .then(setWorkspace)
      .catch((err) => setError(err.message));
  }, []);

  // View modes are real filters/layouts over the SAME API data — never inferred relationships.
  const visible = useMemo(() => {
    if (!workspace) return { nodes: [] as LifeGraphNode[], edges: workspace?.edges ?? [] };
    const all = workspace.nodes;
    let nodes = all;
    if (view === 'sources') nodes = all.filter((n) => SOURCE_VIEW.has(n.type));
    else if (view === 'recommendations') nodes = all.filter((n) => REC_VIEW.has(n.type));
    else if (view === 'network') {
      const connected = new Set<string>();
      workspace.edges.forEach((e) => {
        connected.add(e.source);
        connected.add(e.target);
      });
      nodes = all.filter((n) => connected.has(n.id));
    } else if (view === 'timeline') {
      const dated = all.filter((n) => n.lastUpdated);
      nodes = dated.length
        ? [...dated].sort((a, b) => (b.lastUpdated! > a.lastUpdated! ? 1 : -1))
        : all;
    }
    const ids = new Set(nodes.map((n) => n.id));
    const edges = workspace.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    return { nodes, edges };
  }, [workspace, view]);

  const counts = useMemo(
    () => ({
      recommendations: workspace?.nodes.filter((n) => n.type === 'recommendation').length ?? 0,
      sources: workspace?.nodes.filter((n) => n.type === 'source').length ?? 0,
    }),
    [workspace]
  );

  async function handleQuery() {
    if (!query.trim()) {
      setNodeRelevance({});
      return;
    }
    try {
      setNodeRelevance(await queryLifeGraph(query));
    } catch {
      setNodeRelevance({});
    }
  }

  function drill(node: LifeGraphNode) {
    setSelectedNode(node);
    setFocusedId(node.id);
    setTrail((prev) =>
      prev[prev.length - 1]?.id === node.id ? prev : [...prev, { id: node.id, label: node.label }]
    );
  }
  function jump(index: number) {
    const c = trail[index];
    if (!c) return;
    setTrail(trail.slice(0, index + 1));
    setFocusedId(c.id);
    setSelectedNode(workspace?.nodes.find((n) => n.id === c.id) ?? null);
  }
  function resetView() {
    setFocusedId(null);
    setTrail([]);
    setSelectedNode(null);
    setNodeRelevance({});
    setView('brain');
    cameraApi.current?.fit();
  }

  const hasGraph = !!workspace && workspace.nodes.length > 0;

  return (
    <main className="h-screen w-full overflow-hidden bg-[#020617] text-slate-100">
      <div className="flex h-full">
        <GraphSidebar view={view} onSetView={setView} counts={counts} />

        <section className="relative flex flex-1 flex-col">
          <header className="z-20 flex items-center justify-between border-b border-white/10 bg-slate-950/70 px-6 py-3 backdrop-blur">
            <div className="flex items-center gap-4">
              <div>
                <div className="font-semibold">Life Knowledge Graph</div>
                <div className="text-xs text-slate-400">
                  {workspace?.metrics?.totalNodes ?? workspace?.nodes.length ?? 0} nodes ·{' '}
                  {workspace?.metrics?.totalEdges ?? workspace?.edges.length ?? 0} connections
                </div>
              </div>
              <GraphBreadcrumbs trail={trail} onJump={jump} onBack={() => jump(trail.length - 2)} />
            </div>

            <div className="flex w-[420px] items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
                placeholder="Search goals, risks, recommendations..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
              />
            </div>
          </header>

          {hasGraph && <GraphStoryHeader workspace={workspace!} />}

          {hasGraph && (
            <GraphAnalyticsStrip
              workspace={workspace!}
              onZoomIn={() => cameraApi.current?.zoomIn()}
              onZoomOut={() => cameraApi.current?.zoomOut()}
              onFit={() => cameraApi.current?.fit()}
              onReset={resetView}
            />
          )}

          <div className="relative flex-1">
            {error && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                {error}
              </div>
            )}

            {!workspace && !error && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                Loading your Life Graph...
              </div>
            )}

            {workspace && workspace.nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                  <div className="text-lg font-semibold">Your life graph is still forming</div>
                  <p className="mt-2 text-sm text-slate-400">
                    As you talk to your advisor and connect your accounts, documents, and goals,
                    your real life model — and every cited connection between things — appears here.
                    Nothing here is ever fabricated.
                  </p>
                  <a
                    href="/dashboard/advisor"
                    className="mt-4 inline-flex items-center justify-center rounded-lg bg-indigo-500/90 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
                  >
                    Talk to your advisor
                  </a>
                </div>
              </div>
            )}

            {mounted && hasGraph && visible.nodes.length === 0 && (
              <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-slate-400">
                Nothing to show in this view yet.
              </div>
            )}

            {mounted && hasGraph && (
              <LifeGraphCanvas
                nodes={visible.nodes}
                edges={visible.edges}
                nodeRelevance={nodeRelevance}
                selectedNode={selectedNode}
                focusedId={focusedId}
                onSelectNode={setSelectedNode}
                onDrill={drill}
                apiRef={cameraApi}
              />
            )}
          </div>
        </section>

        <NodeDetailsPanel node={selectedNode} workspace={workspace} />
      </div>
    </main>
  );
}
