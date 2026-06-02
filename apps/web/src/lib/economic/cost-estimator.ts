/**
 * CostEstimator — Sprint O.0.2 Phase 5.
 *
 * Pure deterministic cost projection. Every provider call should
 * estimate cost BEFORE execution so the BudgetManager can throttle
 * or reject when the projection would exceed user / tenant /
 * platform caps.
 *
 * The estimator uses published vendor rates (vendor-specific cost
 * tables co-located in `RATE_TABLE`). Rates are micro-USD per unit
 * (token, image, minute, etc.). All output is integer micro-USD.
 *
 * The estimator NEVER hits the network. It is suitable for both
 * pre-call gating and offline beta-cost simulation.
 */

import type { CostDimension } from './types';
import { MICROS_PER_USD } from './types';

export type ProviderId = 'gemini' | 'openai' | 'anthropic' | 'azure_openai' | 'local' | 'other';

interface UnitRate {
  /** micro-USD per (1000 tokens | 1 image | 1 minute | etc.). */
  per_unit_micros: number;
  /** Reference unit denominator — most LLM token rates are per 1000 tokens. */
  per_units: number;
}

/**
 * RATE_TABLE — published rates (Q1 2026). The hardcoded numbers are
 * conservative ceilings; they exist in code so a vendor pricing change
 * is a single-file diff with a self-contained test update.
 */
const RATE_TABLE: Record<ProviderId, Partial<Record<string, Record<CostDimension, UnitRate>>>> = {
  gemini: {
    'gemini-2.5-flash': {
      text_input: { per_unit_micros: 75, per_units: 1000 },
      text_output: { per_unit_micros: 300, per_units: 1000 },
      embedding: { per_unit_micros: 25, per_units: 1000 },
      vision_image: { per_unit_micros: 150, per_units: 1 },
      speech_minute: { per_unit_micros: 0, per_units: 1 },
      video_minute: { per_unit_micros: 0, per_units: 1 },
      storage_gb_month: { per_unit_micros: 0, per_units: 1 },
      tool_call: { per_unit_micros: 0, per_units: 1 },
      other: { per_unit_micros: 0, per_units: 1 },
    },
    'gemini-2.5-pro': {
      text_input: { per_unit_micros: 1250, per_units: 1000 },
      text_output: { per_unit_micros: 5000, per_units: 1000 },
      embedding: { per_unit_micros: 100, per_units: 1000 },
      vision_image: { per_unit_micros: 2500, per_units: 1 },
      speech_minute: { per_unit_micros: 0, per_units: 1 },
      video_minute: { per_unit_micros: 100_000, per_units: 1 }, // $0.10/min
      storage_gb_month: { per_unit_micros: 0, per_units: 1 },
      tool_call: { per_unit_micros: 0, per_units: 1 },
      other: { per_unit_micros: 0, per_units: 1 },
    },
  },
  openai: {
    'gpt-4o-mini': {
      text_input: { per_unit_micros: 150, per_units: 1000 },
      text_output: { per_unit_micros: 600, per_units: 1000 },
      embedding: { per_unit_micros: 20, per_units: 1000 },
      vision_image: { per_unit_micros: 300, per_units: 1 },
      speech_minute: { per_unit_micros: 6000, per_units: 1 }, // Whisper $0.006/min
      video_minute: { per_unit_micros: 0, per_units: 1 },
      storage_gb_month: { per_unit_micros: 0, per_units: 1 },
      tool_call: { per_unit_micros: 0, per_units: 1 },
      other: { per_unit_micros: 0, per_units: 1 },
    },
    'gpt-4o': {
      text_input: { per_unit_micros: 2500, per_units: 1000 },
      text_output: { per_unit_micros: 10_000, per_units: 1000 },
      embedding: { per_unit_micros: 130, per_units: 1000 },
      vision_image: { per_unit_micros: 5100, per_units: 1 },
      speech_minute: { per_unit_micros: 6000, per_units: 1 },
      video_minute: { per_unit_micros: 0, per_units: 1 },
      storage_gb_month: { per_unit_micros: 0, per_units: 1 },
      tool_call: { per_unit_micros: 0, per_units: 1 },
      other: { per_unit_micros: 0, per_units: 1 },
    },
  },
  anthropic: {
    'claude-3-5-haiku': {
      text_input: { per_unit_micros: 800, per_units: 1000 },
      text_output: { per_unit_micros: 4000, per_units: 1000 },
      embedding: { per_unit_micros: 0, per_units: 1000 },
      vision_image: { per_unit_micros: 800, per_units: 1 },
      speech_minute: { per_unit_micros: 0, per_units: 1 },
      video_minute: { per_unit_micros: 0, per_units: 1 },
      storage_gb_month: { per_unit_micros: 0, per_units: 1 },
      tool_call: { per_unit_micros: 0, per_units: 1 },
      other: { per_unit_micros: 0, per_units: 1 },
    },
    'claude-3-5-sonnet': {
      text_input: { per_unit_micros: 3000, per_units: 1000 },
      text_output: { per_unit_micros: 15_000, per_units: 1000 },
      embedding: { per_unit_micros: 0, per_units: 1000 },
      vision_image: { per_unit_micros: 6800, per_units: 1 },
      speech_minute: { per_unit_micros: 0, per_units: 1 },
      video_minute: { per_unit_micros: 0, per_units: 1 },
      storage_gb_month: { per_unit_micros: 0, per_units: 1 },
      tool_call: { per_unit_micros: 0, per_units: 1 },
      other: { per_unit_micros: 0, per_units: 1 },
    },
  },
  azure_openai: {}, // overlay over openai rates; resolved by selecting openai rates
  local: {}, // in-process extractors are free
  other: {},
};

