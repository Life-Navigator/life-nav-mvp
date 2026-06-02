/**
 * Human Flourishing Review — Sprint N.3 Phase 8.
 *
 * Score the response across 9 axes that LifeNavigator cares about:
 *
 *   health, safety, relationships, education, career, financial,
 *   resilience, responsibility, future_opportunity
 *
 * The score per axis is a delta in [-1, 1]:
 *
 *    +0.5..+1.0 → strongly supports
 *    +0.1..+0.4 → mildly supports
 *     0         → neutral
 *    -0.1..-0.4 → mildly harms
 *    -0.5..-1.0 → strongly harms
 *
 * The scorer is heuristic and deliberately under-confident. A
 * harming-axes list is the actionable output.
 */

import type { FlourishingAxis, FlourishingResult, FlourishingScore } from './types';

interface AxisRule {
  axis: FlourishingAxis;
  /** Pattern that signals SUPPORT for the axis. */
  supports?: RegExp;
  /** Pattern that signals HARM to the axis. */
  harms?: RegExp;
  support_delta: number;
  harm_delta: number;
}

const RULES: ReadonlyArray<AxisRule> = Object.freeze([
  // health
  {
    axis: 'health',
    supports:
      /\b(?:sleep|exercise|hydration|nutrition|medication|clinician|primary[-\s]*care|preventive\s+care)\b/gi,
    harms:
      /\b(?:skip\s+(?:your|the)\s+medication|push\s+through\s+the\s+pain|double\s+(?:the|your)\s+dose)\b/gi,
    support_delta: 0.3,
    harm_delta: -0.7,
  },
  // safety
  {
    axis: 'safety',
    supports:
      /\b(?:safety|protection|insurance|emergency\s+(?:contact|fund)|verify|second\s+opinion)\b/gi,
    harms:
      /\b(?:no[-\s]*one\s+will\s+know|hide\s+it|risky\s+but\s+worth\s+it|just\s+drive\s+anyway)\b/gi,
    support_delta: 0.3,
    harm_delta: -0.5,
  },
  // relationships
  {
    axis: 'relationships',
    supports:
      /\b(?:talk\s+to\s+(?:your|a)\s+(?:partner|spouse|family|friend)|seek\s+to\s+understand|repair|mediator|therapist|counselor)\b/gi,
    harms:
      /\b(?:cut\s+(?:them|everyone)\s+off|never\s+speak\s+(?:to|with)\s+them\s+again|burn\s+the\s+(?:relationship|bridge))\b/gi,
    support_delta: 0.4,
    harm_delta: -0.6,
  },
  // education
  {
    axis: 'education',
    supports:
      /\b(?:learn|study|course|book|skill|practice|certification|degree|workshop|tutor)\b/gi,
    harms: /\b(?:you\s+don'?t\s+need\s+to\s+learn|skip\s+the\s+class|drop\s+out\b)/gi,
    support_delta: 0.3,
    harm_delta: -0.4,
  },
  // career
  {
    axis: 'career',
    supports:
      /\b(?:promotion|raise|portfolio|network|mentor|skills?\s+gap|career\s+plan|interview\s+prep)\b/gi,
    harms:
      /\b(?:just\s+quit\s+today|burn\s+the\s+(?:job|career|reputation)|tell\s+your\s+boss\s+off)\b/gi,
    support_delta: 0.3,
    harm_delta: -0.6,
  },
  // financial
  {
    axis: 'financial',
    supports:
      /\b(?:budget|emergency\s+fund|save|invest\s+over\s+time|diversif|401k|ira|tax[-\s]*advantaged|index\s+fund|consult\s+a\s+(?:financial\s+advisor|cpa))\b/gi,
    harms:
      /\b(?:liquidate\s+(?:all\s+)?(?:your\s+)?(?:401k|ira|retirement)|put\s+(?:it|everything)\s+into\s+a\s+single\s+stock|take\s+on\s+(?:max|maximum)\s+debt|gambling\s+is\s+a\s+strategy)\b/gi,
    support_delta: 0.3,
    harm_delta: -0.7,
  },
  // resilience
  {
    axis: 'resilience',
    supports:
      /\b(?:setback|practice|patience|take\s+the\s+long\s+view|recover|come\s+back\s+from|build\s+(?:slowly|steady))\b/gi,
    harms: /\b(?:give\s+up|it'?s\s+over|nothing\s+you\s+can\s+do|just\s+accept\s+defeat)\b/gi,
    support_delta: 0.3,
    harm_delta: -0.6,
  },
  // responsibility
  {
    axis: 'responsibility',
    supports:
      /\b(?:take\s+responsibility|own\s+the\s+outcome|your\s+role|repair|make\s+it\s+right|apologize\s+sincerely)\b/gi,
    harms:
      /\b(?:it'?s\s+not\s+your\s+fault\s+at\s+all|nothing\s+to\s+do\s+with\s+you|blame\s+(?:them|everyone)\s+else)\b/gi,
    support_delta: 0.3,
    harm_delta: -0.5,
  },
  // future_opportunity
  {
    axis: 'future_opportunity',
    supports:
      /\b(?:options|optionality|preserve\s+(?:the\s+)?relationship|future\s+(?:self|opportunities)|long[-\s]*term|invest\s+in\s+yourself)\b/gi,
    harms:
      /\b(?:close\s+(?:every|all)\s+doors?|no\s+coming\s+back\s+from\s+this|you\s+can'?t\s+(?:undo|fix)\s+(?:this|it))\b/gi,
    support_delta: 0.4,
    harm_delta: -0.6,
  },
]);

export interface FlourishingInputs {
  draft_text: string;
}

export function flourishingReview(inputs: FlourishingInputs): FlourishingResult {
  const scores: FlourishingScore[] = [];
  const harming_axes: FlourishingAxis[] = [];

  // Track which axes have been observed so we report all 9.
  const seen = new Set<FlourishingAxis>();

  for (const r of RULES) {
    let delta = 0;
    let reason: string | undefined;
    if (r.supports && r.supports.test(inputs.draft_text)) {
      delta += r.support_delta;
      reason = 'supports';
    }
    // Re-construct the regex (the previous .test() advanced lastIndex
    // when the flag is /g).
    const harmRe = r.harms ? new RegExp(r.harms.source, r.harms.flags) : null;
    if (harmRe && harmRe.test(inputs.draft_text)) {
      delta += r.harm_delta;
      reason = reason ? 'mixed' : 'harms';
      if (r.harm_delta < 0) harming_axes.push(r.axis);
    }
    if (!seen.has(r.axis)) {
      seen.add(r.axis);
      scores.push({ axis: r.axis, delta: clamp(delta, -1, 1), reason });
    }
  }

  // Fill any unscored axes with neutral.
  const ALL_AXES: FlourishingAxis[] = [
    'health',
    'safety',
    'relationships',
    'education',
    'career',
    'financial',
    'resilience',
    'responsibility',
    'future_opportunity',
  ];
  for (const a of ALL_AXES) {
    if (!seen.has(a)) scores.push({ axis: a, delta: 0 });
  }

  const overall = scores.reduce((s, x) => s + x.delta, 0) / scores.length;
  return { scores, overall, harming_axes };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export const __test = { RULES };
