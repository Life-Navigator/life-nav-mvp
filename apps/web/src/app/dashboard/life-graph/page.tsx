'use client';

// Life Graph Foundation — the VISUAL + DATA architecture layer (not GraphRAG, no AI reasoning). Renders
// the user's Personal Life Graph (/api/life/graph → objectives + dependencies + life_graph_edges) as an
// interactive 3D graph: zoom/pan/rotate (built-in), node click → details panel, search, domain filter,
// and view modes. All data is existing domain data; nothing is fabricated.
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';

// react-force-graph-3d touches window/WebGL → client-only.
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

interface RawNode {
  id: string;
  type: string;
  label: string;
  color?: string;
  confidence?: number | null;
  domain?: string | null;
  source?: string | null;
  updated_at?: string | null;
}
interface GraphIntegrity {
  domains: Record<string, number>;
  overall: number;
}
interface RawEdge {
  from: string;
  to: string;
  rel: string;
  confidence?: number | null;
}
interface GraphPayload {
  nodes: RawNode[];
  edges: RawEdge[];
  graph_integrity?: GraphIntegrity;
}

type GNode = RawNode & { relationship_count: number; status: string };
type GLink = { source: string; target: string; rel: string; confidence?: number | null };

const TYPE_COLOR: Record<string, string> = {
  'Life Vision': '#a855f7',
  'Life Objective': '#6366f1',
  Goal: '#3b82f6',
  Dependency: '#f59e0b',
  Risk: '#ef4444',
  Opportunity: '#22c55e',
  Constraint: '#f43f5e',
};
const DOMAIN_COLOR: Record<string, string> = {
  finance: '#22c55e',
  career: '#3b82f6',
  health: '#ef4444',
  education: '#a855f7',
  family: '#f59e0b',
  core: '#6366f1',
  cross_domain: '#94a3b8',
};

type Mode = 'brain' | 'domain' | 'dependency';
const MODES: { key: Mode; label: string }[] = [
  { key: 'brain', label: 'Brain View' },
  { key: 'domain', label: 'Domain View' },
  { key: 'dependency', label: 'Dependency View' },
];

