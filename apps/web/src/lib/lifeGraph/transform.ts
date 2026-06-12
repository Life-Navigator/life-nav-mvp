// Transform the REAL Core API life-graph + recommendations + scores into the LifeGraphData the 3D view
// renders. NO mock data — every node/link/source traces to a real persisted record. When the user has no
// data yet, the result is an honest empty graph (the page shows a connect/empty state, never fake nodes).

import type {
  LifeGraphData,
  LifeGraphNode,
  LifeGraphLink,
  LifeDomain,
  NodeType,
  GraphMetrics,
  GraphRecommendation,
} from '@/types/lifeGraph';

// The real personal_graph shape (apps/lifenavigator-core-api/app/services/life_discovery.py).
interface RawNode {
  id: string;
  type: string;
  label: string;
  color?: string;
  domain?: string | null;
  confidence?: number | null;
  source?: string;
  table?: string;
  record_id?: string;
  updated_at?: string;
}
interface RawEdge {
  from: string;
  to: string;
  rel?: string;
  confidence?: number | null;
}
export interface RawLifeGraph {
  nodes?: RawNode[];
  edges?: RawEdge[];
  graph_integrity?: { score?: number; overall?: number } | null;
  objective_count?: number;
  edge_count?: number;
}

interface RawRec {
  id: string;
  title: string;
  why?: string | null;
  description?: string | null;
  expected_impact?: Record<string, unknown> | string | null;
  quantified_impact?: Record<string, unknown> | null;
  confidence?: number | null;
  evidence?: string[] | null;
  impacted_domains?: string[] | null;
  source_module?: string | null;
  affected_goals?: string[] | null;
}

// Real node `type` / `color` / `domain` → our visual domain.
const TYPE_DOMAIN: Record<string, LifeDomain> = {
  'Life Vision': 'core',
  'Life Objective': 'core',
  Goal: 'goals',
  Dependency: 'stability',
  Risk: 'risk',
  Opportunity: 'opportunity',
  Constraint: 'risk',
  Dependent: 'family',
  Beneficiary: 'family',
  'Emergency Contact': 'family',
  'Trusted Advisor': 'family',
  Role: 'career',
  Skill: 'career',
  Certification: 'education',
  'Professional Goal': 'career',
  Program: 'education',
  School: 'education',
  'Learning Goal': 'education',
  'Health Goal': 'health',
  Supplement: 'health',
};
const DOMAIN_NORMALISE: Record<string, LifeDomain> = {
  family: 'family',
  career: 'career',
  education: 'education',
  health: 'health',
  finance: 'finance',
  financial: 'finance',
};
const COLOR_DOMAIN: Record<string, LifeDomain> = {
  purple: 'core',
  indigo: 'core',
  blue: 'career',
  amber: 'family',
  red: 'risk',
  green: 'opportunity',
  rose: 'risk',
};

function domainOf(n: RawNode): LifeDomain {
  if (n.domain && DOMAIN_NORMALISE[n.domain]) return DOMAIN_NORMALISE[n.domain];
  if (TYPE_DOMAIN[n.type]) return TYPE_DOMAIN[n.type];
  if (n.color && COLOR_DOMAIN[n.color]) return COLOR_DOMAIN[n.color];
  return 'core';
}

function nodeTypeOf(n: RawNode): NodeType {
  if (n.type === 'Life Vision') return 'root';
  if (n.type === 'Life Objective' || n.id.endsWith('_hub')) return 'cluster';
  if (n.type === 'Risk' || n.type === 'Constraint') return 'risk';
  if (n.type === 'Opportunity') return 'opportunity';
  if (n.type === 'Goal' || n.type.includes('Goal')) return 'goal';
  return 'metric';
}

const SOURCE_LABEL: Record<string, string> = {
  manual_entry: 'Manual Entry',
  plaid: 'Plaid',
  document: 'Document',
  onboarding: 'Onboarding',
};

