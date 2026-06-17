// Per-agent routing profiles. Each agent maps to a LOGICAL model key (resolved to a verifiable Vertex id
// in modelRegistry.ts) plus a beta-safe fallback chain and risk/empathy metadata.

import type { AgentKey } from './types';
import type { ModelKey } from './modelRegistry';

// The spec's routing table, expressed with the VERIFIABLE model strings (for reference + tests). The
// router resolves these via logical keys so ids can be swapped through env without touching code.
export const AGENT_MODEL_ROUTES: Record<AgentKey, string> = {
  router: 'gemini-2.5-flash-lite',
  intent_classifier: 'gemini-2.5-flash-lite',
  domain_classifier: 'gemini-2.5-flash-lite',
  risk_classifier: 'gemini-2.5-flash-lite',

  onboarding_advisor: 'claude-sonnet-4-5',
  goal_extractor: 'gemini-3.5-flash',

  decision_engine: 'gemini-2.5-pro',
  scenario_lab: 'gemini-2.5-pro',
  recommendation_generator: 'gemini-2.5-pro',

  recommendation_critic: 'claude-sonnet-4-5',
  explainability_builder: 'gemini-3.5-flash',

  graph_retrieval_planner: 'gemini-3.5-flash',
  graph_node_summarizer: 'gemini-2.5-flash-lite',

  document_extractor: 'gemini-3.5-flash',
  document_classifier: 'gemini-2.5-flash-lite',

  report_writer: 'claude-sonnet-4-5',
  pdf_narrative_writer: 'claude-sonnet-4-5',

  health_intake: 'claude-sonnet-4-5',
  finance_explainer: 'gemini-3.5-flash',
};

export interface AgentProfile {
  primary: ModelKey;
  /** Ordered logical fallback chain; the router guarantees a Gemini tail (beta safety). */
  fallbacks: ModelKey[];
  /** Minimum reasoning tier when riskLevel is high/regulated (guards against cheap models on big calls). */
  riskFloor: 'basic' | 'standard' | 'deep';
  empathy?: boolean;
  /** finance_explainer: explains numbers; NEVER computes them (deterministic code owns math). */
  explanationOnly?: boolean;
  promptKey?: string;
}

const cheap = (): AgentProfile => ({
  primary: 'gemini-cheap',
  fallbacks: ['gemini-default'],
  riskFloor: 'standard',
});
const std = (): AgentProfile => ({
  primary: 'gemini-default',
  fallbacks: ['gemini-cheap'],
  riskFloor: 'standard',
});
const reasoning = (): AgentProfile => ({
  primary: 'gemini-reasoning',
  fallbacks: ['gemini-default'],
  riskFloor: 'deep',
});

export const AGENT_PROFILES: Record<AgentKey, AgentProfile> = {
  // Cheap, high-volume classification/labels — never used for high-stakes reasoning.
  router: cheap(),
  intent_classifier: cheap(),
  domain_classifier: cheap(),
  risk_classifier: cheap(),
  graph_node_summarizer: cheap(),
  document_classifier: cheap(),

  // Standard Gemini default.
  goal_extractor: { ...std(), promptKey: 'goal_extractor' },
  explainability_builder: { ...std(), promptKey: 'explainability_builder' },
  graph_retrieval_planner: std(),
  document_extractor: std(),
  finance_explainer: { ...std(), explanationOnly: true, promptKey: undefined },

  // Deep reasoning (major decisions / scenarios / recommendations).
  decision_engine: { ...reasoning(), promptKey: 'decision_engine' },
  scenario_lab: reasoning(),
  recommendation_generator: { ...reasoning(), promptKey: 'recommendation_generator' },

  // Empathy / discovery → Claude Sonnet, Gemini-default fallback.
  onboarding_advisor: {
    primary: 'claude-sonnet',
    fallbacks: ['gemini-default'],
    riskFloor: 'standard',
    empathy: true,
    promptKey: 'onboarding_advisor',
  },
  health_intake: {
    primary: 'claude-sonnet',
    fallbacks: ['gemini-default'],
    riskFloor: 'standard',
    empathy: true,
  },

  // High-stakes review / polished narrative → Claude Sonnet; critic falls back to deep Gemini reasoning.
  recommendation_critic: {
    primary: 'claude-sonnet',
    fallbacks: ['gemini-reasoning'],
    riskFloor: 'deep',
    promptKey: 'recommendation_critic',
  },
  report_writer: {
    primary: 'claude-sonnet',
    fallbacks: ['gemini-default'],
    riskFloor: 'standard',
    promptKey: 'report_writer',
  },
  pdf_narrative_writer: {
    primary: 'claude-sonnet',
    fallbacks: ['gemini-default'],
    riskFloor: 'standard',
  },
};

/** Hard rule: core financial math is NEVER performed by an LLM. Deterministic code → validation → LLM
 *  explanation only. Guards the router against routing a calculation to a model. */
export const FINANCE_MATH_USES_LLM = false;
