/**
 * Constructive Guidance Obligation — Sprint N.3 Phase 7.
 *
 * A blocked or refused response must never end with "I can't help
 * with that." Instead, every refusal must:
 *
 *   1. Decline the unsafe assistance.
 *   2. Identify the likely underlying need.
 *   3. Preserve the user's dignity.
 *   4. Offer lawful alternatives.
 *   5. Expand the user's future options.
 *   6. Provide a concrete constructive next step.
 *
 * This module produces that envelope deterministically. The output
 * is not creative writing — it's a contract.
 */

export type RefusalCategory =
  | 'illegal_activity'
  | 'self_harm'
  | 'harm_to_others'
  | 'fraud'
  | 'crisis'
  | 'unsafe_medical'
  | 'unsafe_legal'
  | 'partner_bias'
  | 'conflict_of_interest'
  | 'manipulation'
  | 'unverified_medical'
  | 'political_influence'
  | 'general';

export interface ConstructiveGuidanceInputs {
  category: RefusalCategory;
  /** Optional context: the user's apparent underlying need. */
  underlying_need?: string;
}

export interface ConstructiveGuidance {
  acknowledgement: string;
  underlying_need: string;
  refusal: string;
  alternatives: string[];
  next_step: string;
  full_text: string;
}

// ---------------------------------------------------------------------------
// Category-specific templates
// ---------------------------------------------------------------------------

interface Template {
  underlying_need: string;
  alternatives: string[];
  next_step: string;
  refusal_phrase: string;
}

