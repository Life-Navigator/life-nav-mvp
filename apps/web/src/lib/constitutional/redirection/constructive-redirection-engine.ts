/**
 * ConstructiveRedirectionEngine — Sprint L2.
 *
 * Never merely refuses. Never validates harmful objectives.
 * Instead:
 *   1. Reject the unsafe objective.
 *   2. Identify the likely underlying need.
 *   3. Explain future consequences.
 *   4. Present lawful alternatives.
 *   5. Present safer alternatives.
 *   6. Present future-preserving alternatives.
 *   7. (Orchestrator) Re-run governance review.
 *
 * Canonical patterns from the Sprint L2 spec:
 *   Revenge       → Closure, Respect, Justice, Recovery
 *   Embezzlement  → Financial Security, Business Capital, Wealth Building
 *   Violence      → Safety, Protection, Control
 *   Tax Evasion   → Wealth Preservation, Tax Planning, Asset Protection
 */

import type { ConstructiveRedirection, RedirectionAlternative } from '@/types/constitutional';

interface Pattern {
  /** Stable id used by the audit log. */
  id: string;
  /** Regex matched against the user request or draft. */
  match: RegExp;
  rejected_objective: string;
  underlying_need: string;
  future_consequences: string[];
  alternatives: RedirectionAlternative[];
}

