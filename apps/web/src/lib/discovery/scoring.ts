/**
 * Driver scoring for the Root-Goal Discovery Engine.
 *
 * Given the user's stated answers across one or more discovery turns,
 * produces normalized 0..1 scores for the three canonical drivers:
 *
 *   - financial_security  — safety, stability, family protection,
 *                            retirement, debt freedom, emergency prep, cash flow
 *   - image               — appearance, confidence, status, recognition,
 *                            prestige, social perception
 *   - performance         — productivity, achievement, athletic perf,
 *                            entrepreneurship, promotion, business growth,
 *                            competitive advantage
 *
 * The scorer is pure (deterministic) so it can run client- or server-side
 * and is fully unit-testable without an LLM. An LLM can replace or augment
 * this scorer through the adapter interface in lib/discovery/engine.ts
 * without changing any caller.
 */

import type { Driver, DriverScores } from '@/types/discovery';

interface KeywordBank {
  financial_security: string[];
  image: string[];
  performance: string[];
}

/**
 * Lowercased keyword bank. Each match contributes one "hit" to that
 * driver's tally; the final score is hits / max(hitsAcrossDrivers).
 *
 * Phrases must be lowercase. Multi-word phrases are matched as substrings.
 */
const KEYWORDS: KeywordBank = {
  financial_security: [
    'safe',
    'safety',
    'security',
    'secure',
    'stability',
    'stable',
    'protect',
    'protection',
    'protected',
    'family',
    'kids',
    'children',
    'dependents',
    'parents',
    'retire',
    'retirement',
    'debt',
    'debt-free',
    'pay off',
    'payoff',
    'emergency',
    'rainy day',
    'cash flow',
    'income',
    'savings',
    'save',
    'peace of mind',
    'sleep at night',
    'cover',
    'cover the bills',
    'cover expenses',
    'longevity',
    'long-term',
    'inheritance',
    'legacy',
    'estate',
  ],
  image: [
    'look',
    'looks',
    'looking',
    'appearance',
    'appear',
    'confidence',
    'confident',
    'attractive',
    'attraction',
    'prestige',
    'prestigious',
    'status',
    'reputation',
    'recognition',
    'recognized',
    'recognised',
    'social',
    'perception',
    'impress',
    'impressive',
    'admire',
    'admiration',
    'respect',
    'brand',
    'personal brand',
    'mirror',
    'feel good',
    'visible',
    'visibility',
    'photo',
    'photos',
    'pictures',
    'wedding',
    'reunion',
  ],
  performance: [
    'perform',
    'performance',
    'productivity',
    'productive',
    'achieve',
    'achievement',
    'achiever',
    'compete',
    'competitive',
    'competition',
    'athletic',
    'athlete',
    'stronger',
    'faster',
    'better',
    'promotion',
    'promoted',
    'grow',
    'growth',
    'scale',
    'business',
    'entrepreneur',
    'startup',
    'venture',
    'launch',
    'ship',
    'beat',
    'beat my',
    'personal record',
    'optimize',
    'optimization',
    'maximize',
    'maximise',
    'output',
    'win',
    'winning',
    'edge',
    'advantage',
    'rank',
    'ranked',
  ],
};

/**
 * Some answers carry explicit signals stronger than keyword counts. This
 * boost layer lets us override or amplify when the user says things like
 * "I want to be the best in the world" → strong performance signal.
 */
