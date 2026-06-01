/**
 * EmotionalIntelligenceEngine — Sprint L2.
 *
 * Detects emotional signals in INCOMING user requests AND OUTGOING
 * drafts. Output is structured information; the engine itself does
 * not decide what to do — that's the orchestrator's job.
 *
 * Patterns are regex-based and intentionally conservative. The
 * engine prefers false negatives to false positives in the absence
 * of strong cues (a user mentioning "anger" once should not trigger
 * a HIGH risk classification).
 */

import type {
  EmotionalAssessment,
  EmotionalSignal,
  EmotionalState,
  RiskLevel,
} from '@/types/constitutional';

// Each entry: [state, regex, intensity_default]
const PATTERNS: Array<[EmotionalState, RegExp, EmotionalSignal['intensity']]> = [
  // Grief / sadness
  ['grief', /\b(?:i\s+(?:lost|just\s+lost)\s+(?:my|her|him|them|everything))\b/i, 'high'],
  ['grief', /\b(?:funeral|burial|the\s+memorial)\b/i, 'moderate'],
  ['sadness', /\b(?:i'?m\s+(?:so\s+)?(?:sad|broken|crushed|devastated))\b/i, 'high'],
  ['sadness', /\b(?:i\s+miss\s+(?:them|her|him)\s+so\s+much)\b/i, 'moderate'],

  // Anger / rage
  ['anger', /\b(?:i'?m\s+(?:so\s+)?(?:angry|furious|pissed|livid))\b/i, 'high'],
  ['rage', /\b(?:i\s+want\s+to\s+(?:scream|destroy|break|smash))\b/i, 'high'],
  ['anger', /\b(?:they\s+(?:deserve|will\s+pay))\b/i, 'moderate'],

  // Fear / panic
  ['fear', /\b(?:i'?m\s+(?:so\s+)?(?:scared|afraid|terrified))\b/i, 'high'],
  ['panic', /\b(?:panic\s+attack|i\s+can'?t\s+breathe|my\s+heart\s+is\s+racing)\b/i, 'severe'],
  ['fear', /\b(?:what\s+if\s+i\s+(?:fail|lose|can'?t))\b/i, 'low'],

  // Shame / humiliation
  ['shame', /\b(?:i'?m\s+(?:so\s+)?(?:ashamed|disgusted\s+with\s+myself|a\s+failure))\b/i, 'high'],
  ['humiliation', /\b(?:i\s+was\s+humiliated|they\s+humiliated\s+me)\b/i, 'high'],

  // Despair / hopelessness
  ['despair', /\b(?:i\s+(?:can'?t\s+do\s+this|give\s+up|see\s+no\s+way\s+out))\b/i, 'severe'],
  ['hopelessness', /\b(?:there'?s\s+no\s+(?:hope|point|future)|nothing\s+matters)\b/i, 'severe'],
  ['hopelessness', /\b(?:my\s+life\s+is\s+over|i\s+have\s+nothing\s+left)\b/i, 'severe'],

  // Obsession
  ['obsession', /\b(?:i\s+can'?t\s+stop\s+thinking\s+about\s+(?:it|them|him|her))\b/i, 'high'],
  ['obsession', /\b(?:every\s+(?:minute|hour|day)\s+i\s+think\s+about)\b/i, 'high'],

  // Isolation
  ['isolation', /\b(?:i\s+have\s+(?:no\s+one|nobody)|i'?m\s+(?:so\s+)?alone)\b/i, 'high'],
  ['isolation', /\b(?:no\s+one\s+(?:understands|cares))\b/i, 'moderate'],
];

const INTENSITY_RANK: Record<EmotionalSignal['intensity'], number> = {
  low: 0,
  moderate: 1,
  high: 2,
  severe: 3,
};

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * Combine intensities across signals into a risk level. The scoring
 * is conservative:
 *   - any 'severe' → at least HIGH
 *   - any 'severe' + ≥2 high → CRITICAL
 *   - multiple high → HIGH
 *   - any high → MODERATE
 *   - else → LOW
 */
function aggregateRiskLevel(signals: EmotionalSignal[]): RiskLevel {
  const c = { low: 0, moderate: 0, high: 0, severe: 0 };
  for (const s of signals) c[s.intensity]++;
  if (c.severe >= 1 && c.high >= 2) return 'CRITICAL';
  if (c.severe >= 2) return 'CRITICAL';
  if (c.severe >= 1) return 'HIGH';
  if (c.high >= 2) return 'HIGH';
  if (c.high >= 1) return 'MODERATE';
  if (c.moderate >= 2) return 'MODERATE';
  return 'LOW';
}

/**
 * Future visibility heuristic — how confident is the user that
 * alternative futures exist?
 *
 *   - presence of despair / hopelessness severe → near 0
 *   - presence of catastrophe wording → near 0.3
 *   - else proportional to negative signal weight
 */
function futureVisibilityScore(signals: EmotionalSignal[]): number {
  let pen = 0;
  for (const s of signals) {
    if (s.state === 'despair' || s.state === 'hopelessness') {
      pen += s.intensity === 'severe' ? 0.7 : s.intensity === 'high' ? 0.4 : 0.2;
    } else if (s.state === 'grief' || s.state === 'panic' || s.state === 'shame') {
      pen += s.intensity === 'severe' ? 0.3 : s.intensity === 'high' ? 0.15 : 0.05;
    }
  }
  return clamp01(1 - pen);
}

/**
 * Decision quality risk — how impaired is the user's likely
 * decision quality given the surfaced emotional load?
 */
function decisionQualityRiskScore(signals: EmotionalSignal[]): number {
  let r = 0;
  for (const s of signals) {
    r += INTENSITY_RANK[s.intensity] * 0.12;
    if (s.state === 'rage' || s.state === 'panic' || s.state === 'obsession') r += 0.1;
  }
  return clamp01(r);
}

export function assessEmotionalState(text: string): EmotionalAssessment {
  const t = text ?? '';
  const signals: EmotionalSignal[] = [];

  for (const [state, re, intensity] of PATTERNS) {
    const m = t.match(re);
    if (m) {
      signals.push({ state, evidence_phrase: m[0], intensity });
    }
  }

  // Dedupe — keep the strongest signal per state.
  const byState = new Map<EmotionalState, EmotionalSignal>();
  for (const s of signals) {
    const prev = byState.get(s.state);
    if (!prev || INTENSITY_RANK[s.intensity] > INTENSITY_RANK[prev.intensity]) {
      byState.set(s.state, s);
    }
  }
  const deduped = Array.from(byState.values()).sort(
    (a, b) => INTENSITY_RANK[b.intensity] - INTENSITY_RANK[a.intensity]
  );

  const risk_level = aggregateRiskLevel(deduped);
  const fv = futureVisibilityScore(deduped);
  const dq = decisionQualityRiskScore(deduped);

  // Confidence is a function of how many distinct strong signals fired.
  const strongCount = deduped.filter(
    (s) => s.intensity === 'high' || s.intensity === 'severe'
  ).length;
  const confidence = clamp01(deduped.length === 0 ? 0.1 : Math.min(0.95, 0.4 + 0.15 * strongCount));

  return {
    emotional_state: deduped,
    risk_level,
    confidence: Number(confidence.toFixed(2)),
    future_visibility_score: Number(fv.toFixed(2)),
    decision_quality_risk_score: Number(dq.toFixed(2)),
  };
}

export const __test = {
  assessEmotionalState,
  aggregateRiskLevel,
  futureVisibilityScore,
  decisionQualityRiskScore,
  PATTERNS,
};
