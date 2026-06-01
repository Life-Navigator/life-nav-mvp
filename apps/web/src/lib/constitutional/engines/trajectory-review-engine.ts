/**
 * TrajectoryReviewEngine — Sprint L2.
 *
 * Inspects a proposed action against the user's likely trajectory.
 * Detects:
 *   - self-defeating decisions
 *   - impulsive decisions (especially under acute emotion)
 *   - future-destructive decisions
 *   - emotional overreaction
 *
 * Inputs: the draft text + the EmotionalAssessment from the
 * EmotionalIntelligenceEngine + (optionally) the user's current
 * dominant-driver tag from Sprint H.
 */

import type {
  EmotionalAssessment,
  TrajectoryConcern,
  TrajectoryReviewResult,
} from '@/types/constitutional';

const IMPULSIVE_PATTERNS = [
  /\bi'?ll\s+just\s+(?:quit|leave|move\s+out|cut\s+them\s+off)\b[^.!?]{0,40}\b(?:today|right\s+now|tonight)\b/i,
  /\bi\s+just\s+(?:bought|sold|signed|paid|sent)\s+\w+\s+(?:in\s+anger|out\s+of\s+spite)\b/i,
  /\bwithdraw\s+all\s+(?:my|the)\s+(?:money|savings)\b[^.!?]{0,40}\b(?:right\s+now|today|tomorrow)\b/i,
];

const FUTURE_DESTRUCTIVE_PATTERNS = [
  /\b(?:burn\s+(?:the\s+)?(?:bridge|bridges|career|relationship))\b/i,
  /\b(?:publicly\s+(?:expose|shame|destroy)\s+(?:him|her|them))\b/i,
  /\b(?:walk\s+out\s+(?:on|of)\s+(?:the|my)\s+(?:family|kids|spouse|business)\s+(?:today|right\s+now))\b/i,
  /\b(?:permanent(?:ly)?\s+(?:cut\s+off|sever|destroy))\b/i,
];

const SELF_DEFEATING_PATTERNS = [
  /\b(?:i'?ll\s+(?:just|never)\s+(?:fail|lose|give\s+up))\b/i,
  /\b(?:why\s+(?:bother|try)\s+(?:anymore|at\s+all))\b/i,
];

const OVERREACTION_PATTERNS = [
  /\b(?:one\s+(?:bad\s+)?(?:day|week|month)\s+means\s+everything\s+is\s+(?:lost|over))\b/i,
  /\b(?:i\s+have\s+to\s+(?:act|decide|move)\s+(?:right\s+now|today)|i\s+cannot\s+wait)\b/i,
];

function findOne(
  text: string,
  patterns: RegExp[],
  kind: TrajectoryConcern['kind'],
  rule_id: string,
  reason: string
): TrajectoryConcern | null {
  for (const r of patterns) {
    const m = text.match(r);
    if (m) {
      return { kind, rule_id, reason, evidence_phrase: m[0] };
    }
  }
  return null;
}

export interface TrajectoryReviewInputs {
  draft_text: string;
  user_input_text?: string;
  emotional?: EmotionalAssessment;
}

export function reviewTrajectory(inputs: TrajectoryReviewInputs): TrajectoryReviewResult {
  const t = `${inputs.draft_text ?? ''}\n${inputs.user_input_text ?? ''}`;
  const concerns: TrajectoryConcern[] = [];

  const imp = findOne(
    t,
    IMPULSIVE_PATTERNS,
    'impulsive',
    'trajectory.no_impulse',
    'Decision appears impulsive and irreversible.'
  );
  if (imp) concerns.push(imp);

  const fd = findOne(
    t,
    FUTURE_DESTRUCTIVE_PATTERNS,
    'future_destructive',
    'trajectory.future_destructive',
    'Decision appears to foreclose future opportunities (relationships, career, reputation).'
  );
  if (fd) concerns.push(fd);

  const sd = findOne(
    t,
    SELF_DEFEATING_PATTERNS,
    'self_defeating',
    'trajectory.no_self_defeat',
    'Decision frame is self-defeating; abandoning effort under negative-self-prediction.'
  );
  if (sd) concerns.push(sd);

  const ov = findOne(
    t,
    OVERREACTION_PATTERNS,
    'emotional_overreaction',
    'trajectory.emotional_overreaction',
    'Decision appears to be a generalization from a single negative event.'
  );
  if (ov) concerns.push(ov);

  // Decompression: if emotional risk is HIGH or CRITICAL AND we have
  // an irreversible-decision pattern OR the user is asking for
  // action-now language, flag.
  const needs_decompression =
    (inputs.emotional?.risk_level === 'HIGH' || inputs.emotional?.risk_level === 'CRITICAL') &&
    concerns.length > 0;

  return { concerns, needs_decompression };
}

export const __test = {
  reviewTrajectory,
  IMPULSIVE_PATTERNS,
  FUTURE_DESTRUCTIVE_PATTERNS,
  SELF_DEFEATING_PATTERNS,
  OVERREACTION_PATTERNS,
};