const STRONG_SIGNALS: Array<{ pattern: RegExp; driver: Driver; weight: number }> = [
  {
    pattern: /\b(my\s+kids|my\s+children|provide\s+for)\b/i,
    driver: 'financial_security',
    weight: 2,
  },
  { pattern: /\b(financial\s+independence|fire)\b/i, driver: 'financial_security', weight: 2 },
  { pattern: /\b(retire\s+early|early\s+retirement)\b/i, driver: 'financial_security', weight: 2 },
  {
    pattern: /\b(go\s+broke|run\s+out\s+of\s+money|losing\s+everything)\b/i,
    driver: 'financial_security',
    weight: 2,
  },
  { pattern: /\b(look\s+(good|better)|how\s+i\s+look)\b/i, driver: 'image', weight: 2 },
  { pattern: /\b(in\s+the\s+mirror)\b/i, driver: 'image', weight: 2 },
  { pattern: /\b(beach\s+body|swimsuit|wedding)\b/i, driver: 'image', weight: 2 },
  {
    pattern: /\b(promot(ed|ion)|staff\s+engineer|principal\s+engineer|vp\s+role)\b/i,
    driver: 'performance',
    weight: 2,
  },
  {
    pattern: /\b(start\s+a\s+business|launch\s+a\s+(company|startup))\b/i,
    driver: 'performance',
    weight: 2,
  },
  {
    pattern: /\b(beat\s+my\s+pr|set\s+a\s+pr|world\s+record|podium)\b/i,
    driver: 'performance',
    weight: 2,
  },
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countMatches(text: string, phrases: string[]): number {
  if (!text) return 0;
  const t = text.toLowerCase();
  let hits = 0;
  for (const p of phrases) {
    if (!p) continue;
    // Word-boundary match so 'pr' doesn't hit inside 'protect'.
    // Allow hyphens and apostrophes inside multi-word phrases.
    const needle = escapeRe(p.toLowerCase());
    const re = new RegExp(`(?:^|[^a-z0-9'])${needle}(?=$|[^a-z0-9'])`, 'g');
    const matches = t.match(re);
    if (matches) hits += matches.length;
  }
  return hits;
}

/**
 * Score a single answer in isolation. Useful for per-turn diagnostics.
 */
export function scoreAnswer(answer: string): DriverScores {
  const fs = countMatches(answer, KEYWORDS.financial_security);
  const im = countMatches(answer, KEYWORDS.image);
  const pf = countMatches(answer, KEYWORDS.performance);

  // Apply strong-signal boosts.
  const boosts: Record<Driver, number> = { financial_security: 0, image: 0, performance: 0 };
  for (const { pattern, driver, weight } of STRONG_SIGNALS) {
    if (pattern.test(answer)) boosts[driver] += weight;
  }

  const rawFs = fs + boosts.financial_security;
  const rawIm = im + boosts.image;
  const rawPf = pf + boosts.performance;
  const max = Math.max(rawFs, rawIm, rawPf, 1); // avoid divide by zero

  return {
    financial_security: rawFs / max,
    image: rawIm / max,
    performance: rawPf / max,
  };
}

/**
 * Accumulate scores across all turns of a session. Recent turns count
 * slightly more (linear decay), reflecting that the user's later, more
 * reflective answers usually expose their real driver.
 */
export function accumulateScores(answers: Array<{ text: string; index: number }>): DriverScores {
  if (answers.length === 0) {
    return { financial_security: 0, image: 0, performance: 0 };
  }

  let totalFs = 0;
  let totalIm = 0;
  let totalPf = 0;
  const maxIndex = Math.max(...answers.map((a) => a.index));

  for (const { text, index } of answers) {
    // Weight: 1.0 for the most recent, scaled down to 0.5 for the first.
    const weight = 0.5 + 0.5 * (maxIndex === 0 ? 1 : index / maxIndex);
    const s = scoreAnswer(text);
    totalFs += s.financial_security * weight;
    totalIm += s.image * weight;
    totalPf += s.performance * weight;
  }

  const max = Math.max(totalFs, totalIm, totalPf, 1);
  return {
    financial_security: totalFs / max,
    image: totalIm / max,
    performance: totalPf / max,
  };
}

/**
 * Resolve dominant + secondary driver from accumulated scores. Returns
 * `null` when scores are all zero (caller should keep drilling).
 */
export function dominantDrivers(scores: DriverScores): {
  dominant: Driver | null;
  secondary: Driver | null;
} {
  const ranked = (Object.entries(scores) as Array<[Driver, number]>).sort((a, b) => b[1] - a[1]);

  const top = ranked[0];
  const second = ranked[1];

  if (!top || top[1] === 0) return { dominant: null, secondary: null };
  // Secondary only counts if it's non-trivial.
  const secondary = second && second[1] > 0.25 ? second[0] : null;
  return { dominant: top[0], secondary };
}

/**
 * Confidence in the dominant-driver call.
 *
 *   - 0 when there are no signals (drill more)
 *   - rises with both the magnitude of the top score and the *gap* to the
 *     second-place score (a clear winner is high-confidence)
 *   - also rises with the number of turns we've already collected (more
 *     data = more confident, even if the signals are softer)
 */
export function driverConfidence(scores: DriverScores, turnsCollected: number): number {
  const values = (Object.values(scores) as number[]).sort((a, b) => b - a);
  const top = values[0] ?? 0;
  const second = values[1] ?? 0;
  if (top === 0) return 0;
  const gap = top - second;
  // Magnitude contributes 0..0.5 of confidence; gap contributes 0..0.3;
  // turns contribute 0..0.2 (capped at 4 turns).
  const magScore = Math.min(top, 1) * 0.5;
  const gapScore = Math.min(gap / 0.5, 1) * 0.3;
  const turnScore = Math.min(turnsCollected / 4, 1) * 0.2;
  return Math.min(magScore + gapScore + turnScore, 1);
}
