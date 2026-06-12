'use client';

import { useEffect, useState } from 'react';
import { fetchLifeGraphWorkspace, queryLifeGraph } from '@/features/life-graph/lifeGraphApi';
import type { LifeGraphNode, LifeGraphWorkspace } from '@/features/life-graph/types';
import { LifeGraphCanvas } from '@/features/life-graph/components/LifeGraphCanvas';
import { NodeDetailsPanel } from '@/features/life-graph/components/NodeDetailsPanel';
import { Search } from 'lucide-react';

export default function LifeGraphExplainablePage() {
  const [workspace, setWorkspace] = useState<LifeGraphWorkspace | null>(null);
  const [selectedNode, setSelectedNode] = useState<LifeGraphNode | null>(null);
  const [nodeRelevance, setNodeRelevance] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchLifeGraphWorkspace()
      .then(setWorkspace)
      .catch((err) => setError(err.message));
  }, []);

  async function handleQuery() {
    if (!query.trim()) {
      setNodeRelevance({});
      return;
    }

    try {
      const relevance = await queryLifeGraph(query);
      setNodeRelevance(relevance);
    } catch {
      setNodeRelevance({});
    }
  }

  return (
    <main className="h-screen w-full overflow-hidden bg-[#020617] text-slate-100">
      <div className="flex h-full">
        <aside className="w-72 border-r border-white/10 bg-slate-950/80 p-4">
          <div className="text-xl font-semibold">Life Knowledge Graph</div>
          <div className="mt-1 text-xs text-slate-400">Explainable decision intelligence</div>

          <div className="mt-6 space-y-2 text-sm text-slate-300">
            <div>Overview</div>
            <div className="rounded-lg bg-blue-500/15 px-3 py-2 text-blue-300">Brain View</div>
            <div>Network View</div>
            <div>Timeline View</div>
            <div>Data Sources</div>
            <div>Recommendations</div>
            <div>Reports</div>
          </div>
        </aside>

        <section className="relative flex-1">
          <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between border-b border-white/10 bg-slate-950/70 px-6 py-3 backdrop-blur">
            <div>
              <div className="font-semibold">Life Knowledge Graph</div>
              <div className="text-xs text-slate-400">
                {workspace?.metrics?.totalNodes ?? workspace?.nodes.length ?? 0} nodes ·{' '}
                {workspace?.metrics?.totalEdges ?? workspace?.edges.length ?? 0} connections
              </div>
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
                <div className="text-lg font-semibold">No life graph built yet</div>
                <p className="mt-2 text-sm text-slate-400">
                  Add goals, documents, accounts, or recommendations to build your explainable life
                  model.
                </p>
              </div>
            </div>
          )}

          {mounted && workspace && workspace.nodes.length > 0 && (
            <LifeGraphCanvas
              nodes={workspace.nodes}
              edges={workspace.edges}
              nodeRelevance={nodeRelevance}
              selectedNode={selectedNode}
              onSelectNode={setSelectedNode}
            />
          )}
        </section>

        <NodeDetailsPanel node={selectedNode} workspace={workspace} />
      </div>
    </main>
  );
}
