'use client';

import type { LifeGraphEdge, LifeGraphNode, LifeGraphWorkspace } from '../types';

const provenanceLabel: Record<string, string> = {
  persisted_edge: 'Persisted edge',
  computed_connection: 'Computed connection',
  shared_node: 'Shared node',
};

interface Relationship {
  edge: LifeGraphEdge;
  otherLabel: string;
  direction: 'out' | 'in';
}

export function NodeDetailsPanel({
  node,
  workspace,
}: {
  node: LifeGraphNode | null;
  workspace: LifeGraphWorkspace | null;
}) {
  const relationships: Relationship[] = (() => {
    if (!node || !workspace) return [];
    const labelOf = (id: string) => workspace.nodes.find((n) => n.id === id)?.label ?? id;
    return workspace.edges
      .filter((e) => e.source === node.id || e.target === node.id)
      .map((edge) => {
        const out = edge.source === node.id;
        return {
          edge,
          direction: out ? ('out' as const) : ('in' as const),
          otherLabel: labelOf(out ? edge.target : edge.source),
        };
      });
  })();

  return (
    <aside className="w-[390px] overflow-y-auto border-l border-white/10 bg-slate-950/90 p-5 text-sm text-slate-200">
      {!node && (
        <div className="mt-16 text-center text-slate-500">
          Select a node to inspect its data, evidence, assumptions, and lineage.
        </div>
      )}

      {node && (
        <div className="space-y-5">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Node details</div>
            <h2 className="mt-2 text-xl font-semibold text-white">{node.label}</h2>
            <div className="mt-1 text-xs text-slate-400">
              {node.type} · {node.domain ?? 'general'}
            </div>
          </div>

          <Metric label="Score" value={node.score} />
          <Metric label="Confidence" value={toPct(node.confidence)} />
          <Metric label="Importance" value={toPct(node.importance)} />

          <Panel title="Why this matters">
            {node.description || node.xai?.reasoningSummary || 'No explanation recorded yet.'}
          </Panel>

          <Panel title="Relationships">
            {relationships.length ? (
              relationships.map(({ edge, otherLabel, direction }) => (
                <div key={edge.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {direction === 'out' ? '→ ' : '← '}
                      {otherLabel}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-500">
                      {provenanceLabel[edge.provenance ?? 'persisted_edge'] ?? edge.provenance}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {edge.type ?? edge.label ?? 'related'}
                    {edge.confidence != null && ` · ${toPct(edge.confidence)} confidence`}
                    {edge.strength != null && ` · weight ${edge.strength}`}
                  </div>
                  {edge.via && (
                    <div className="mt-1 text-[11px] text-slate-500">
                      via {edge.via}
                      {edge.citationId ? ` · citation ${edge.citationId}` : ''}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <Empty text="No relationship recorded." />
            )}
          </Panel>

          <Panel title="Impacted goals / domains">
            {node.impactedDomains?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {node.impactedDomains.map((d) => (
                  <span
                    key={d}
                    className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs capitalize text-slate-300"
                  >
                    {d}
                  </span>
                ))}
              </div>
            ) : (
              <Empty text="No relationship recorded." />
            )}
          </Panel>

          <Panel title="Data used">
            {node.dataUsed?.length ? (
              node.dataUsed.map((d) => (
                <div key={d.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="font-medium">{d.label}</div>
                  <div className="text-slate-400">{d.value ?? '—'}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {d.sourceTable ?? 'No source table'} ·{' '}
                    {toPct(d.confidence) ?? 'confidence unknown'}
                  </div>
                </div>
              ))
            ) : (
              <Empty text="No data points attached yet." />
            )}
          </Panel>

          <Panel title="Weighted factors">
            {node.xai?.weightedFactors?.length ? (
              node.xai.weightedFactors.map((f) => (
                <div key={f.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex justify-between">
                    <span className="font-medium">{f.label}</span>
                    <span>{Math.round(f.weight * 100)}%</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {f.impact} · {f.value ?? '—'} · {f.source ?? 'No source'}
                  </div>
                </div>
              ))
            ) : (
              <Empty text="No weighted factors recorded yet." />
            )}
          </Panel>

          <Panel title="Assumptions">
            {node.assumptions?.length ? (
              node.assumptions.map((a) => (
                <div key={a.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div>{a.label}</div>
                  <div className="text-slate-400">{a.value}</div>
                </div>
              ))
            ) : (
              <Empty text="No assumptions recorded." />
            )}
          </Panel>

          <Panel title="Missing data">
            {node.missingData?.length ? (
              node.missingData.map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"
                >
                  <div>{m.label}</div>
                  <div className="text-slate-400">{m.value ?? 'Needed to improve confidence.'}</div>
                </div>
              ))
            ) : (
              <Empty text="No missing-data analysis available." />
            )}
          </Panel>

          <Panel title="Formula">{node.xai?.formula || 'No formula recorded.'}</Panel>
        </div>
      )}
    </aside>
  );
}

function Metric({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium">{value ?? '—'}</span>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">{title}</div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-slate-500">{text}</div>
  );
}

function toPct(value?: number | null) {
  if (value == null) return null;
  return `${Math.round(value * 100)}%`;
}
