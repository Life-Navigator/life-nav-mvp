export type GraphNodeType =
  | 'person'
  | 'domain'
  | 'goal'
  | 'risk'
  | 'opportunity'
  | 'recommendation'
  | 'evidence'
  | 'source'
  | 'assumption'
  | 'calculation'
  | 'decision';

export type GraphDomain =
  | 'finance'
  | 'career'
  | 'education'
  | 'health'
  | 'family'
  | 'estate'
  | 'insurance'
  | 'general';

/**
 * Where a visible edge comes from. The graph obeys the same trust rule as the advisor:
 * no cited edge = no visible relationship. Every edge declares one of these.
 */
export type EdgeProvenance = 'persisted_edge' | 'computed_connection' | 'shared_node';

/**
 * View modes — all are real filters/layouts over the SAME API-provided graph (never inferred data).
 *  brain: full 3D graph · network: full graph, fit camera · timeline: nodes with a timestamp, recent-first
 *  sources: source + evidence lineage only · recommendations: recommendation + evidence + source only
 */
export type GraphView = 'brain' | 'network' | 'timeline' | 'sources' | 'recommendations';

export interface LifeGraphDataPoint {
  id: string;
  label: string;
  value?: string | number | null;
  sourceTable?: string | null;
  sourceId?: string | null;
  confidence?: number | null;
  lastUpdated?: string | null;
}

export interface LifeGraphAssumption {
  id: string;
  label: string;
  value: string;
  confidence?: number | null;
}

export interface LifeGraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  domain?: GraphDomain;
  score?: number | null;
  confidence?: number | null;
  importance?: number | null;
  description?: string | null;
  dataUsed?: LifeGraphDataPoint[];
  assumptions?: LifeGraphAssumption[];
  missingData?: LifeGraphDataPoint[];
  evidenceIds?: string[];
  recommendationIds?: string[];
  sourceIds?: string[];
  goalIds?: string[];
  /** Domains a recommendation declares it impacts (real field from RecommendationOS). */
  impactedDomains?: string[];
  lastUpdated?: string | null;
  xai?: {
    formula?: string | null;
    reasoningSummary?: string | null;
    weightedFactors?: Array<{
      id: string;
      label: string;
      value?: string | number | null;
      weight: number;
      impact: 'positive' | 'negative' | 'neutral' | 'mixed';
      confidence?: number | null;
      source?: string | null;
    }>;
  };
}

export interface LifeGraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string | null;
  type?: string | null;
  strength?: number | null;
  confidence?: number | null;
  /** Trust provenance — every drawn edge is backed by a real persisted edge or a real computed connection. */
  provenance?: EdgeProvenance | null;
  /** Human label of the shared node a computed connection passes through (citation). */
  via?: string | null;
  /** Node id of the shared node / citation, if this edge is a computed connection. */
  viaId?: string | null;
  /** Citation/evidence id backing this relationship, if available. */
  citationId?: string | null;
  evidenceIds?: string[];
}

export interface LifeGraphWorkspace {
  nodes: LifeGraphNode[];
  edges: LifeGraphEdge[];
  metrics?: {
    totalNodes?: number;
    totalEdges?: number;
    avgConfidence?: number | null;
    avgStrength?: number | null;
    lastUpdated?: string | null;
  };
}
