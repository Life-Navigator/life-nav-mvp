/**
 * ModelSelectionPolicy — Sprint O.0.2 Phase 8.
 *
 * Cost-aware routing. Every feature declares its TIER; the policy
 * resolves the tier to a concrete (provider, model) pair, defaulting
 * to the cheapest option in the tier.
 *
 *   TIER 1  — Gemini Flash (extraction, classification, tagging)
 *   TIER 2  — Gemini Pro / GPT-4o-mini (recommendation generation,
 *             decision intelligence)
 *   TIER 3  — operator-approved only (heavy multimodal reasoning)
 *
 * No expensive model is used by default. Tier 3 returns
 * `requires_operator_approval: true` and the caller must check it
 * before issuing the provider call.
 */

import type { ProviderId } from './cost-estimator';

export type ModelTier = 'tier_1' | 'tier_2' | 'tier_3';

export interface ResolvedModel {
  tier: ModelTier;
  provider: ProviderId;
  model: string;
  /** True for tier_3 — callers must consult `ops.feature_flags` for the
   *  explicit operator-approval flag before using the model. */
  requires_operator_approval: boolean;
}

export type FeatureKey =
  | 'extraction.classification'
  | 'extraction.vision_ocr'
  | 'extraction.speech_transcript'
  | 'extraction.video'
  | 'recommendation.optimizer'
  | 'recommendation.arcana'
  | 'recommendation.provider'
  | 'decision_intelligence'
  | 'simulation.narrative'
  | 'governance.constitutional_review'
  | 'tagging'
  | 'chat.user';

export const FEATURE_TIER: Record<FeatureKey, ModelTier> = {
  'extraction.classification': 'tier_1',
  'extraction.vision_ocr': 'tier_1',
  tagging: 'tier_1',
  'extraction.speech_transcript': 'tier_1',
  'extraction.video': 'tier_3',
  'recommendation.optimizer': 'tier_2',
  'recommendation.arcana': 'tier_2',
  'recommendation.provider': 'tier_2',
  decision_intelligence: 'tier_2',
  'simulation.narrative': 'tier_2',
  'governance.constitutional_review': 'tier_1',
  'chat.user': 'tier_2',
};

const TIER_DEFAULTS: Record<ModelTier, { provider: ProviderId; model: string }> = {
  tier_1: { provider: 'gemini', model: 'gemini-2.5-flash' },
  tier_2: { provider: 'gemini', model: 'gemini-2.5-pro' },
  tier_3: { provider: 'gemini', model: 'gemini-2.5-pro' },
};

export interface SelectModelInputs {
  feature: FeatureKey;
  /** Optional tenant override (resolved upstream from models.tenant_model_overrides). */
  tenant_override?: { provider: ProviderId; model: string };
  /** Used to reject tier-3 without operator approval. */
  operator_approved_features?: Set<string>;
}

export function selectModel(inputs: SelectModelInputs): ResolvedModel {
  const tier = FEATURE_TIER[inputs.feature];
  const defaults = TIER_DEFAULTS[tier];
  const override = inputs.tenant_override;
  const provider: ProviderId = override?.provider ?? defaults.provider;
  const model = override?.model ?? defaults.model;
  const requires_operator_approval =
    tier === 'tier_3' && !(inputs.operator_approved_features?.has(inputs.feature) ?? false);
  return { tier, provider, model, requires_operator_approval };
}

export const __test = { FEATURE_TIER, TIER_DEFAULTS };
