/**
 * Political Influence validator (Principle 2 — Political Neutrality).
 *
 * The platform may explain, compare, and inform. It must never
 * advocate parties, candidates, or ideologies. This validator emits
 * a violation when the subject text reads like advocacy or
 * persuasion targeted at political outcomes.
 *
 * We intentionally do NOT flag every mention of a party or political
 * topic — comparison and explanation are allowed. We flag advocacy
 * verbs ("vote for", "support [candidate]", "donate to") and
 * ideological-persuasion framings.
 */

import type { GovernanceSubject, GovernanceViolation } from '@/types/governance';

// Party and candidate placeholders — keep the list short and stable.
// In practice we match generic advocacy patterns rather than specific
// names, so the engine is not US-centric and remains stable through
// election cycles.
const ADVOCACY_VERBS =
  /\b(vote\s+(?:for|against)|support(?:s|ed|ing)?\s+(?:the\s+)?(?:candidate|party|campaign)|donate(?:s|d|ing)?\s+to\s+(?:the\s+)?(?:campaign|party|candidate|PAC)|endorse(?:s|d|ing)?\s+(?:the\s+)?(?:candidate|party))\b/i;

const IDEOLOGY_PERSUASION =
  /\byou\s+(?:should|need\s+to|must)\s+(?:vote|support|oppose|reject|defeat)\b/i;

const INFLUENCE_CAMPAIGN =
  /\b(persuade|convince|mobilize|sway|influence)\s+(?:voters|the\s+electorate|the\s+public)\b/i;

const POLITICAL_TARGET_VERB =
  /\b(register|turn\s+out|mobilize|organize)\s+(?:voters|supporters)\b/i;

export function validatePoliticalInfluence(s: GovernanceSubject): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  const text = (s.text ?? '') + ' ' + (s.action ?? '');
  if (ADVOCACY_VERBS.test(text)) {
    out.push({
      category: 'political_influence',
      severity: 'high',
      rule_id: 'pol.advocacy_verb',
      reason: 'Subject contains direct political advocacy.',
      principle: 'political_neutrality',
      safer_alternatives: [
        {
          label: 'Compare candidate positions on a specific policy',
          description: 'Factual, side-by-side comparison without endorsement.',
        },
        {
          label: 'Summarize voting records',
          description: 'Show records without recommending a vote.',
        },
      ],
    });
  }
  if (IDEOLOGY_PERSUASION.test(text)) {
    out.push({
      category: 'political_influence',
      severity: 'high',
      rule_id: 'pol.ideology_persuasion',
      reason: 'Subject pressures the user toward a political action.',
      principle: 'political_neutrality',
    });
  }
  if (INFLUENCE_CAMPAIGN.test(text) || POLITICAL_TARGET_VERB.test(text)) {
    out.push({
      category: 'political_influence',
      severity: 'critical',
      rule_id: 'pol.influence_campaign',
      reason: 'Subject reads as an attempt to run an influence or turn-out campaign.',
      principle: 'political_neutrality',
    });
  }
  return out;
}

export const __test = {
  ADVOCACY_VERBS,
  IDEOLOGY_PERSUASION,
  INFLUENCE_CAMPAIGN,
  POLITICAL_TARGET_VERB,
  validatePoliticalInfluence,
};
