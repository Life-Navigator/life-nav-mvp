/**
 * FuturePreservationEngine — Sprint L2.
 *
 * Scores a proposed action on six preservation axes:
 *   - freedom
 *   - health
 *   - relationships
 *   - career_opportunities
 *   - education_opportunities
 *   - financial_flexibility
 *   - reputation
 *   - future_options
 *
 * Each axis returns a [0,1] score where 1 = action preserves the
 * axis. Axes scoring below a configurable threshold are surfaced as
 * `destructive_axes` so the redirection layer can suggest
 * alternatives that preserve them.
 */

import type {
  FuturePreservationAxis,
  FuturePreservationResult,
  FuturePreservationScore,
} from '@/types/constitutional';

interface AxisRule {
  axis: FuturePreservationAxis;
  pattern: RegExp;
  penalty: number; // how much this hit subtracts from a baseline of 1.0
  reason: string;
}

const RULES: AxisRule[] = [
  // Freedom
  {
    axis: 'freedom',
    pattern: /\b(?:plea(?:d|ding)\s+guilty|prison\s+sentence|conviction|criminal\s+record)\b/i,
    penalty: 0.9,
    reason: 'criminal exposure reduces freedom',
  },
  {
    axis: 'freedom',
    pattern: /\b(?:irreversible\s+commitment|long-?term\s+lock-?in)\b/i,
    penalty: 0.4,
    reason: 'long-term commitment reduces flexibility',
  },

  // Health
  {
    axis: 'health',
    pattern:
      /\b(?:skip\s+medication|skip\s+treatment|delay\s+the\s+(?:surgery|chemotherapy|appointment))\b/i,
    penalty: 0.7,
    reason: 'reduces health',
  },
  {
    axis: 'health',
    pattern: /\b(?:binge|starve|purge|abuse\s+(?:alcohol|drugs))\b/i,
    penalty: 0.7,
    reason: 'reduces health',
  },

  // Relationships
  {
    axis: 'relationships',
    pattern: /\b(?:cut\s+(?:all\s+)?ties|burn\s+the\s+bridge|publicly\s+expose|estrange)\b/i,
    penalty: 0.6,
    reason: 'reduces relationship capital',
  },
  {
    axis: 'relationships',
    pattern: /\b(?:divorce\s+(?:them\s+)?today|file\s+for\s+divorce\s+(?:right\s+now|tonight))\b/i,
    penalty: 0.5,
    reason: 'irreversible relationship action',
  },

  // Career
  {
    axis: 'career_opportunities',
    pattern: /\b(?:quit\s+(?:my|the)\s+job\s+(?:today|right\s+now))\b/i,
    penalty: 0.5,
    reason: 'foreclosing job optionality',
  },
  {
    axis: 'career_opportunities',
    pattern: /\b(?:badmouth|libel|defame)\s+(?:my\s+)?(?:employer|boss|coworker)\b/i,
    penalty: 0.6,
    reason: 'reputational damage forecloses career',
  },

  // Education
  {
    axis: 'education_opportunities',
    pattern:
      /\b(?:drop\s+out\s+of\s+(?:school|college|the\s+program)|withdraw\s+from\s+(?:school|the\s+program))\b/i,
    penalty: 0.5,
    reason: 'forecloses educational pathway',
  },

  // Financial flexibility
  {
    axis: 'financial_flexibility',
    pattern:
      /\b(?:withdraw\s+all|empty\s+the\s+(?:account|savings)|cash\s+out\s+(?:all|everything))\b/i,
    penalty: 0.6,
    reason: 'reduces financial reserves',
  },
  {
    axis: 'financial_flexibility',
    pattern: /\b(?:max\s+out\s+credit|take\s+out\s+a\s+payday\s+loan)\b/i,
    penalty: 0.5,
    reason: 'reduces financial flexibility',
  },

  // Reputation
  {
    axis: 'reputation',
    pattern: /\b(?:public\s+rant|public\s+humiliation|leak\s+(?:to|the)\s+press)\b/i,
    penalty: 0.6,
    reason: 'reputational risk',
  },
  {
    axis: 'reputation',
    pattern: /\b(?:viral\s+post\s+about\s+(?:him|her|them))\b/i,
    penalty: 0.5,
    reason: 'reputational risk',
  },

  // Future options
  {
    axis: 'future_options',
    pattern: /\b(?:there\s+is\s+only\s+one\s+(?:way|path|option))\b/i,
    penalty: 0.5,
    reason: 'reduces perceived optionality',
  },
  {
    axis: 'future_options',
    pattern: /\b(?:permanent(?:ly)?\s+(?:close|shut|end))\b/i,
    penalty: 0.6,
    reason: 'permanent foreclosure framing',
  },
];

const ALL_AXES: FuturePreservationAxis[] = [
  'freedom',
  'health',
  'relationships',
  'career_opportunities',
  'education_opportunities',
  'financial_flexibility',
  'reputation',
  'future_options',
];

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export interface FuturePreservationInputs {
  draft_text: string;
  user_input_text?: string;
  threshold?: number; // default 0.6
}

export function scoreFuturePreservation(
  inputs: FuturePreservationInputs
): FuturePreservationResult {
  const t = `${inputs.draft_text ?? ''}\n${inputs.user_input_text ?? ''}`;
  const scoreMap = new Map<FuturePreservationAxis, FuturePreservationScore>();
  for (const a of ALL_AXES) {
    scoreMap.set(a, { axis: a, score: 1, reason: 'preserved by default' });
  }

  for (const r of RULES) {
    if (r.pattern.test(t)) {
      const cur = scoreMap.get(r.axis)!;
      cur.score = clamp01(cur.score - r.penalty);
      cur.reason = r.reason;
      scoreMap.set(r.axis, cur);
    }
  }

  const axes = Array.from(scoreMap.values());
  const overall = Number((axes.reduce((s, a) => s + a.score, 0) / axes.length).toFixed(4));
  const threshold = inputs.threshold ?? 0.6;
  const destructive_axes = axes.filter((a) => a.score < threshold).map((a) => a.axis);

  return { axes, overall, destructive_axes };
}

export const __test = { scoreFuturePreservation, RULES, ALL_AXES };