export function transformLifeGraph(
  raw: RawLifeGraph,
  recs: RawRec[],
  readiness: number | null
): LifeGraphData {
  const rawNodes = raw.nodes || [];
  const rawEdges = raw.edges || [];

  // Synthetic root so the brain has a center even before a vision is set — but ONLY structural, derived
  // from the real readiness score; it carries no fabricated metrics.
  const hasVision = rawNodes.some((n) => n.type === 'Life Vision');
  const nodes: LifeGraphNode[] = [];
  if (!hasVision) {
    nodes.push({
      id: '__you__',
      label: 'Life Readiness',
      type: 'root',
      domain: 'core',
      score: readiness ?? undefined,
      importance: 1,
      confidence: readiness != null ? 1 : undefined,
      description: 'Your overall life readiness — the center of your knowledge graph.',
      nodeDepth: 0,
      childrenNodeIds: [],
    });
  }

  for (const n of rawNodes) {
    const domain = domainOf(n);
    const type = n.type === 'Life Vision' ? 'root' : nodeTypeOf(n);
    const importance =
      type === 'root'
        ? 1
        : type === 'cluster'
          ? 0.8
          : n.confidence != null
            ? 0.35 + n.confidence * 0.4
            : 0.45;
    nodes.push({
      id: n.id,
      label: n.label || n.type,
      type,
      domain,
      confidence: n.confidence ?? undefined,
      importance,
      score: type === 'root' ? (readiness ?? undefined) : undefined,
      description: `${n.type}${n.table ? ` · ${n.table}` : ''}`,
      sourceIds: n.source ? [(SOURCE_LABEL[n.source] || n.source) as never] : undefined,
      lastUpdated: n.updated_at,
      nodeDepth: type === 'root' ? 0 : type === 'cluster' ? 1 : 2,
      childrenNodeIds: [],
    });
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const rootId = hasVision ? rawNodes.find((n) => n.type === 'Life Vision')!.id : '__you__';

  const links: LifeGraphLink[] = [];
  for (const e of rawEdges) {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) continue;
    const tgt = nodes.find((n) => n.id === e.to);
    const strength = e.confidence ?? 0.6;
    links.push({
      source: e.from,
      target: e.to,
      strength,
      label: `${Math.round(strength * 100)}%`,
      domain: tgt?.domain || 'core',
      kind: e.rel === 'supports' ? 'influence' : e.rel === 'part_of' ? 'structural' : 'dependency',
    });
  }

  // Connect any orphan cluster/objective to the root so the brain reads as one organism (structural only).
  for (const n of nodes) {
    if (n.id === rootId) continue;
    if (n.nodeDepth === 1 && !links.some((l) => l.target === n.id || l.source === n.id)) {
      links.push({
        source: rootId,
        target: n.id,
        strength: 0.5,
        label: '',
        domain: n.domain,
        kind: 'structural',
      });
    }
  }
  // parent/children wiring for drilldown focus
  const childrenOf = new Map<string, string[]>();
  for (const l of links) {
    const src = typeof l.source === 'string' ? l.source : (l.source as { id: string }).id;
    const tgt = typeof l.target === 'string' ? l.target : (l.target as { id: string }).id;
    if (!childrenOf.has(src)) childrenOf.set(src, []);
    childrenOf.get(src)!.push(tgt);
    const child = nodes.find((n) => n.id === tgt);
    if (child && !child.parentNodeId) child.parentNodeId = src;
  }
  for (const n of nodes) n.childrenNodeIds = childrenOf.get(n.id) || [];

  const recommendations: GraphRecommendation[] = recs.map((r) => ({
    id: r.id,
    title: r.title,
    expectedImpact:
      typeof r.expected_impact === 'string'
        ? r.expected_impact
        : impactString(r.quantified_impact || (r.expected_impact as Record<string, unknown>) || {}),
    confidence: r.confidence ?? 0.5,
    dataDependencies: r.evidence || [],
    sourceDependencies: [],
    affectedGoals: r.affected_goals || r.impacted_domains || [],
    domain: (r.impacted_domains?.[0] as LifeDomain) || 'core',
  }));

  const verified = rawNodes.filter(
    (n) => n.source === 'plaid' || n.source === 'manual_entry'
  ).length;
  const metrics: GraphMetrics = {
    lifeReadiness: readiness ?? 0,
    networkDensity:
      nodes.length > 1 ? +(links.length / ((nodes.length * (nodes.length - 1)) / 2)).toFixed(3) : 0,
    strongestConnections: [...links]
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 5)
      .map((l) => ({
        from: labelFor(nodes, l.source),
        to: labelFor(nodes, l.target),
        strength: l.strength,
      })),
    updatesLast24h: rawNodes.filter((n) => isRecent(n.updated_at)).length,
    activity: [],
    nodeCount: nodes.length,
    linkCount: links.length,
    verifiedSourcePct: rawNodes.length ? +(verified / rawNodes.length).toFixed(2) : 0,
  };

  return { nodes, links, metrics, recommendations, sources: [] };
}

function impactString(qi: Record<string, unknown>): string {
  const d = qi.readiness_delta ?? qi.financial_impact_annual ?? null;
  if (qi.financial_impact_annual)
    return `+$${Number(qi.financial_impact_annual).toLocaleString()}/yr`;
  if (d != null) return `+${d} readiness`;
  return 'Improves readiness';
}
function labelFor(nodes: LifeGraphNode[], ref: string | { id: string }): string {
  const id = typeof ref === 'string' ? ref : ref.id;
  return nodes.find((n) => n.id === id)?.label || id;
}
function isRecent(iso?: string): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && Date.now() - t < 24 * 3600 * 1000;
}
