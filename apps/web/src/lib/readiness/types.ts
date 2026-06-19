/**
 * Deterministic readiness scoring — shared types.
 *
 * Scores are computed from REAL user data only. Every component carries the points
 * earned, the max, and a plain-language reason (explainability). No black box, no
 * fabricated assumptions: absent data scores 0 and is surfaced in `missingData`.
 */
export type ReadinessStatus =
  | 'not_started'
  | 'limited_data'
  | 'developing'
  | 'strong'
  | 'excellent';

export interface ReadinessComponent {
  key: string;
  label: string;
  score: number; // points earned
  max: number; // max points for this component
  reason: string; // why this many points (evidence-based)
}

export interface ReadinessResult {
  score: number; // 0–100 (sum of components, rounded)
  status: ReadinessStatus;
  components: ReadinessComponent[];
  strengths: string[];
  gaps: string[];
  recommendedActions: string[];
  confidence: number; // 0–100 — how much data backs the score
  dataSources: string[]; // tables actually consulted
  missingData: string[]; // inputs that would sharpen the score
  updatedAt: string;
}

export const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/** Map a 0–100 score + data volume to a status. No data → not_started; sparse → limited_data. */
export function statusFor(score: number, dataPoints: number): ReadinessStatus {
  if (dataPoints === 0) return 'not_started';
  if (score < 40) return 'limited_data';
  if (score < 70) return 'developing';
  if (score < 85) return 'strong';
  return 'excellent';
}

/** Confidence rises with how many distinct, populated sources back the score. */
export function confidenceFor(
  populatedSources: number,
  totalSources: number,
  dataPoints: number
): number {
  if (dataPoints === 0) return 0;
  const breadth = totalSources > 0 ? populatedSources / totalSources : 0;
  // Breadth of sources (70%) + a volume floor (30%), capped at 95 (never fully certain).
  const volume = clamp(dataPoints / 12, 0, 1);
  return Math.round(clamp((breadth * 0.7 + volume * 0.3) * 100, 5, 95));
}