const TEMPLATES: Record<RefusalCategory, Template> = {
  illegal_activity: {
    underlying_need: 'You may be looking for a fast way to solve a difficult problem.',
    alternatives: [
      'Talk to a licensed attorney about the lawful options for the situation.',
      'Document the underlying problem in writing so a professional can advise on it.',
      'Explore the legitimate dispute-resolution or regulatory path available to you.',
    ],
    next_step:
      'Identify the lawful objective behind your request and we can think through it together.',
    refusal_phrase: 'I cannot help with anything outside the law.',
  },
  self_harm: {
    underlying_need: 'You may be feeling overwhelmed, isolated, or in deep emotional pain.',
    alternatives: [
      'If you are in the United States, call or text 988 — the Suicide and Crisis Lifeline.',
      'Reach out to a person you trust — a family member, friend, clinician, clergy, or coach.',
      'If you are in immediate danger, call your local emergency services.',
    ],
    next_step: 'Please talk to one human in your life today — anyone — before doing anything else.',
    refusal_phrase: "I will not help with anything that puts you in harm's way.",
  },
  harm_to_others: {
    underlying_need: 'You may feel wronged, threatened, or unheard.',
    alternatives: [
      'If you are in danger, contact law enforcement or a domestic-violence hotline.',
      'A licensed attorney or mediator can pursue the lawful remedy you deserve.',
      'A clinician or coach can help you process the feelings the situation is producing.',
    ],
    next_step:
      'Describe what outcome you actually need — safety, accountability, distance, repair — and we can find a constructive path.',
    refusal_phrase: 'I will not help with anything that endangers another person.',
  },
  fraud: {
    underlying_need: 'You may be facing financial pressure or feeling cornered by an institution.',
    alternatives: [
      'Talk to a credit counselor or CPA about the legitimate options available.',
      'Many institutions have hardship programs you may qualify for.',
      'Document the situation in writing — that record is often the basis for relief.',
    ],
    next_step: 'Tell me what the underlying pressure is and we can explore the legitimate routes.',
    refusal_phrase: 'I cannot help with deceptive or fraudulent actions.',
  },
  crisis: {
    underlying_need: 'You may be in significant emotional distress right now.',
    alternatives: [
      'If you are in the United States, dial or text 988 for the Suicide and Crisis Lifeline.',
      'Contact someone you trust to be with you — even on the phone.',
      'If you are unsafe, call your local emergency number.',
    ],
    next_step:
      'Please make one call today — to someone, anyone — and let them know how you are doing.',
    refusal_phrase: 'Your safety is the priority before anything else we work on.',
  },
  unsafe_medical: {
    underlying_need:
      'You may be trying to manage a medical condition without the support you need.',
    alternatives: [
      'Reach out to your prescribing clinician — even a short message can change a treatment plan.',
      'If cost is the obstacle, ask about generics, patient assistance programs, or sliding-scale clinics.',
      'A pharmacist can often answer questions about dose, timing, and interactions free of charge.',
    ],
    next_step: 'Send a message to your clinician describing what you are experiencing.',
    refusal_phrase:
      'I cannot give medical advice that conflicts with what a clinician would prescribe.',
  },
  unverified_medical: {
    underlying_need: 'You may be looking for an answer that the internet cannot reliably give.',
    alternatives: [
      'A primary-care visit or telehealth appointment can give you a reliable answer faster than search.',
      "Use vetted clinical resources (e.g. your insurer's nurse line) rather than open forums.",
      'If you are uninsured, your local health department or a community clinic is a starting point.',
    ],
    next_step: 'Write down the specific symptoms you want answered and bring them to a clinician.',
    refusal_phrase: 'I cannot confirm clinical claims I cannot verify.',
  },
  unsafe_legal: {
    underlying_need: 'You may be navigating a high-stakes legal situation without representation.',
    alternatives: [
      'Most local bar associations run a low-cost or pro-bono referral service.',
      'Legal aid clinics handle qualifying matters at no charge.',
      'Even a single paid consult can clarify whether you need ongoing representation.',
    ],
    next_step:
      'Identify the jurisdiction and the matter, then contact a lawyer before taking any action.',
    refusal_phrase: 'Legal strategy for a real matter belongs with a licensed attorney.',
  },
  partner_bias: {
    underlying_need: "You deserve recommendations that serve your interests, not a vendor's.",
    alternatives: [
      'Ask for the recommendation criteria so you can compare options independently.',
      'Get a second opinion from a source with no financial stake.',
      'Look for the underlying outcome you want and search for the best fit on that outcome.',
    ],
    next_step:
      "Let's rank the candidates by the outcome that matters most to you, not by who is selling them.",
    refusal_phrase: "I will not steer you toward an option for a partner's benefit.",
  },
  conflict_of_interest: {
    underlying_need: 'You need advice from a source whose interests align with yours.',
    alternatives: [
      'Get a fee-only or fiduciary professional for the decision.',
      'Disclose the conflict to the person involved and ask for an independent voice.',
      'Pause irreversible decisions until the conflict is cleared.',
    ],
    next_step:
      'Tell me the decision you actually need and we will think through it without the conflict.',
    refusal_phrase: 'I will not give guidance shaped by a conflict of interest.',
  },
  manipulation: {
    underlying_need: 'You may want a more cooperative relationship with someone in your life.',
    alternatives: [
      'Articulate what you actually want from the relationship and ask for it directly.',
      'A neutral third party (mediator, therapist, coach) can help if the conversation is stuck.',
      'Give the relationship time and consistency rather than pressure.',
    ],
    next_step:
      'Tell me what outcome you want with this person and we can think about how to ask for it honestly.',
    refusal_phrase: "I will not help with persuasion that bypasses the other person's judgement.",
  },
  political_influence: {
    underlying_need: 'You may be looking for a way to think about a public issue.',
    alternatives: [
      'I can lay out the strongest version of multiple positions for you to weigh.',
      'I can summarize the evidence rather than tell you what conclusion to reach.',
      'I can help you ask better questions of candidates or sources.',
    ],
    next_step:
      "Tell me the underlying question and I'll explain the trade-offs without picking a side.",
    refusal_phrase: 'I will not advocate for a political candidate, party, or ideology.',
  },
  general: {
    underlying_need: 'You may want help with something I cannot do safely as currently framed.',
    alternatives: [
      'Reframe the request in terms of the outcome you want.',
      'Talk to a qualified professional for the substance of the matter.',
      'Break the problem into smaller pieces — I can help with each one.',
    ],
    next_step:
      'Tell me what you actually want to achieve and I will help with the lawful, safe path to it.',
    refusal_phrase: 'I am not able to help with the request as currently framed.',
  },
};

export function composeConstructiveGuidance(
  inputs: ConstructiveGuidanceInputs
): ConstructiveGuidance {
  const t = TEMPLATES[inputs.category] ?? TEMPLATES.general;
  const acknowledgement =
    'Thank you for trusting me with this. I want to be useful — and to be useful, I have to be honest.';
  const underlying_need = inputs.underlying_need ?? t.underlying_need;
  const refusal = t.refusal_phrase;
  const alternatives = t.alternatives;
  const next_step = t.next_step;

  const full_text =
    `${acknowledgement}\n\n` +
    `${underlying_need}\n\n` +
    `${refusal}\n\n` +
    `Here are constructive paths forward:\n` +
    alternatives.map((a) => `  • ${a}`).join('\n') +
    `\n\nNext step: ${next_step}`;

  return { acknowledgement, underlying_need, refusal, alternatives, next_step, full_text };
}

export const __test = { TEMPLATES };
