/**
 * Recommendation Builder Service (Sprint J, Phase 4 + 8).
 *
 * Wraps the existing recommendation lifecycle so the provider portal
 * can:
 *
 *   1. Validate a draft.
 *   2. Persist via the Sprint I `issueRecommendation`.
 *   3. Hand back the XAI bundle the UI shows alongside the recommendation
 *      — built from the SAME Sprint E primitives: WhyChain,
 *      EvidenceGraph, AssumptionEngine, CounterfactualEngine.
 *
 * Pure-logic exports return shape; the API route handles persistence.
 */

import { __test as assumptionTest } from '@/lib/decision/assumption-engine';
import type { RecommendationDraft, RecommendationXAIBundle } from '@/types/provider-portal';

const { classifySeverity: classifyAssumptionSeverity } = assumptionTest;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface DraftValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateDraft(draft: RecommendationDraft): DraftValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!draft.engagement_id) errors.push('engagement_id required');
  if (!draft.patient_user_id) errors.push('patient_user_id required');
  if (!draft.title || draft.title.length < 4) errors.push('title too short');
  if (!draft.body || draft.body.length < 12) errors.push('body too short');
  if (!draft.rationale || draft.rationale.length < 8) warnings.push('rationale recommended');
  if (!draft.citations.length)
    warnings.push('no citations attached — XAI confidence will be capped');
  if (
    draft.expected_strength != null &&
    (draft.expected_strength < 0 || draft.expected_strength > 1)
  ) {
    errors.push('expected_strength must be in [0,1]');
  }
  if (draft.expected_horizon_months != null && draft.expected_horizon_months <= 0) {
    errors.push('expected_horizon_months must be positive');
  }
  if (draft.title && draft.title.length > 160) warnings.push('title is long — consider trimming');
  if (draft.body && draft.body.length > 4000) errors.push('body exceeds 4000 chars');
  return { ok: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// XAI bundle — composed deterministically from draft + citations
// ---------------------------------------------------------------------------

function buildWhyChain(
  draft: RecommendationDraft,
  recommendation_id: string
): RecommendationXAIBundle['why_chain'] {
  const steps: RecommendationXAIBundle['why_chain']['steps'] = [];
  // Step 0: the recommendation itself.
  steps.push({
    depth: 0,
    claim: draft.title,
    evidence_refs: draft.citations
      .map((c) => c.citation_reference ?? c.label)
      .filter(Boolean) as string[],
  });
  // Step 1: rationale.
  if (draft.rationale) {
    steps.push({
      depth: 1,
      claim: draft.rationale,
      evidence_refs: draft.citations
        .map((c) => c.citation_reference ?? c.label)
        .filter(Boolean) as string[],
    });
  }
  // Step 2+: assumptions (each becomes a leaf).
  draft.assumptions.forEach((a, i) => {
    steps.push({
      depth: 2 + i,
      claim: `assumes: ${a}`,
      evidence_refs: [],
    });
  });
  return {
    target_kind: 'provider_recommendation',
    target_id: recommendation_id,
    steps,
    computed_at: '1970-01-01T00:00:00.000Z',
  };
}

function buildAssumptions(draft: RecommendationDraft): RecommendationXAIBundle['assumptions'] {
  return draft.assumptions.map((text) => ({
    text,
    severity: classifyAssumptionSeverity(text),
  }));
}

function buildCounterfactuals(
  draft: RecommendationDraft
): RecommendationXAIBundle['counterfactuals'] {
  // Two stock perturbations are always meaningful in the provider
  // context:
  //   1. "What if the patient does the opposite?" — flips the expected sign.
  //   2. "What if expected_strength were 0.5 less?" — surfaces sensitivity.
  const out: RecommendationXAIBundle['counterfactuals'] = [];
  out.push({
    perturbation: `patient skips: ${draft.title}`,
    expected_change: 'expected outcome reduced to baseline; gap re-opens by the rec strength',
  });
  if (typeof draft.expected_strength === 'number') {
    out.push({
      perturbation: `expected_strength drops by 0.5 (e.g. partial adherence)`,
      expected_change: `outcome shifts ~${(draft.expected_strength * 0.5).toFixed(2)} units toward baseline`,
    });
  }
  for (const r of draft.risks) {
    out.push({
      perturbation: `risk materializes: ${r}`,
      expected_change: 'plan likely requires revision; provider should re-assess at next review',
    });
  }
  return out;
}

function buildTradeoffs(draft: RecommendationDraft): RecommendationXAIBundle['tradeoffs'] {
  // Tradeoffs are domain-stock in the absence of structured fields; we
  // surface them as "what is the patient giving up vs gaining". The
  // provider UI can edit before persisting.
  const t: RecommendationXAIBundle['tradeoffs'] = [];
  if (draft.expected_horizon_months && draft.expected_horizon_months >= 6) {
    t.push({
      summary: 'short-term effort vs long-horizon payoff',
      gives_up: 'discretionary time + immediate ease',
      gains: `expected outcome at ${draft.expected_horizon_months} months`,
    });
  }
  if (draft.risks.length > 0) {
    t.push({
      summary: 'expected outcome vs surfaced risks',
      gives_up: 'risk-free coast',
      gains: 'meaningful progress with managed risk',
    });
  }
  if (t.length === 0) {
    t.push({
      summary: 'effort vs status quo',
      gives_up: 'doing nothing',
      gains: 'momentum',
    });
  }
  return t;
}

function clampConfidence(draft: RecommendationDraft): number {
  let c = 0.5;
  if (typeof draft.expected_strength === 'number') c = (c + draft.expected_strength) / 2;
  if (draft.citations.length === 0) c = Math.min(c, 0.5);
  if (draft.citations.length >= 2) c = Math.min(0.9, c + 0.1);
  if (draft.assumptions.length >= 3) c = Math.max(0.3, c - 0.1);
  return Number(c.toFixed(2));
}

export function buildXAIBundle(
  draft: RecommendationDraft,
  recommendation_id: string
): RecommendationXAIBundle {
  return {
    why_chain: buildWhyChain(draft, recommendation_id),
    evidence_links: draft.citations,
    assumptions: buildAssumptions(draft),
    counterfactuals: buildCounterfactuals(draft),
    tradeoffs: buildTradeoffs(draft),
    confidence: clampConfidence(draft),
  };
}

export const __test = {
  validateDraft,
  buildXAIBundle,
  buildWhyChain,
  buildAssumptions,
  buildCounterfactuals,
  buildTradeoffs,
  clampConfidence,
};
