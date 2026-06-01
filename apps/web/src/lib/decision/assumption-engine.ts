/**
 * AssumptionEngine — DETERMINISTIC.
 *
 * Walks the structured XAI envelopes on every engine output and emits
 * a deduplicated, severity-classified, sensitivity-ranked list of
 * assumptions. Persistence is a thin wrapper.
 *
 * The classifier rules are hand-coded — the LLM is not in the loop.
 * Same engine output → same assumption list, same ordering.
 */

import type {
  CatchUpPlan,
  AheadOfPlanPlan,
  DecisionImpact,
  MarginalImpactRanking,
  ProbabilityDistribution,
} from '@/types/decision-impact';
import type { RecommendationOutput } from '@/types/advisor';
import type { AssumptionItem, AssumptionSeverity } from '@/types/xai';

// ---------------------------------------------------------------------------
// Severity classifier — hand-coded patterns. Match against the
// assumption text and bucket into informational | load_bearing |
// critical.
// ---------------------------------------------------------------------------

const CRITICAL_PATTERNS: RegExp[] = [
  /structural\s+(life\s+event|event|change|variable|decision)/i,
  /(?:treated\s+as|is)\s+structural/i,
  /hard\s+constraint/i,
  /no\s+(matching|historical)\s+pathway/i,
  /no\s+supporting\s+goals/i,
  /no\s+user\s+(constraints|capabilities)/i,
];

const LOAD_BEARING_PATTERNS: RegExp[] = [
  /base\s+magnitude/i,
  /peak\s+effect|natural\s+horizon/i,
  /widens?|narrows?/i,
  /horizon\s+(length|grows|widens)/i,
  /scenario-based\s+estimates/i,
  /sub-?goals\s+would\s+narrow/i,
  /commitment\s+(hours|capacity)/i,
  /surplus/i,
];

function classifySeverity(text: string): AssumptionSeverity {
  if (CRITICAL_PATTERNS.some((p) => p.test(text))) return 'critical';
  if (LOAD_BEARING_PATTERNS.some((p) => p.test(text))) return 'load_bearing';
  return 'informational';
}

// ---------------------------------------------------------------------------
// Sensitivity — how much the output would shift if this assumption flipped.
// Hand-coded buckets per kind because we don't have ground truth.
// ---------------------------------------------------------------------------

const SEVERITY_BASE_SENSITIVITY: Record<AssumptionSeverity, number> = {
  critical: 0.85,
  load_bearing: 0.5,
  informational: 0.15,
};

function sensitivityFor(text: string, severity: AssumptionSeverity, confidence?: number): number {
  let s = SEVERITY_BASE_SENSITIVITY[severity];
  // Bump if the assumption explicitly mentions a structural variable.
  if (/structural/i.test(text)) s = Math.min(1, s + 0.05);
  // Discount by stated confidence if available.
  if (confidence != null) s *= confidence;
  return clamp01(s);
}

// ---------------------------------------------------------------------------
// Per-target extractors
// ---------------------------------------------------------------------------

function fromExplanation(
  assumptions: string[] | undefined,
  source_engine: AssumptionItem['source_engine'],
  default_confidence: number
): AssumptionItem[] {
  if (!assumptions) return [];
  return assumptions
    .map((a) => a.trim())
    .filter((a) => a.length > 0)
    .map((text) => {
      const severity = classifySeverity(text);
      return {
        text,
        severity,
        sensitivity: sensitivityFor(text, severity, default_confidence),
        source_engine,
      };
    });
}

export function extractFromRecommendation(rec: RecommendationOutput): AssumptionItem[] {
  return fromExplanation(rec.assumptions, 'reasoning', rec.confidence_score);
}

export function extractFromDecisionImpact(impact: DecisionImpact): AssumptionItem[] {
  return fromExplanation(impact.explanation.assumptions, 'impact', impact.explanation.confidence);
}

export function extractFromProbability(dist: ProbabilityDistribution): AssumptionItem[] {
  return fromExplanation(dist.explanation.assumptions, 'probability', dist.confidence);
}

export function extractFromCatchUp(plan: CatchUpPlan): AssumptionItem[] {
  return fromExplanation(plan.explanation.assumptions, 'catch_up', plan.explanation.confidence);
}

export function extractFromAhead(plan: AheadOfPlanPlan): AssumptionItem[] {
  return fromExplanation(plan.explanation.assumptions, 'ahead', plan.explanation.confidence);
}

export function extractFromRanker(ranking: MarginalImpactRanking): AssumptionItem[] {
  return fromExplanation(ranking.explanation.assumptions, 'ranker', ranking.explanation.confidence);
}

// ---------------------------------------------------------------------------
// Aggregate + dedupe + rank
// ---------------------------------------------------------------------------

export function aggregateAssumptions(lists: AssumptionItem[][]): AssumptionItem[] {
  const seen = new Map<string, AssumptionItem>();
  for (const list of lists) {
    for (const item of list) {
      const key = item.text.toLowerCase();
      const existing = seen.get(key);
      if (!existing || item.sensitivity > existing.sensitivity) {
        seen.set(key, item);
      }
    }
  }
  // Stable sort: severity (critical > load_bearing > informational), then sensitivity desc, then text.
  const order: Record<AssumptionSeverity, number> = {
    critical: 0,
    load_bearing: 1,
    informational: 2,
  };
  return Array.from(seen.values()).sort((a, b) => {
    if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity];
    if (a.sensitivity !== b.sensitivity) return b.sensitivity - a.sensitivity;
    return a.text.localeCompare(b.text);
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export const __test = {
  classifySeverity,
  sensitivityFor,
  fromExplanation,
  aggregateAssumptions,
};
