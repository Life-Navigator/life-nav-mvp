/**
 * Character Engine — Sprint N.3 orchestrator.
 *
 * Combines all character checks into a single review:
 *
 *   1. Scan style for prohibited tone categories.
 *   2. Run the Family Table Test.
 *   3. Run the Trusted Advisor Test.
 *   4. Score the response on the 9 flourishing axes.
 *   5. Aggregate into an 8-dimensional CharacterScore.
 *   6. Emit findings + (when needed) a suggested rewrite that wraps
 *      the response in the constructive-guidance envelope.
 */

import { scanStyle } from './style-guard';
import { familyTableTest } from './family-table';
import { trustedAdvisorTest } from './trusted-advisor';
import { flourishingReview } from './flourishing-review';
import { scoreCharacter } from './character-scorer';
import { composeConstructiveGuidance, type RefusalCategory } from './constructive-guidance';
import type { CharacterReview, CharacterFinding } from './types';

export interface CharacterReviewInputs {
  draft_text: string;
  /** Optional topic context for the trusted-advisor obligations. */
  topic?: 'health' | 'legal' | 'financial' | 'family' | 'other';
  /** If supplied, used to compose a constructive rewrite when the
   *  review concludes the draft cannot ship. */
  refusal_category?: RefusalCategory;
}

export function reviewCharacter(inputs: CharacterReviewInputs): CharacterReview {
  const style = scanStyle(inputs.draft_text);
  const ft = familyTableTest({ draft_text: inputs.draft_text });
  const ta = trustedAdvisorTest({ draft_text: inputs.draft_text, topic: inputs.topic });
  const fl = flourishingReview({ draft_text: inputs.draft_text });
  const score = scoreCharacter({
    style_findings: style.findings,
    family_table: ft,
    trusted_advisor: ta,
    flourishing: fl,
  });

  // Build top-level findings list — these surface in the audit.
  const findings: CharacterFinding[] = [];
  for (const f of style.findings) {
    findings.push({
      dimension: dimensionForStyleCategory(f.category),
      rule_id: f.rule_id,
      severity: f.severity,
      reason: f.reason,
      evidence: f.evidence,
    });
  }
  if (!ft.passes) {
    findings.push({
      dimension: 'dignity_preservation',
      rule_id: 'ch.family_table_v1',
      severity: ft.contains_dignity_violation ? 'high' : 'moderate',
      reason: `Family Table Test failed: ${ft.failures.map((f) => f.audience).join(', ')}.`,
    });
  }
  if (!ta.passes) {
    findings.push({
      dimension: 'wisdom',
      rule_id: 'ch.trusted_advisor_v1',
      severity: 'moderate',
      reason: `Trusted Advisor Test: ${ta.concerns[0] ?? 'concerns surfaced'}.`,
    });
  }
  for (const axis of fl.harming_axes) {
    findings.push({
      dimension: 'responsibility',
      rule_id: `ch.flourishing.${axis}_v1`,
      severity: 'moderate',
      reason: `Response would harm the user's ${axis}.`,
    });
  }

  const needs_regeneration = !score.passes_threshold;
  const suggested_rewrite =
    needs_regeneration && inputs.refusal_category
      ? composeConstructiveGuidance({ category: inputs.refusal_category }).full_text
      : undefined;

  return {
    score,
    style: { findings: style.findings, sanitized_text: style.sanitized_text },
    family_table: ft,
    trusted_advisor: ta,
    flourishing: fl,
    needs_regeneration,
    suggested_rewrite,
    findings,
  };
}

function dimensionForStyleCategory(
  c: import('./types').StyleViolationCategory
): import('./types').CharacterDimension {
  switch (c) {
    case 'insult':
    case 'shaming':
    case 'mockery':
    case 'ridicule':
    case 'contempt':
      return 'respect';
    case 'anger':
    case 'vulgarity':
      // 'discipline' is a principle but not a scoring dimension —
      // anger and vulgarity map to respect (treat user with dignity).
      return 'respect';
    case 'political_persuasion':
    case 'ideological_persuasion':
    case 'emotional_manipulation':
      return 'integrity';
    case 'false_certainty':
      return 'humility';
    case 'engagement_bait':
    case 'sycophancy':
      return 'courage';
    case 'abandonment':
      return 'service';
    case 'harmful_action_endorsement':
      return 'responsibility';
    case 'injection_payload':
      return 'integrity';
    default:
      return 'respect';
  }
}