const PATTERNS: Pattern[] = [
  // Revenge → Closure, Respect, Justice, Recovery
  {
    id: 'nbn.revenge_to_closure',
    match:
      /\b(?:revenge|get\s+even|make\s+(?:them|him|her)\s+pay|destroy\s+(?:his|her|their)\s+(?:reputation|career|life))\b/i,
    rejected_objective: 'inflicting harm in retaliation',
    underlying_need: 'closure, respect, justice, or recovery from a real loss',
    future_consequences: [
      'criminal exposure (harassment, stalking, assault)',
      'civil liability (defamation, intentional infliction of emotional distress)',
      'reputational damage that often outlasts the precipitating event',
      'extended preoccupation that delays real recovery',
    ],
    alternatives: [
      {
        kind: 'lawful',
        label: 'Closure',
        description:
          'Document the events in writing for yourself and one trusted person, then close the loop on your side.',
      },
      {
        kind: 'safer',
        label: 'Respect',
        description:
          'Decide which boundaries you will hold going forward and communicate them once, calmly.',
      },
      {
        kind: 'lawful',
        label: 'Justice',
        description:
          'If a law was broken, file a report. If a contract was breached, consult counsel. The legal system is slower but durable.',
      },
      {
        kind: 'future_preserving',
        label: 'Recovery',
        description:
          'Sleep, exercise, time with people who love you, and (often) a therapist or counselor. Recovery is the strongest revenge.',
      },
    ],
  },

  // Embezzlement → Financial Security, Business Capital, Wealth Building
  {
    id: 'nbn.embezzlement_to_capital',
    match:
      /\b(?:embezzle|skim\s+(?:funds|cash)\s+from|divert\s+(?:funds|payments)\s+to\s+my\s+(?:account|llc))\b/i,
    rejected_objective: 'misappropriating funds entrusted to you',
    underlying_need: 'financial security, business capital, or accelerated wealth building',
    future_consequences: [
      'felony criminal charges (state and federal embezzlement statutes)',
      'restitution + asset forfeiture',
      'permanent loss of fiduciary licensure and many career paths',
      'destruction of personal and professional relationships',
    ],
    alternatives: [
      {
        kind: 'lawful',
        label: 'Financial Security',
        description:
          'A lawful path: build an emergency fund, increase income, and reduce fixed costs. Slower; durable.',
      },
      {
        kind: 'lawful',
        label: 'Business Capital',
        description:
          'Raise capital through proper channels: revenue, SBA loans, angel investors, or grants.',
      },
      {
        kind: 'future_preserving',
        label: 'Wealth Building',
        description:
          'Long-horizon: tax-advantaged retirement accounts + low-cost index investing + skill development.',
      },
    ],
  },

  // Violence → Safety, Protection, Control
  {
    id: 'nbn.violence_to_safety',
    match:
      /\b(?:i\s+(?:want|am\s+going)\s+to\s+(?:kill|hurt|attack|assault|stab|shoot|beat)\s+(?:him|her|them|someone))\b/i,
    rejected_objective: 'inflicting physical harm on another person',
    underlying_need: 'safety, protection, or restoration of control',
    future_consequences: [
      'arrest, prosecution, and incarceration',
      'permanent criminal record',
      'civil liability',
      'irreversible harm to relationships, freedom, and career',
    ],
    alternatives: [
      {
        kind: 'safer',
        label: 'Safety',
        description:
          'If you are in immediate danger, contact emergency services or a domestic-violence hotline. They are designed to act fast.',
      },
      {
        kind: 'lawful',
        label: 'Protection',
        description:
          'Restraining orders, no-contact orders, and police involvement are lawful protection paths.',
      },
      {
        kind: 'future_preserving',
        label: 'Control',
        description:
          'Therapists who specialize in trauma, anger, or DBT/CBT help people regain control without escalation.',
      },
    ],
  },

  // Tax Evasion → Wealth Preservation, Tax Planning, Asset Protection
  {
    id: 'nbn.tax_evasion_to_wealth_preservation',
    match:
      /\b(?:tax\s+evasion|hide\s+income\s+from\s+(?:the\s+)?(?:IRS|HMRC|tax)|unreported\s+income|under\s*report(?:ing)?\s+income|evade\s+(?:income\s+|capital\s+gains\s+)?tax(?:es)?)\b/i,
    rejected_objective: 'unreported income or other evasion of tax owed',
    underlying_need: 'wealth preservation, tax efficiency, or asset protection',
    future_consequences: [
      '26 USC § 7201 (felony tax evasion)',
      'civil fraud penalties of 75% of underpayment',
      'permanent IRS file flag + multi-year audits',
      'professional licensing loss for many regulated roles',
    ],
    alternatives: [
      {
        kind: 'lawful',
        label: 'Wealth Preservation',
        description: 'Tax-loss harvesting, charitable bunching, qualified retirement vehicles.',
      },
      {
        kind: 'lawful',
        label: 'Tax Planning',
        description:
          'A CPA or tax attorney can usually find lawful structure that captures most of the benefit you wanted.',
      },
      {
        kind: 'future_preserving',
        label: 'Asset Protection',
        description:
          'LLCs, trusts, and proper insurance — all disclosed — give durable protection.',
      },
    ],
  },

  // Stalking → Reconnection / Closure
  {
    id: 'nbn.stalking_to_reconnection',
    match:
      /\b(?:track\s+(?:my\s+)?ex\s+(?:without|secretly)|spy\s+on\s+(?:them|him|her)|monitor\s+(?:their|his|her)\s+location)\b/i,
    rejected_objective: 'surveilling another person without consent',
    underlying_need: 'reconnection, certainty, or closure',
    future_consequences: [
      'criminal stalking charges + protective orders against you',
      'civil liability for invasion of privacy',
      'permanent harm to the prospect of reconnection',
    ],
    alternatives: [
      {
        kind: 'lawful',
        label: 'Reach out once, openly',
        description:
          'One honest, low-pressure message. If they do not respond, that is information.',
      },
      {
        kind: 'safer',
        label: 'Mediated communication',
        description:
          'Therapists, mediators, or trusted mutual friends can hold a single conversation.',
      },
      {
        kind: 'future_preserving',
        label: 'Closure',
        description:
          'Time, distance, and your own life moving forward are the most reliable paths.',
      },
    ],
  },

  // Self-harm → Stabilization / Support
  {
    id: 'nbn.self_harm_to_stabilization',
    match:
      /\b(?:i\s+want\s+to\s+(?:die|end\s+(?:it|my\s+life))|i'?m\s+thinking\s+(?:of|about)\s+(?:suicide|suicidal))\b/i,
    rejected_objective: 'self-harm',
    underlying_need: 'relief from acute pain, exhaustion, or hopelessness',
    future_consequences: [
      'permanent loss of every future opportunity',
      'devastating impact on the people who love you, including those you cannot see right now',
    ],
    alternatives: [
      {
        kind: 'safer',
        label: 'Crisis support',
        description:
          'Crisis lines exist precisely for the moments when nothing feels viable. They are trained to help.',
      },
      {
        kind: 'safer',
        label: 'Trusted person',
        description:
          'Family, friend, clinician — even a single conversation often changes the texture of the night.',
      },
      {
        kind: 'future_preserving',
        label: 'Stabilize first, decide later',
        description:
          'Rest, food, hydration. Decisions made after 48 hours of sleep and one human conversation are different decisions.',
      },
    ],
  },
];

export interface RedirectionInputs {
  text: string;
}

export function detectRedirectionPattern(
  inputs: RedirectionInputs
): ConstructiveRedirection | null {
  const t = inputs.text ?? '';
  for (const p of PATTERNS) {
    if (p.match.test(t)) {
      return {
        rejected_objective: p.rejected_objective,
        underlying_need: p.underlying_need,
        future_consequences: p.future_consequences,
        alternatives: p.alternatives,
        framing: composeFraming(p),
      };
    }
  }
  return null;
}

function composeFraming(p: Pattern): string {
  const alts = p.alternatives.map((a) => `- ${a.label}: ${a.description}`).join('\n');
  return (
    `I can't help with ${p.rejected_objective}. ` +
    `That request often reflects a real underlying need — ${p.underlying_need}. ` +
    `If the original path is pursued, common consequences include:\n` +
    p.future_consequences.map((c) => `- ${c}`).join('\n') +
    `\n\nHere are paths that pursue the underlying need lawfully and preserve future options:\n` +
    alts
  );
}

export const __test = { detectRedirectionPattern, composeFraming, PATTERNS };
