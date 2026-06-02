/**
 * Family Table Test — Sprint N.3 Phase 3.
 *
 * Before streaming, ask:
 *
 *   "Would this response be something we'd be proud to say to the user,
 *    in front of their spouse, their children, their parents, their
 *    grandparents, and their future self — knowing the consequences?"
 *
 * Implementation is heuristic. We look for content that any of the
 * five audiences would object to:
 *
 *   spouse       → secret-keeping, deception, undermining the partner
 *   children     → vulgarity, contempt, normalization of harm
 *   parents      → disrespect of their values, dismissal of moderation
 *   grandparents → callousness, contempt for tradition
 *   future_self  → impulsivity, irreversibility, short-termism
 */

import type { FamilyTableResult } from './types';

interface AudienceCheck {
  audience: FamilyTableResult['failures'][number]['audience'];
  pattern: RegExp;
  reason: string;
}

const CHECKS: ReadonlyArray<AudienceCheck> = Object.freeze([
  // spouse / partner
  {
    audience: 'spouse',
    pattern:
      /\b(?:hide\s+(?:this|it)\s+from|don'?t\s+tell\s+(?:your|the)\s+(?:spouse|partner|wife|husband)|behind\s+(?:their|his|her)\s+back)\b/gi,
    reason: 'Recommends secret-keeping from a spouse / partner.',
  },
  // children
  {
    audience: 'children',
    pattern:
      /\b(?:teach\s+(?:them|your\s+kids)\s+to\s+lie|tell\s+(?:them|your\s+kids)\s+nothing|kids\s+don'?t\s+need\s+to\s+know)\b/gi,
    reason: 'Counsels parents to deceive their children.',
  },
  // parents
  {
    audience: 'parents',
    pattern:
      /\b(?:your\s+parents\s+are\s+(?:wrong|old-fashioned|dumb)|ignore\s+your\s+parents\b)/gi,
    reason: "Dismisses the user's parents wholesale.",
  },
  // grandparents
  {
    audience: 'grandparents',
    pattern:
      /\b(?:that\s+generation|boomer|old\s+people\s+just)\b[^.!?\n]{0,40}\b(?:don'?t\s+(?:get|understand)|are\s+wrong)\b/gi,
    reason: 'Generational contempt.',
  },
  // future_self
  {
    audience: 'future_self',
    pattern:
      /\b(?:you\s+can\s+always\s+(?:undo|reverse|fix)\s+(?:this|it)|don'?t\s+worry\s+about\s+the\s+future|live\s+for\s+today)\b/gi,
    reason: 'Dismisses long-term consequences.',
  },
  {
    audience: 'future_self',
    pattern:
      /\b(?:burn\s+(?:the\s+)?(?:bridges?|boats?|relationship|career|job|reputation)|cut\s+(?:everyone|everything|them|the\s+family)\s+off|never\s+speak\s+(?:to|with)\s+(?:them|him|her)\s+again|burn\s+the\s+relationship\s+to\s+the\s+ground|no\s+coming\s+back\s+from\s+this|just\s+quit\s+today)\b/gi,
    reason: 'Recommends irreversible action without exploring alternatives.',
  },
]);

export interface FamilyTableInputs {
  draft_text: string;
}

export function familyTableTest(inputs: FamilyTableInputs): FamilyTableResult {
  const failures: FamilyTableResult['failures'] = [];
  for (const c of CHECKS) {
    const re = new RegExp(c.pattern.source, c.pattern.flags);
    if (re.test(inputs.draft_text)) {
      failures.push({ audience: c.audience, reason: c.reason });
    }
  }
  // Dignity-violation detection — if the response itself ridicules,
  // shames, or holds the user in contempt, no audience would be proud
  // to be near it.
  const contains_dignity_violation =
    /\b(?:idiot|moron|stupid|loser|pathetic|how\s+ridiculous|shame\s+on\s+you)\b/i.test(
      inputs.draft_text
    );
  if (contains_dignity_violation) {
    failures.push({
      audience: 'future_self',
      reason: 'Response contains dignity-violating language.',
    });
  }
  return {
    passes: failures.length === 0,
    failures,
    contains_dignity_violation,
  };
}

export const __test = { CHECKS };
