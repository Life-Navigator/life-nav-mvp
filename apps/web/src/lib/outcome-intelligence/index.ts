/**
 * Outcome Intelligence — entry module.
 */

export * from './types';
export { checkSafety, filterSafe } from './safety-gate';
export type { SafetyVerdict } from './safety-gate';
export { computeEffectiveness, EFFECTIVENESS_WEIGHTS } from './effectiveness-score';
export type { ComputeEffectivenessInputs } from './effectiveness-score';
export { computeDqi, computeDqiSafe, DQI_WEIGHTS } from './decision-quality-index';
export type { DqiInputs, DqiInputRow } from './decision-quality-index';
export { computeAttribution, MAX_LAG_DAYS } from './attribution-engine';
export type { AttributionInputs } from './attribution-engine';
export { appendSnapshot, summarizeGoal, goalAchievementRate } from './goal-achievement';
export type {
  AppendSnapshotInputs,
  AppendedSnapshot,
  GoalAchievementSummary,
} from './goal-achievement';
export { computeLifeProgress } from './life-progress';
export type { LifeProgressInputs } from './life-progress';
export { computeTenantReport } from './enterprise-reporting';
export type { TenantReportInputs } from './enterprise-reporting';
