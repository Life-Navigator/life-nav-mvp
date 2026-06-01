/**
 * CrisisDetectionEngine — Sprint L2.
 *
 * Detects suicidal ideation, self-harm risk, violence risk, severe
 * emotional instability, and extreme hopelessness in USER INPUT or
 * (when relevant) a drafted response. When the result is HIGH or
 * CRITICAL the orchestrator suspends ordinary goal optimization and
 * routes to a Constitutional Redirection that surfaces human
 * support options.
 *
 * This engine deliberately uses HIGH PRECISION patterns. False
 * positives create their own harm (treating an ordinary user as if
 * in crisis is patronizing); false negatives are mitigated by the
 * full orchestrator (the emotional engine + cognitive distortion +
 * trajectory review compose into the verdict).
 */

import type { CrisisAssessment, CrisisKind, CrisisSignal, RiskLevel } from '@/types/constitutional';
import { RISK_RANK } from '@/types/constitutional';

interface CrisisPattern {
  kind: CrisisKind;
  regex: RegExp;
  level: RiskLevel;
}

// Patterns chosen to match explicit, unambiguous statements. We do
// NOT match casual idioms ("I could kill for a coffee" etc.).
const PATTERNS: CrisisPattern[] = [
  // Suicidal ideation — direct
  {
    kind: 'suicidal_ideation',
    regex:
      /\b(?:i\s+want\s+to\s+(?:die|end\s+(?:it|my\s+life))|i'?m\s+thinking\s+(?:of|about)\s+suicid(?:e|al))\b/i,
    level: 'CRITICAL',
  },
  {
    kind: 'suicidal_ideation',
    regex:
      /\b(?:i\s+have\s+(?:a\s+plan|the\s+means)|i'?ve\s+(?:thought|been\s+thinking)\s+about\s+how)\b/i,
    level: 'CRITICAL',
  },
  {
    kind: 'suicidal_ideation',
    regex:
      /\b(?:everyone\s+would\s+be\s+better\s+off\s+without\s+me|i\s+want\s+to\s+stop\s+existing)\b/i,
    level: 'HIGH',
  },

  // Self-harm risk
  {
    kind: 'self_harm_risk',
    regex:
      /\b(?:i\s+(?:want\s+to|am\s+going\s+to)\s+(?:hurt|cut)\s+myself|i'?ve\s+been\s+(?:cutting|burning|hurting)\s+myself)\b/i,
    level: 'HIGH',
  },

  // Violence risk — toward a named other
  {
    kind: 'violence_risk',
    regex:
      /\b(?:i'?m\s+going\s+to\s+(?:kill|hurt|shoot|stab|burn|attack))\s+(?:him|her|them|my\s+(?:spouse|partner|ex|boss|coworker))\b/i,
    level: 'CRITICAL',
  },
  {
    kind: 'violence_risk',
    regex: /\b(?:i\s+have\s+a\s+(?:weapon|gun|knife)\s+(?:ready|for\s+(?:him|her|them)))\b/i,
    level: 'CRITICAL',
  },

  // Severe emotional instability — acute, time-bounded.
  {
    kind: 'severe_emotional_instability',
    regex:
      /\b(?:i\s+can'?t\s+stop\s+(?:crying|shaking)|i\s+haven'?t\s+slept\s+(?:in\s+(?:\d+\s+)?days?))\b/i,
    level: 'MODERATE',
  },

  // Extreme hopelessness
  {
    kind: 'extreme_hopelessness',
    regex:
      /\b(?:i\s+have\s+nothing\s+left|there\s+is\s+nothing\s+left|my\s+life\s+is\s+over|there\s+is\s+no\s+future)\b/i,
    level: 'HIGH',
  },
];

export function detectCrisisSignals(text: string): CrisisSignal[] {
  const t = text ?? '';
  const out: CrisisSignal[] = [];
  for (const p of PATTERNS) {
    const m = t.match(p.regex);
    if (m) {
      out.push({
        kind: p.kind,
        evidence_phrase: m[0],
        level: p.level,
        escalation_recommended: p.level === 'HIGH' || p.level === 'CRITICAL',
      });
    }
  }
  return out;
}

export function assessCrisis(text: string): CrisisAssessment {
  const signals = detectCrisisSignals(text);
  if (signals.length === 0) {
    return {
      signals: [],
      level: 'LOW',
      escalation_recommended: false,
      suspend_goal_optimization: false,
    };
  }
  let top: RiskLevel = 'LOW';
  for (const s of signals) {
    if (RISK_RANK[s.level] > RISK_RANK[top]) top = s.level;
  }
  return {
    signals,
    level: top,
    escalation_recommended: top === 'HIGH' || top === 'CRITICAL',
    suspend_goal_optimization: top === 'HIGH' || top === 'CRITICAL',
  };
}

export const __test = { detectCrisisSignals, assessCrisis, PATTERNS };
