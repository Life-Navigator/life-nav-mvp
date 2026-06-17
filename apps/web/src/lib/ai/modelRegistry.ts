// Model registry — the single source of truth for which Vertex AI model ids exist, their capabilities,
// regions, and feature-flag gating. All ids are env-overridable and carry a DEFAULT that MUST be verified
// in Vertex AI Model Garden before production. No secrets here — only ids + capability metadata.

import type { ModelDescriptor, Provider } from './types';

// ── Feature flags (server env; NOT NEXT_PUBLIC — never resolve provider routes in the browser) ─────────
// AI_PROVIDER=vertex
// AI_DEFAULT_MODEL=gemini-3.5-flash
// AI_CHEAP_MODEL=gemini-2.5-flash-lite
// AI_REASONING_MODEL=gemini-2.5-pro
// AI_ENABLE_CLAUDE=false
// AI_ENABLE_CLAUDE_OPUS=false
// AI_CLAUDE_SONNET_MODEL=claude-sonnet-4-5
// AI_CLAUDE_OPUS_MODEL=claude-opus-4-1
// AI_VERTEX_LOCATION=us-central1
// AI_MODEL_ROUTER_ENABLED=true
const env = (k: string, d: string) => (typeof process !== 'undefined' && process.env?.[k]) || d;
const flag = (k: string, d = false) => {
  const v = typeof process !== 'undefined' ? process.env?.[k] : undefined;
  return v == null ? d : v === 'true' || v === '1';
};

export const aiConfig = {
  provider: env('AI_PROVIDER', 'vertex'),
  routerEnabled: flag('AI_MODEL_ROUTER_ENABLED', true),
  enableClaude: flag('AI_ENABLE_CLAUDE', false),
  enableClaudeOpus: flag('AI_ENABLE_CLAUDE_OPUS', false),
  vertexLocation: env('AI_VERTEX_LOCATION', 'us-central1'),
  // dev-only: include a short prompt preview in audit logs. Default off (no raw user content in logs).
  auditDevContent: flag('AI_AUDIT_DEV_CONTENT', false),
};

// Logical model keys (stable, decoupled from the verifiable Vertex id).
export type ModelKey =
  | 'gemini-default' // general / fallback
  | 'gemini-cheap' // high-volume classification
  | 'gemini-reasoning' // deep decision reasoning
  | 'claude-sonnet' // empathy / reports / critic
  | 'claude-opus'; // high-stakes review

// IMPORTANT — VERIFY EVERY ID IN VERTEX AI MODEL GARDEN BEFORE PRODUCTION.
//   • Gemini ids on Vertex are e.g. "gemini-2.5-pro", "gemini-2.5-flash-lite". "gemini-3.5-flash" is
//     listed by Google docs per this sprint — CONFIRM it is GA/available in AI_VERTEX_LOCATION; if not,
//     set AI_DEFAULT_MODEL=gemini-2.5-flash (the safe Gemini fallback) until it is.
//   • Claude on Vertex (Model Garden, publisher anthropic) uses versioned ids of the form
//     "claude-sonnet-4-5@<YYYYMMDD>" / "claude-opus-4-1@<YYYYMMDD>" and is region-limited (commonly
//     us-east5 / europe-west1, NOT every region). CONFIRM the exact id + region before enabling the flags.
//     The router automatically routes Claude to the first region in `regions` and falls back to Gemini
//     when Claude is disabled or unavailable.
export const MODEL_REGISTRY: Record<ModelKey, ModelDescriptor> = {
  'gemini-default': {
    key: 'gemini-default',
    provider: 'vertex-gemini',
    model: env('AI_DEFAULT_MODEL', 'gemini-3.5-flash'), // VERIFY in Model Garden
    costTier: 'standard',
    reasoning: 'standard',
    empathy: false,
    structured: true,
    regions: [aiConfig.vertexLocation, 'us-central1', 'global'],
  },
  'gemini-cheap': {
    key: 'gemini-cheap',
    provider: 'vertex-gemini',
    model: env('AI_CHEAP_MODEL', 'gemini-2.5-flash-lite'), // VERIFY
    costTier: 'cheap',
    reasoning: 'basic',
    empathy: false,
    structured: true,
    regions: [aiConfig.vertexLocation, 'us-central1', 'global'],
  },
  'gemini-reasoning': {
    key: 'gemini-reasoning',
    provider: 'vertex-gemini',
    model: env('AI_REASONING_MODEL', 'gemini-2.5-pro'), // VERIFY
    costTier: 'premium',
    reasoning: 'deep',
    empathy: false,
    structured: true,
    regions: [aiConfig.vertexLocation, 'us-central1', 'global'],
  },
  'claude-sonnet': {
    key: 'claude-sonnet',
    provider: 'vertex-claude',
    model: env('AI_CLAUDE_SONNET_MODEL', 'claude-sonnet-4-5'), // VERIFY exact "@version" + region
    costTier: 'premium',
    reasoning: 'deep',
    empathy: true,
    structured: true,
    flag: 'AI_ENABLE_CLAUDE',
    // Claude-on-Vertex regions vary — VERIFY. Defaults reflect commonly-available regions.
    regions: ['us-east5', 'europe-west1'],
  },
  'claude-opus': {
    key: 'claude-opus',
    provider: 'vertex-claude',
    model: env('AI_CLAUDE_OPUS_MODEL', 'claude-opus-4-1'), // VERIFY exact "@version" + region
    costTier: 'premium',
    reasoning: 'deep',
    empathy: true,
    structured: true,
    flag: 'AI_ENABLE_CLAUDE_OPUS',
    regions: ['us-east5', 'europe-west1'],
  },
};

/** Is a model usable right now given the feature flags? (Claude gated; Gemini always on for beta safety.) */
export function isModelEnabled(key: ModelKey): boolean {
  const d = MODEL_REGISTRY[key];
  if (!d.flag) return true; // Gemini — always available (default/fallback for beta)
  if (d.flag === 'AI_ENABLE_CLAUDE') return aiConfig.enableClaude;
  if (d.flag === 'AI_ENABLE_CLAUDE_OPUS') return aiConfig.enableClaudeOpus;
  return false;
}

/** Region check — used by fallback when a model isn't served in the requested location. */
export function isModelAvailableInRegion(key: ModelKey, region = aiConfig.vertexLocation): boolean {
  const d = MODEL_REGISTRY[key];
  return d.regions.includes(region) || d.regions.includes('global');
}

export function descriptor(key: ModelKey): ModelDescriptor {
  return MODEL_REGISTRY[key];
}

export function providerOf(key: ModelKey): Provider {
  return MODEL_REGISTRY[key].provider;
}
