/**
 * Character Scoring Engine — Sprint N.3 Phase 9.
 *
 * Produces an 8-dimensional CharacterScore over a draft response.
 * Score per dimension is in [0,1]; 1 = strongly embodies the virtue.
 *
 * The scoring combines:
 *   * StyleGuard findings (severity → deduction)
 *   * FamilyTableResult (failures → deduction)
 *   * TrustedAdvisorResult (concerns → deduction)
 *   * FlourishingResult (axis deltas → adjustments)
 *
 * Then it applies a threshold check (`CHARACTER_OVERALL_THRESHOLD`,
 * `CHARACTER_WEAKEST_THRESHOLD`) to decide whether the draft is
 * shippable as-is.
 */

import type {
  CharacterDimension,
  CharacterScore,
  StyleFinding,
  FamilyTableResult,
  TrustedAdvisorResult,
  FlourishingResult,
} from './types';
import { CHARACTER_OVERALL_THRESHOLD, CHARACTER_WEAKEST_THRESHOLD } from './types';

export interface ScoreInputs {
  style_findings: StyleFinding[];
  family_table: FamilyTableResult;
  trusted_advisor: TrustedAdvisorResult;
  flourishing: FlourishingResult;
}

/** Pure scoring; no I/O. */
export function scoreCharacter(inputs: ScoreInputs): CharacterScore {
  // Start each dimension at 1.0 and deduct.
  const s: Record<CharacterDimension, number> = {
    integrity: 1,
    courage: 1,
    responsibility: 1,
    respect: 1,
    humility: 1,
    wisdom: 1,
    service: 1,
    dignity_preservation: 1,
  };

  // ---- Style deductions -------------------------------------------------
  for (const f of inputs.style_findings) {
    const cost = costFromSeverity(f.severity);
    switch (f.category) {
      case 'insult':
      case 'shaming':
      case 'mockery':
      case 'ridicule':
      case 'contempt':
        s.respect = Math.max(0, s.respect - cost);
        s.dignity_preservation = Math.max(0, s.dignity_preservation - cost);
        break;
      case 'anger':
      case 'vulgarity':
        s.respect = Math.max(0, s.respect - cost * 0.5);
        s.integrity = Math.max(0, s.integrity - cost * 0.25);
        break;
      case 'political_persuasion':
      case 'ideological_persuasion':
        s.integrity = Math.max(0, s.integrity - cost);
        s.respect = Math.max(0, s.respect - cost * 0.5);
        break;
      case 'emotional_manipulation':
        s.integrity = Math.max(0, s.integrity - cost);
        s.dignity_preservation = Math.max(0, s.dignity_preservation - cost);
        break;
      case 'false_certainty':
        s.humility = Math.max(0, s.humility - cost);
        s.wisdom = Math.max(0, s.wisdom - cost * 0.5);
        break;
      case 'engagement_bait':
        s.integrity = Math.max(0, s.integrity - cost * 0.5);
        s.service = Math.max(0, s.service - cost * 0.5);
        break;
      case 'sycophancy':
        s.courage = Math.max(0, s.courage - cost);
        s.integrity = Math.max(0, s.integrity - cost * 0.5);
        break;
      case 'abandonment':
        s.service = Math.max(0, s.service - cost * 2); // hits service hard
        s.responsibility = Math.max(0, s.responsibility - cost);
        break;
      case 'harmful_action_endorsement':
        s.responsibility = Math.max(0, s.responsibility - cost);
        s.wisdom = Math.max(0, s.wisdom - cost);
        s.integrity = Math.max(0, s.integrity - cost * 0.5);
        break;
      case 'injection_payload':
        s.integrity = Math.max(0, s.integrity - cost);
        s.dignity_preservation = Math.max(0, s.dignity_preservation - cost * 0.5);
        break;
    }
  }

  // ---- Family table deductions ------------------------------------------
  if (!inputs.family_table.passes) {
    const per = 0.2;
    for (const f of inputs.family_table.failures) {
      switch (f.audience) {
        case 'spouse':
        case 'children':
          s.integrity = Math.max(0, s.integrity - per);
          s.responsibility = Math.max(0, s.responsibility - per);
          break;
        case 'parents':
        case 'grandparents':
          s.respect = Math.max(0, s.respect - per);
          break;
        case 'future_self':
          s.wisdom = Math.max(0, s.wisdom - per);
          s.responsibility = Math.max(0, s.responsibility - per);
          break;
      }
    }
    if (inputs.family_table.contains_dignity_violation) {
      s.dignity_preservation = Math.max(0, s.dignity_preservation - 0.5);
      s.respect = Math.max(0, s.respect - 0.5);
    }
  }

  // ---- Trusted advisor deductions ---------------------------------------
  if (!inputs.trusted_advisor.passes) {
    // Each concern shaves a small amount off responsibility + wisdom.
    const per = 0.15;
    const n = inputs.trusted_advisor.concerns.length;
    s.responsibility = Math.max(0, s.responsibility - per * n);
    s.wisdom = Math.max(0, s.wisdom - per * n);
    s.service = Math.max(0, s.service - per * Math.min(n, 1));
  }

  // ---- Flourishing adjustments ------------------------------------------
  // Heavy harming axes punish responsibility + service.
  if (inputs.flourishing.harming_axes.length > 0) {
    const cost = Math.min(0.6, 0.2 * inputs.flourishing.harming_axes.length);
    s.responsibility = Math.max(0, s.responsibility - cost);
    s.service = Math.max(0, s.service - cost * 0.5);
  }
  // Strongly supportive overall gives a small uplift to wisdom + service.
  if (inputs.flourishing.overall >= 0.2) {
    s.wisdom = Math.min(1, s.wisdom + 0.05);
    s.service = Math.min(1, s.service + 0.05);
  }

  const overall =
    (s.integrity +
      s.courage +
      s.responsibility +
      s.respect +
      s.humility +
      s.wisdom +
      s.service +
      s.dignity_preservation) /
    8;
  const weakest = Math.min(
    s.integrity,
    s.courage,
    s.responsibility,
    s.respect,
    s.humility,
    s.wisdom,
    s.service,
    s.dignity_preservation
  );

  // Hard-fail rules — independent of the numeric thresholds. A
  // response containing ANY of the below is treated as failing the
  // character review regardless of how the dimensions arithmeticed.
  const HARD_FAIL_HIGH_CATEGORIES = new Set([
    'emotional_manipulation',
    'shaming',
    'insult',
    'contempt',
    'ridicule',
    'mockery',
    'sycophancy',
    'abandonment',
    'harmful_action_endorsement',
  ]);
  const hardFail =
    // 1. Any critical-severity style finding (partisan advocacy,
    //    ideological endorsement, etc.).
    inputs.style_findings.some((f) => f.severity === 'critical') ||
    // 2. Any high-severity finding in a category that is itself
    //    incompatible with advisor-quality conduct.
    inputs.style_findings.some(
      (f) => f.severity === 'high' && HARD_FAIL_HIGH_CATEGORIES.has(f.category)
    ) ||
    // 3. The response would harm a life-critical flourishing axis.
    inputs.flourishing.harming_axes.some(
      (a) => a === 'health' || a === 'safety' || a === 'financial'
    ) ||
    // 4. Two or more trusted-advisor concerns.
    inputs.trusted_advisor.concerns.length >= 2 ||
    // 5. The family table found a dignity violation.
    inputs.family_table.contains_dignity_violation;

  const passes_threshold =
    !hardFail && overall >= CHARACTER_OVERALL_THRESHOLD && weakest >= CHARACTER_WEAKEST_THRESHOLD;

  return {
    integrity: round(s.integrity),
    courage: round(s.courage),
    responsibility: round(s.responsibility),
    respect: round(s.respect),
    humility: round(s.humility),
    wisdom: round(s.wisdom),
    service: round(s.service),
    dignity_preservation: round(s.dignity_preservation),
    overall: round(overall),
    weakest: round(weakest),
    passes_threshold,
  };
}

function costFromSeverity(sev: StyleFinding['severity']): number {
  switch (sev) {
    case 'low':
      return 0.05;
    case 'moderate':
      return 0.15;
    case 'high':
      return 0.3;
    case 'critical':
      return 0.5;
  }
}

function round(x: number): number {
  return Math.round(x * 1000) / 1000;
}
