/**
 * Economic-governance entry — re-exports every helper so consumers
 * have a single import surface.
 */

export * from './types';
export { estimateCost, projectCost, microsToUsd } from './cost-estimator';
export type { ProviderId, EstimateInput, EstimateBreakdown } from './cost-estimator';
export { recordUsage } from './usage-meter';
export type { RecordUsageInputs, RecordUsageResult } from './usage-meter';
export { evaluate as evaluateBudget } from './budget-manager';
export type {
  EvaluateInputs as BudgetEvaluateInputs,
  EvaluationResult,
  EvaluationVerdict,
} from './budget-manager';
export { consume as consumeRate, refillBucket, consumeBucket } from './rate-limiter';
export type { ConsumeResult, ConsumeInputs, RateVerdict } from './rate-limiter';
export {
  checkFile,
  checkDailyUploadBudget,
  BETA_FILE_LIMITS,
  BETA_DAILY_UPLOAD_BUDGET_BYTES,
  costDimensionForKind,
} from './quota-engine';
export type { QuotaVerdict, CheckFileInputs, CheckDailyInputs } from './quota-engine';
export { selectModel, FEATURE_TIER } from './model-selection';
export type { ModelTier, ResolvedModel, FeatureKey, SelectModelInputs } from './model-selection';
export {
  scoreAbuse,
  gatherSignals,
  persistAbuseFindings,
  ABUSE_THRESHOLDS,
} from './abuse-detector';
export type { AbuseSignal, AbuseFinding } from './abuse-detector';
export {
  evaluate as evaluateBreaker,
  recordOutcome,
  forceOpen,
  reset as resetBreaker,
} from './circuit-breaker';
export type {
  BreakerVerdict,
  EvaluateInputs as BreakerEvaluateInputs,
  RecordOutcomeInputs,
  BreakerRow,
} from './circuit-breaker';