export interface EstimateInput {
  provider: ProviderId;
  model: string;
  /** Per-dimension unit counts. */
  units: Partial<Record<CostDimension, number>>;
}

export interface EstimateBreakdown {
  /** Total cost in micro-USD. */
  total_micros: number;
  /** Per-dimension contribution in micro-USD. */
  per_dimension: Partial<Record<CostDimension, number>>;
  /** Whether the (provider, model) was found in the rate table. */
  modeled: boolean;
}

/**
 * Estimate the cost of a provider call BEFORE issuing it.
 *
 * Unknown (provider, model) pairs return `modeled: false` with the
 * `other` dimension priced at a conservative ceiling. Callers can
 * use `modeled` to refuse the call when the operator hasn't approved
 * a pricing entry for the model.
 */
export function estimateCost(input: EstimateInput): EstimateBreakdown {
  const providerTable = RATE_TABLE[input.provider];
  const modelRates: Record<CostDimension, UnitRate> | undefined =
    providerTable?.[input.model] ??
    // For azure, fall back to openai when the model name matches.
    (input.provider === 'azure_openai' ? RATE_TABLE.openai[input.model] : undefined);

  const per_dimension: Partial<Record<CostDimension, number>> = {};
  let total = 0;
  let modeled = !!modelRates;

  if (!modelRates) {
    // Unknown model — conservative ceiling: $0.10 per 1000 input
    // tokens + $0.30 per 1000 output tokens, ceiling on multimodal.
    // This intentionally over-estimates to discourage shipping
    // unmodeled providers.
    const fallback: Record<CostDimension, UnitRate> = {
      text_input: { per_unit_micros: 100_000, per_units: 1000 },
      text_output: { per_unit_micros: 300_000, per_units: 1000 },
      embedding: { per_unit_micros: 10_000, per_units: 1000 },
      vision_image: { per_unit_micros: 20_000, per_units: 1 },
      speech_minute: { per_unit_micros: 50_000, per_units: 1 },
      video_minute: { per_unit_micros: 500_000, per_units: 1 },
      storage_gb_month: { per_unit_micros: 0, per_units: 1 },
      tool_call: { per_unit_micros: 0, per_units: 1 },
      other: { per_unit_micros: 0, per_units: 1 },
    };
    for (const [dim, count] of Object.entries(input.units) as Array<[CostDimension, number]>) {
      if (!count || count <= 0) continue;
      const rate = fallback[dim];
      const cost = Math.ceil((count / rate.per_units) * rate.per_unit_micros);
      per_dimension[dim] = cost;
      total += cost;
    }
    return { total_micros: total, per_dimension, modeled };
  }

  for (const [dim, count] of Object.entries(input.units) as Array<[CostDimension, number]>) {
    if (!count || count <= 0) continue;
    const rate = modelRates[dim];
    if (!rate) continue;
    const cost = Math.ceil((count / rate.per_units) * rate.per_unit_micros);
    per_dimension[dim] = cost;
    total += cost;
  }

  return { total_micros: total, per_dimension, modeled };
}

/**
 * Project the (total) cost of a sequence of estimated calls. Useful
 * for the beta-cost simulator + dashboard projection.
 */
export function projectCost(estimates: EstimateBreakdown[]): number {
  return estimates.reduce((sum, e) => sum + e.total_micros, 0);
}

export function microsToUsd(micros: number): number {
  return micros / MICROS_PER_USD;
}

export const __test = { RATE_TABLE };
