// LifeNavigator AI Model Router — shared types.
//
// SCOPE: this module is pure routing/decision logic + provider interfaces. It performs NO LLM calls and
// holds NO secrets. In this codebase the actual Vertex AI invocation happens on the Fly.io backend
// (GEMINI/GCP creds live there, never on Vercel — see memory: "Gemini key = Fly backend only"). The
// frontend resolves a ModelRoute and hands it to an internal API route, which the backend executes.

export type AgentKey =
  | 'router'
  | 'intent_classifier'
  | 'domain_classifier'
  | 'risk_classifier'
  | 'onboarding_advisor'
  | 'goal_extractor'
  | 'decision_engine'
  | 'scenario_lab'
  | 'recommendation_generator'
  | 'recommendation_critic'
  | 'explainability_builder'
  | 'graph_retrieval_planner'
  | 'graph_node_summarizer'
  | 'document_extractor'
  | 'document_classifier'
  | 'report_writer'
  | 'pdf_narrative_writer'
  | 'health_intake'
  | 'finance_explainer';

export type RiskLevel = 'low' | 'medium' | 'high' | 'regulated';
export type CostTier = 'cheap' | 'standard' | 'premium';
export type LatencyTier = 'realtime' | 'fast' | 'normal' | 'deep';

export type Provider = 'vertex-gemini' | 'vertex-claude';

export type Domain =
  | 'finance'
  | 'career'
  | 'education'
  | 'health'
  | 'family'
  | 'estate'
  | 'insurance'
  | 'graph'
  | 'general';

export interface ModelRouteRequest {
  agent: AgentKey;
  domain?: Domain;
  riskLevel?: RiskLevel;
  costTier?: CostTier;
  latencyTier?: LatencyTier;
  requiresEmpathy?: boolean;
  requiresDeepReasoning?: boolean;
  requiresStructuredOutput?: boolean;
  requiresCritic?: boolean;
}

export interface ProviderModel {
  provider: Provider;
  model: string;
}

export interface ModelRoute extends ProviderModel {
  fallbackModels: ProviderModel[];
  reason: string;
}

// ── Model registry entry ──────────────────────────────────────────────────
export interface ModelDescriptor extends ProviderModel {
  /** Logical key used internally (decoupled from the verifiable Vertex model id). */
  key: string;
  costTier: CostTier;
  /** Coarse capability flags used by the router's guard rails. */
  reasoning: 'basic' | 'standard' | 'deep';
  empathy: boolean;
  structured: boolean;
  /** Whether this model id is gated behind a feature flag (Claude). */
  flag?: 'AI_ENABLE_CLAUDE' | 'AI_ENABLE_CLAUDE_OPUS';
  /**
   * Vertex regions where this model is expected to be served. Claude on Vertex availability varies by
   * region and MUST be verified in Model Garden — see modelRegistry.ts.
   */
  regions: string[];
}

// ── Audit ───────────────────────────────────────────────────────────────
export interface AiAuditRecord {
  requestId: string;
  timestamp: string; // ISO
  userId?: string | null;
  agent: AgentKey;
  domain?: Domain;
  provider: Provider;
  model: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
  riskLevel: RiskLevel;
  latencyTier: LatencyTier;
  costTier: CostTier;
  promptVersion?: string;
  responseSchemaVersion?: string;
  // NEVER raw user content unless AI_AUDIT_DEV_CONTENT=true (dev only).
  promptPreview?: string;
}

// ── Decision Engine output contract (structured-first) ─────────────────────
export interface DecisionEngineOutput {
  decisionQuestion: string;
  recommendation: string;
  confidence: number;
  recommendedAction: string;
  reasoningSummary: string;
  weightedFactors: Array<{
    factor: string;
    domain: string;
    value: string;
    source: string;
    weight: number;
    impactDirection: 'positive' | 'negative' | 'neutral' | 'mixed';
    explanation: string;
    confidence: number;
  }>;
  scenarios: Array<{
    name: string;
    outcome: string;
    risks: string[];
    opportunities: string[];
    score: number;
  }>;
  missingData: string[];
  assumptions: string[];
  warnings: string[];
}
