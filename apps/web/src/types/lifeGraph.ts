// Life Graph — explainable 3D knowledge-graph types. Designed to be replaced by GET /api/life-graph.
// Every node is built to answer: what is this · why it matters · what data created it · what source
// supports it · what recommendations depend on it · what decisions it affects.

export type LifeDomain =
  | 'core'
  | 'finance'
  | 'career'
  | 'health'
  | 'family'
  | 'education'
  | 'goals'
  | 'stability'
  | 'opportunity'
  | 'risk'
  | 'insurance'
  | 'behavioral'
  | 'decision';

export type NodeType =
  | 'root' // the "You" / Life Readiness center
  | 'cluster' // a domain cluster
  | 'score' // a computed score node (has a calculation)
  | 'metric' // a leaf datapoint
  | 'goal'
  | 'risk'
  | 'opportunity'
  | 'recommendation'
  | 'decision'; // a DecisionNode

export type SourceKind =
  | 'Plaid'
  | 'Manual Entry'
  | 'Document'
  | 'Onboarding'
  | 'Model'
  | 'Estimate'
  | 'Core API';
export type VerificationStatus = 'Verified' | 'Estimated' | 'Stale' | 'Unverified';
export type ImpactDirection = 'increase' | 'decrease' | 'neutral';

export interface DataSource {
  id: string;
  label: string;
  value: string; // human-formatted (e.g. "$542,000")
  source: SourceKind;
  status: VerificationStatus;
  lastUpdated: string; // ISO
  domain: LifeDomain;
}

export interface CalculationTerm {
  label: string;
  weight: number; // 0..1
  contribution?: number; // optional resolved points
}

export interface Adjustment {
  label: string;
  delta: number; // e.g. +0.05
  reason?: string;
}

export interface ScoreCalculation {
  formula: string; // human-readable formula string
  terms: CalculationTerm[];
  adjustments: Adjustment[];
  baseScore: number;
  finalScore: number;
}

export interface GraphRecommendation {
  id: string;
  title: string;
  expectedImpact: string;
  confidence: number; // 0..1
  dataDependencies: string[]; // DataSource ids
  sourceDependencies: SourceKind[];
  affectedGoals: string[]; // node ids / labels
  domain: LifeDomain;
}

export interface LineageStep {
  label: string;
  detail: string;
}

export interface LifeGraphNode {
  id: string;
  label: string;
  type: NodeType;
  domain: LifeDomain;
  score?: number; // 0..100
  confidence?: number; // 0..1
  importance?: number; // 0..1 — drives size + pulse
  description?: string;
  dataInputs?: string[]; // DataSource ids used
  sourceIds?: SourceKind[];
  recommendationIds?: string[];
  decisionIds?: string[];
  calculation?: ScoreCalculation;
  lineage?: LineageStep[];
  lastUpdated?: string;
  nodeDepth?: number; // 0 = root, 1 = cluster, 2 = leaf …
  parentNodeId?: string | null;
  childrenNodeIds?: string[];
  // render hints
  val?: number; // force-graph size
  color?: string;
}

export interface WeightedFactor {
  id: string;
  name: string;
  domain: LifeDomain;
  value: string;
  source: SourceKind | string;
  weight: number; // 0..1 (share of the model)
  impactDirection: ImpactDirection;
  impactExplanation: string;
  confidence: number; // 0..1
  lastUpdated: string;
}

export interface Scenario {
  id: string;
  label: string; // "15% down"
  downPaymentPercent: number;
  cashRemaining: number;
  monthlyPayment: number;
  pmi: number;
  emergencyFundMonths: number;
  portfolioImpact: number; // $ drawn from portfolio (negative = drawn down)
  insuranceImpact: string; // recommended adjustment
  riskScore: number; // 0..100 (higher = riskier)
  familySecurityScore: number; // 0..100
  retirementImpact: number; // $ long-run delta (signed)
  confidence: number; // 0..1
  pros: string[];
  cons: string[];
  recommended?: boolean;
}

export interface DecisionNode extends LifeGraphNode {
  type: 'decision';
  question: string;
  recommendation: {
    headline: string; // "Recommended down payment: 15%"
    rationale: string;
    confidence: number;
    riskLevel: 'Low' | 'Moderate' | 'Elevated' | 'High';
  };
  scenarios: Scenario[];
  weightedFactors: WeightedFactor[];
  tradeoffs: string[];
  assumptions: string[];
  sensitivityAnalysis: { factor: string; ifChanges: string; recommendationShifts: string }[];
  affectedGoals: string[];
  risks: string[];
  opportunities: string[];
  formula: ScoreCalculation; // the transparent scoring model
}

export interface LifeGraphLink {
  source: string;
  target: string;
  strength: number; // 0..1 weighted
  label?: string; // visible strength label
  domain: LifeDomain; // colors the link
  kind?: 'structural' | 'influence' | 'dependency';
}

export interface GraphMetrics {
  lifeReadiness: number; // 0..100
  networkDensity: number; // 0..1
  strongestConnections: { from: string; to: string; strength: number }[];
  updatesLast24h: number;
  activity: number[]; // mini-chart series
  nodeCount: number;
  linkCount: number;
  verifiedSourcePct: number; // 0..1
}

export interface LifeGraphData {
  nodes: LifeGraphNode[];
  links: LifeGraphLink[];
  metrics: GraphMetrics;
  recommendations: GraphRecommendation[];
  sources: DataSource[];
}

// Domain visual system — premium palette (not toy colors).
export const DOMAIN_META: Record<LifeDomain, { label: string; color: string; glow: string }> = {
  core: { label: 'Life Readiness', color: '#a78bfa', glow: '#c4b5fd' },
  finance: { label: 'Financial Health', color: '#34d399', glow: '#6ee7b7' },
  career: { label: 'Career Growth', color: '#60a5fa', glow: '#93c5fd' },
  health: { label: 'Health & Wellness', color: '#f472b6', glow: '#f9a8d4' },
  family: { label: 'Family & Relationships', color: '#fbbf24', glow: '#fcd34d' },
  education: { label: 'Education', color: '#22d3ee', glow: '#67e8f9' },
  goals: { label: 'Life Goals', color: '#818cf8', glow: '#a5b4fc' },
  stability: { label: 'Life Stability', color: '#2dd4bf', glow: '#5eead4' },
  opportunity: { label: 'Opportunities', color: '#a3e635', glow: '#bef264' },
  risk: { label: 'Risks', color: '#fb7185', glow: '#fda4af' },
  insurance: { label: 'Insurance & Estate', color: '#c084fc', glow: '#d8b4fe' },
  behavioral: { label: 'Behavioral', color: '#f59e0b', glow: '#fbbf24' },
  decision: { label: 'Decision', color: '#e879f9', glow: '#f0abfc' },
};
