/**
 * Safety Messaging Framework — Sprint L Phase 8.
 *
 * Deterministic safety copy per violation category. The TS layer
 * ships a built-in dictionary so the system functions even when the
 * `governance.safety_messages` SQL table is empty. The DB table is
 * preferred when present — the API route prefers DB, falls back here.
 *
 * IMPORTANT: messages are STATIC text. No LLM is allowed to mutate
 * them. The category enum is exhaustive.
 */

import type { GovernanceViolation, SaferAlternative, ViolationCategory } from '@/types/governance';

export interface SafetyMessage {
  category: ViolationCategory;
  message: string;
  safer_alternatives: SaferAlternative[];
}

const BUILTIN: Record<ViolationCategory, SafetyMessage> = {
  self_harm: {
    category: 'self_harm',
    message:
      'I cannot assist with self-harm. Please consider reaching out to a qualified mental-health professional or a crisis line you trust. ' +
      'If you are in immediate danger, contact local emergency services.',
    safer_alternatives: [
      {
        label: 'Reach out to a trusted person',
        description: 'A family member, friend, or clinician.',
      },
      { label: 'Call or text a local crisis line' },
      { label: 'Visit your nearest emergency department' },
    ],
  },
  harm_to_others: {
    category: 'harm_to_others',
    message:
      'I cannot help with actions intended to harm another person. If you are in conflict, consider safer paths.',
    safer_alternatives: [
      { label: 'Document the situation in writing' },
      { label: 'Engage a mediator or counselor' },
      { label: 'Contact relevant authorities or legal counsel' },
    ],
  },
  illegal_activity: {
    category: 'illegal_activity',
    message:
      'I cannot help with illegal activity. Here are lawful alternatives that may achieve the same underlying goal.',
    safer_alternatives: [],
  },
  fraud: {
    category: 'fraud',
    message:
      'I cannot help with fraud, evasion, or concealment. I can help you find every lawful advantage the rules permit.',
    safer_alternatives: [
      { label: 'Legal tax planning' },
      { label: 'Benefits and credit optimization' },
      { label: 'Disclosure-compliant restructuring' },
    ],
  },
  exploitation: {
    category: 'exploitation',
    message: 'I cannot help with actions that exploit another person.',
    safer_alternatives: [],
  },
  political_influence: {
    category: 'political_influence',
    message:
      'I can explain or compare political positions factually, but I will not advocate parties, candidates, or ideologies.',
    safer_alternatives: [
      { label: 'Compare positions on a specific policy' },
      { label: 'Show factual records or voting history' },
      { label: 'Summarize differing viewpoints' },
    ],
  },
  manipulation: {
    category: 'manipulation',
    message: 'I will not use pressure, shame, guilt, or manipulation. Decisions are yours.',
    safer_alternatives: [],
  },
  coercive_messaging: {
    category: 'coercive_messaging',
    message:
      'This message contained coercive language. I will rewrite it as neutral information so the decision remains yours.',
    safer_alternatives: [],
  },
  partner_bias: {
    category: 'partner_bias',
    message:
      'This recommendation appeared influenced by partner economics. We are suppressing it and showing partner-neutral alternatives instead.',
    safer_alternatives: [],
  },
  conflict_of_interest: {
    category: 'conflict_of_interest',
    message:
      'A conflict of interest was detected. The recommending party has a financial relationship with the outcome.',
    safer_alternatives: [],
  },
  unsafe_health: {
    category: 'unsafe_health',
    message:
      'This guidance requires evaluation by a licensed healthcare professional before any action. We will not act as a substitute.',
    safer_alternatives: [],
  },
  unverified_medical: {
    category: 'unverified_medical',
    message:
      'This medical claim is not adequately supported by published evidence. We do not surface unverified medical guidance.',
    safer_alternatives: [],
  },
  outcome_integrity: {
    category: 'outcome_integrity',
    message:
      'This recommendation appeared to optimize platform engagement rather than your outcomes. We are suppressing it.',
    safer_alternatives: [],
  },
  user_advocacy: {
    category: 'user_advocacy',
    message:
      'This recommendation appeared to optimize for a non-user party. We are suppressing it.',
    safer_alternatives: [],
  },
  transparency: {
    category: 'transparency',
    message:
      'This recommendation did not expose its assumptions, confidence, or tradeoffs. We are routing it back for explanation before showing it.',
    safer_alternatives: [],
  },
  agent_not_registered: {
    category: 'agent_not_registered',
    message:
      'A non-registered agent attempted to emit guidance. Only registered agents may communicate recommendations to the user.',
    safer_alternatives: [],
  },
  unknown: {
    category: 'unknown',
    message: 'A governance issue was detected.',
    safer_alternatives: [],
  },
};

export function safetyMessageFor(category: ViolationCategory): SafetyMessage {
  return BUILTIN[category] ?? BUILTIN.unknown;
}

/**
 * Build a single user-facing message from a list of violations.
 * The message names the worst category and lists distinct safer
 * alternatives across all violations.
 *
 * Deterministic.
 */
export function composeBlockMessage(violations: GovernanceViolation[]): SafetyMessage {
  if (violations.length === 0) {
    return BUILTIN.unknown;
  }
  // Pick the worst category by severity (already sorted by engine).
  const top = violations[0];
  const base = safetyMessageFor(top.category);
  const extras = violations.flatMap((v) => v.safer_alternatives ?? []);
  const merged = [...base.safer_alternatives, ...extras];
  const dedup = new Map<string, SaferAlternative>();
  for (const a of merged) {
    const k = `${a.label}::${a.description ?? ''}`;
    if (!dedup.has(k)) dedup.set(k, a);
  }
  return {
    category: top.category,
    message: base.message,
    safer_alternatives: Array.from(dedup.values()),
  };
}

export const __test = { BUILTIN, safetyMessageFor, composeBlockMessage };