export default function LifeGraphPage() {
  const [payload, setPayload] = useState<GraphPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [mode, setMode] = useState<Mode>('brain');
  const [query, setQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [selected, setSelected] = useState<GNode | null>(null);
  const [integrity, setIntegrity] = useState<GraphIntegrity | null>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch('/api/life/graph', { cache: 'no-store' })
      .then(async (r) =>
        r.ok ? ((await r.json()) as GraphPayload) : Promise.reject(new Error('load'))
      )
      .then((d) => {
        setPayload({ nodes: d.nodes ?? [], edges: d.edges ?? [] });
        setIntegrity(d.graph_integrity ?? null);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const measure = () => {
      if (wrapRef.current)
        setDims({ w: wrapRef.current.clientWidth, h: wrapRef.current.clientHeight });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [loading]);

  // Enrich nodes with relationship_count + status (the node contract).
  const allNodes: GNode[] = useMemo(() => {
    if (!payload) return [];
    const counts: Record<string, number> = {};
    for (const e of payload.edges) {
      counts[e.from] = (counts[e.from] || 0) + 1;
      counts[e.to] = (counts[e.to] || 0) + 1;
    }
    return payload.nodes.map((n) => ({
      ...n,
      relationship_count: counts[n.id] || 0,
      status: 'active',
    }));
  }, [payload]);

  const domains = useMemo(
    () => Array.from(new Set(allNodes.map((n) => n.domain).filter(Boolean))) as string[],
    [allNodes]
  );

  // Apply mode + search + domain filter to produce the displayed graph.
  const graphData = useMemo(() => {
    let nodes = allNodes;
    if (mode === 'dependency') {
      nodes = nodes.filter(
        (n) => n.type === 'Dependency' || n.type === 'Life Objective' || n.type === 'Life Vision'
      );
    }
    if (domainFilter !== 'all') {
      nodes = nodes.filter(
        (n) => n.domain === domainFilter || n.type === 'Life Objective' || n.type === 'Life Vision'
      );
    }
    const q = query.trim().toLowerCase();
    if (q) nodes = nodes.filter((n) => (n.label || '').toLowerCase().includes(q));
    const ids = new Set(nodes.map((n) => n.id));
    const links: GLink[] = (payload?.edges ?? [])
      .filter((e) => ids.has(e.from) && ids.has(e.to))
      .map((e) => ({ source: e.from, target: e.to, rel: e.rel, confidence: e.confidence }));
    return { nodes, links };
  }, [allNodes, payload, mode, query, domainFilter]);

  const nodeColor = (n: GNode) =>
    mode === 'domain'
      ? DOMAIN_COLOR[n.domain || 'core'] || '#94a3b8'
      : TYPE_COLOR[n.type] || '#94a3b8';

  const connectedNames = (node: GNode): string[] => {
    if (!payload) return [];
    const byId = new Map(allNodes.map((n) => [n.id, n.label]));
    const out: string[] = [];
    for (const e of payload.edges) {
      if (e.from === node.id && byId.get(e.to)) out.push(`${e.rel} → ${byId.get(e.to)}`);
      else if (e.to === node.id && byId.get(e.from)) out.push(`${byId.get(e.from)} → ${e.rel}`);
    }
    return out.slice(0, 12);
  };

  return (
    <div className="flex h-full flex-col bg-gray-950 text-gray-100">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-800 px-5 py-3">
        <h1 className="text-lg font-bold">Life Graph</h1>
        <div className="flex gap-1 rounded-lg bg-gray-900 p-1">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`rounded-md px-3 py-1 text-sm ${mode === m.key ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search nodes…"
          className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm placeholder-gray-500"
        />
        {domains.length > 0 && (
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm"
          >
            <option value="all">All domains</option>
            {domains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
        {integrity && (
          <span className="text-xs text-gray-300">
            Graph Integrity{' '}
            <span className="font-semibold text-indigo-300">{integrity.overall}%</span>
          </span>
        )}
        <span className="ml-auto text-xs text-gray-400">
          {graphData.nodes.length} nodes · {graphData.links.length} relationships
        </span>
      </div>
      {integrity && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-gray-800 bg-gray-900/40 px-5 py-2 text-[11px] text-gray-400">
          <span className="font-semibold uppercase tracking-wide text-gray-500">Completeness</span>
          {Object.entries(integrity.domains).map(([d, pct]) => (
            <span key={d}>
              {d}: <span className="font-medium text-gray-200">{pct}%</span>
            </span>
          ))}
        </div>
      )}

      <div className="relative flex-1 overflow-hidden" ref={wrapRef}>
        {loading ? (
          <div className="flex h-full items-center justify-center text-gray-400">
            Building your Life Graph…
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-red-400">
            We couldn&apos;t load your Life Graph just now.
          </div>
        ) : allNodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-gray-400">
            <p className="text-base font-medium text-gray-200">
              Your Life Graph is just getting started.
            </p>
            <p className="max-w-md text-sm">
              As you complete advisor discovery and add data across your domains, your objectives,
              dependencies, and the relationships between them appear here.
            </p>
            <a
              href="/dashboard/advisor?onboarding=1"
              className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium"
            >
              Continue discovery →
            </a>
          </div>
        ) : (
          <ForceGraph3D
            graphData={graphData}
            width={dims.w}
            height={dims.h}
            backgroundColor="#0b0f1a"
            nodeLabel={(n: GNode) => `${n.label} · ${n.type}`}
            nodeColor={nodeColor as (n: object) => string}
            nodeVal={(n: GNode) => 1 + (n.relationship_count || 0)}
            linkColor={() => 'rgba(148,163,184,0.4)'}
            linkWidth={(l: GLink) => 0.5 + (l.confidence || 0.5)}
            linkDirectionalArrowLength={3}
            linkDirectionalArrowRelPos={1}
            onNodeClick={(n: object) => setSelected(n as GNode)}
          />
        )}

        {/* Node details panel */}
        {selected && (
          <div className="absolute right-4 top-4 max-h-[85%] w-80 overflow-auto rounded-xl border border-gray-800 bg-gray-900/95 p-4 shadow-xl backdrop-blur">
            <div className="mb-2 flex items-start justify-between">
              <h3 className="font-semibold text-white">{selected.label}</h3>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-500 hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <dl className="space-y-1.5 text-sm">
              <Row k="Type" v={selected.type} />
              {selected.domain && <Row k="Domain" v={selected.domain} />}
              {selected.source && <Row k="Source" v={selected.source} />}
              {selected.updated_at && (
                <Row k="Updated" v={String(selected.updated_at).slice(0, 10)} />
              )}
              <Row
                k="Confidence"
                v={
                  selected.confidence != null
                    ? `${Math.round(selected.confidence * 100)}%`
                    : 'Not yet scored'
                }
              />
              <Row k="Relationships" v={String(selected.relationship_count)} />
              <Row k="Status" v={selected.status} />
            </dl>
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Connected nodes
              </p>
              {connectedNames(selected).length ? (
                <ul className="space-y-0.5 text-xs text-gray-300">
                  {connectedNames(selected).map((c, i) => (
                    <li key={i}>• {c}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">
                  No connections yet — this node stands alone so far.
                </p>
              )}
            </div>
            <p className="mt-3 text-[11px] text-gray-500">
              This is your data lineage view — where readiness, recommendations, and advisor
              reasoning will eventually draw from. No AI scoring is applied here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-400">{k}</dt>
      <dd className="text-right text-gray-100">{v}</dd>
    </div>
  );
}
