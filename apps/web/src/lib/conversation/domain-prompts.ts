/**
 * Domain prompt library — per-domain drill-down templates.
 *
 * Five domains × prompts at each depth (0 = stated_goal,
 * 1 = what_unlock, 2 = why_important, plus closing prompts
 * for success_definition / consequence_of_inaction / urgency).
 *
 * Each prompt has driver-tuned variants so the question feels
 * appropriate to a financial-security-driven user vs a performance-
 * driven user. (The selection is read-only; it cannot change the
 * recommendation — that's the no-manipulation contract.)
 *
 * All prompts are deterministic strings keyed by
 * `(domain, prompt_kind, driver?)`. There is no LLM in this layer.
 */

import type { DiscoveryDomain, DominantDriver, PromptKind } from '@/types/conversation-intel';

type PromptKey = `${DiscoveryDomain}::${PromptKind}::${DominantDriver | 'neutral'}`;

// ---------------------------------------------------------------------------
// Prompt catalog
// ---------------------------------------------------------------------------

const PROMPTS: Partial<Record<PromptKey, string>> = {
  // ===== FINANCIAL =====
  'financial::what_accomplish::neutral':
    'What does the financial picture you want look like — and what would having it actually change about your day-to-day?',
  'financial::what_accomplish::financial_security':
    'When you imagine having "enough" financially, what does that picture look like for you and the people you care about?',
  'financial::what_accomplish::image':
    'When you picture the financial position you want, who notices first — and what does that mean to you?',
  'financial::what_accomplish::performance':
    'What financial outcome would feel like an unambiguous win to you?',
  'financial::what_unlock::neutral':
    'If you reached that level of financial position, what would it unlock that isn’t possible today?',
  'financial::what_unlock::financial_security':
    'If money stopped being a worry, what would you actually stop doing? And what would you start?',
  'financial::what_unlock::image':
    'When you’ve hit that number, what choice do you finally get to make publicly that isn’t available today?',
  'financial::what_unlock::performance':
    'Once that’s achieved, what bigger ambition becomes the next reasonable target?',
  'financial::why_important::neutral': 'Why does that outcome matter to you specifically?',
  'financial::why_important::financial_security':
    'Where does that drive for safety come from for you?',
  'financial::why_important::image':
    'Who in your life are you most aware of when you think about this?',
  'financial::why_important::performance':
    'What standard are you measuring yourself against here, and where did that standard come from?',
  'financial::success_definition::neutral':
    'How will you know — concretely — when you’ve actually arrived?',
  'financial::consequence_of_inaction::neutral':
    'If nothing changes in the next 12-24 months, what happens?',
  'financial::urgency::neutral': 'When does this need to be true — and what’s driving that timing?',

  // ===== CAREER =====
  'career::what_accomplish::neutral':
    'What does your career look like at its highest realistic point in the next 5-10 years?',
  'career::what_accomplish::financial_security':
    'What career trajectory would make the rest of your financial life unhurried?',
  'career::what_accomplish::image':
    'When you describe your title and role at peak, what does that signal to the people whose opinion you most respect?',
  'career::what_accomplish::performance':
    'What level would you have to reach for it to feel like you’re actually playing at your ceiling?',
  'career::what_unlock::neutral':
    'When you’re in that role, what becomes possible that isn’t today?',
  'career::what_unlock::financial_security':
    'At that career level, what financial unknowns go away?',
  'career::what_unlock::image': 'At that level, who do you become known as?',
  'career::what_unlock::performance':
    'Once you’re there, what next-level problem do you finally get to work on?',
  'career::why_important::neutral':
    'Why does this trajectory matter more than a comfortable alternative?',
  'career::why_important::performance':
    'What is the version of yourself you’re trying to become through this work?',
  'career::success_definition::neutral':
    'What does the resume / title / impact look like at that point?',
  'career::consequence_of_inaction::neutral':
    'If your career stays at its current trajectory, what specifically would you regret?',
  'career::urgency::neutral':
    'What’s your honest timeline for getting there — and what makes it that timeline?',

  // ===== HEALTH =====
  'health::what_accomplish::neutral':
    'What does "thriving" physically look like for you over the next 1-3 years?',
  'health::what_accomplish::financial_security':
    'What state of health do you need to be in to know your future medical risks are managed?',
  'health::what_accomplish::image':
    'When you’re at that health peak, what changes about how you carry yourself in the world?',
  'health::what_accomplish::performance':
    'What’s the physical performance bar you’re actually aiming for?',
  'health::what_unlock::neutral':
    'What does being at that level of health let you do that you can’t today?',
  'health::what_unlock::financial_security':
    'How does that level of health change your long-term financial picture?',
  'health::what_unlock::performance':
    'At that fitness level, what new challenges become reasonable targets?',
  'health::why_important::neutral': 'Why does that physical state matter to you right now?',
  'health::why_important::financial_security':
    'What about your family health history is shaping this for you?',
  'health::why_important::performance': 'What standard or person are you measuring against?',
  'health::success_definition::neutral':
    'What specific number or capability would tell you you’re there (VO2max, strength, body composition, energy, sleep)?',
  'health::consequence_of_inaction::neutral':
    'If your health trajectory keeps drifting, what does life at 60 look like?',
  'health::urgency::neutral':
    'Is there a specific event, deadline, or window driving this for you?',

  // ===== EDUCATION =====
  'education::what_accomplish::neutral':
    'What credential, degree, or skill are you targeting — and what does that get you?',
  'education::what_accomplish::financial_security':
    'What education or credential would meaningfully lower your career or income risk?',
  'education::what_accomplish::image':
    'When you have that credential, how does the world treat you differently?',
  'education::what_accomplish::performance':
    'What credential do you need to operate at the level you want to play at?',
  'education::what_unlock::neutral':
    'Once you have that credential, what concretely becomes available?',
  'education::why_important::neutral':
    'Why is this credential the right lever, rather than experience or a different path?',
  'education::why_important::image':
    'Who in your circle would notice this credential — and what does that mean?',
  'education::success_definition::neutral':
    'What does "done" look like — accepted, enrolled, completed, certified, or hired into?',
  'education::consequence_of_inaction::neutral':
    'If you don’t pursue this, what doors close — for how long?',
  'education::urgency::neutral':
    'Is there a deadline driving this (employer reimbursement window, application cycle, life-stage)?',

  // ===== ESTATE =====
  'estate::what_accomplish::neutral':
    'What do you want to be true about your estate the day after you’re gone?',
  'estate::what_accomplish::financial_security':
    'What protection do you want in place for the people who depend on you — even if something happens tomorrow?',
  'estate::what_accomplish::image':
    'What do you want the people closest to you to say about how you handled this?',
  'estate::what_accomplish::performance':
    'Beyond just the basics, what advanced estate-planning outcome are you aiming for?',
  'estate::what_unlock::neutral': 'When that’s in place, what worry actually goes away?',
  'estate::why_important::neutral': 'Why does it matter that this is done — and done now?',
  'estate::why_important::financial_security':
    'Who specifically are you protecting — and from what?',
  'estate::success_definition::neutral':
    'What’s the concrete checklist for "estate plan complete" in your case?',
  'estate::consequence_of_inaction::neutral':
    'If something happens before this is in place, what specifically would go wrong for your family?',
  'estate::urgency::neutral':
    'What’s the realistic timeline for getting these documents signed and notarized?',

  // ===== GENERAL fallback =====
  'general::what_accomplish::neutral': 'In the simplest terms — what do you actually want?',
  'general::what_unlock::neutral': 'If you had that, what would it actually change for you?',
  'general::why_important::neutral': 'Why does that matter to you?',
  'general::success_definition::neutral': 'How would you know when you’ve really gotten it?',
  'general::consequence_of_inaction::neutral': 'What happens if you don’t pursue this?',
  'general::urgency::neutral': 'When does this need to be true?',
};

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export function selectPrompt(
  domain: DiscoveryDomain,
  kind: PromptKind,
  driver?: DominantDriver
): string {
  const tryKey = (d: DominantDriver | 'neutral') =>
    PROMPTS[`${domain}::${kind}::${d}` as PromptKey];

  return (
    (driver && tryKey(driver)) ??
    tryKey('neutral') ??
    PROMPTS[`general::${kind}::neutral` as PromptKey] ??
    'Tell me more about what you’re looking for here.'
  );
}

/**
 * Pick the next prompt_kind based on current_depth + status.
 *
 *   depth 0 → what_accomplish
 *   depth 1 → what_unlock
 *   depth 2 → why_important
 *   depth 3 → success_definition  (closing)
 *   depth 4 → consequence_of_inaction  (closing — only if needed)
 *   beyond → confirmation
 */
export function nextPromptKind(currentDepth: number, max_depth = 3): PromptKind {
  const d = Math.max(0, currentDepth);
  if (d === 0) return 'what_accomplish';
  if (d === 1) return 'what_unlock';
  if (d >= 2 && d <= max_depth) return 'why_important';
  if (d === max_depth + 1) return 'success_definition';
  if (d === max_depth + 2) return 'consequence_of_inaction';
  return 'confirmation';
}

export const __test = { PROMPTS, selectPrompt, nextPromptKind };
