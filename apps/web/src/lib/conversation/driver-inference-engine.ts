/**
 * DriverInferenceEngine — DETERMINISTIC.
 *
 * Scores each user utterance against the three Achieve Global drivers:
 *
 *   * Financial Security  — certainty, predictability, protection,
 *                            safety, fear of running out
 *   * Image               — recognition, status, legacy, validation,
 *                            how others perceive me
 *   * Performance         — progress, optimization, achievement,
 *                            mastery, exceeding own potential
 *
 * The engine is a hand-coded pattern matcher, NOT an LLM classifier.
 * Same text → same scores, every run. Confidence ramps up with the
 * number of consistent observations across a session.
 */

import type {
  DominantDriver,
  DriverInferenceResult,
  DriverScores,
} from '@/types/conversation-intel';

// ---------------------------------------------------------------------------
// Lexical patterns — each pattern carries a driver + weight.
// Multiple matches stack; the final per-turn score is normalized.
// ---------------------------------------------------------------------------

interface DriverPattern {
  pattern: RegExp;
  driver: DominantDriver;
  weight: number;
}

const PATTERNS: DriverPattern[] = [
  // ===== Financial Security =====
  { pattern: /\bsafe(ty)?\b/i, driver: 'financial_security', weight: 0.4 },
  { pattern: /\bsecur(e|ity)\b/i, driver: 'financial_security', weight: 0.5 },
  { pattern: /\bprotect(ion|ed|ing)?\b/i, driver: 'financial_security', weight: 0.4 },
  { pattern: /\bstabilit(y|ies)\b/i, driver: 'financial_security', weight: 0.4 },
  { pattern: /\bcertain(ty)?\b/i, driver: 'financial_security', weight: 0.3 },
  { pattern: /\bworr(y|ies|ied)\b/i, driver: 'financial_security', weight: 0.35 },
  { pattern: /\bfear\b/i, driver: 'financial_security', weight: 0.35 },
  { pattern: /\bafraid\b/i, driver: 'financial_security', weight: 0.35 },
  { pattern: /\brunning?\s+out\b/i, driver: 'financial_security', weight: 0.5 },
  { pattern: /\bsleep\s+at\s+night\b/i, driver: 'financial_security', weight: 0.6 },
  { pattern: /\bpeace\s+of\s+mind\b/i, driver: 'financial_security', weight: 0.6 },
  { pattern: /\bemergenc(y|ies)\b/i, driver: 'financial_security', weight: 0.4 },
  { pattern: /\bnest\s+egg\b/i, driver: 'financial_security', weight: 0.5 },
  {
    pattern:
      /\bprovid(e|ing)\s+for\s+(my\s+)?(family|kids|children|wife|husband|partner|spouse)\b/i,
    driver: 'financial_security',
    weight: 0.7,
  },
  {
    pattern: /\btake\s+care\s+of\s+(my\s+)?(family|kids|children|parents)\b/i,
    driver: 'financial_security',
    weight: 0.7,
  },
  { pattern: /\bnever\s+had\b/i, driver: 'financial_security', weight: 0.45 },
  { pattern: /\bgrowing\s+up\b/i, driver: 'financial_security', weight: 0.3 },

  // ===== Image =====
  { pattern: /\brespect(ed)?\b/i, driver: 'image', weight: 0.4 },
  { pattern: /\brecogni[sz](e|ed|tion)\b/i, driver: 'image', weight: 0.4 },
  { pattern: /\bstatus\b/i, driver: 'image', weight: 0.5 },
  { pattern: /\blegacy\b/i, driver: 'image', weight: 0.55 },
  { pattern: /\bproud\b/i, driver: 'image', weight: 0.35 },
  {
    pattern: /\b(what|how)\s+(people|others|they)\s+(think|see|view|perceive)\b/i,
    driver: 'image',
    weight: 0.6,
  },
  { pattern: /\bpeople\s+to\s+(see|know|notice|recognize)\b/i, driver: 'image', weight: 0.55 },
  { pattern: /\bsee\s+what\s+I\s+(built|did|made|created)\b/i, driver: 'image', weight: 0.55 },
  { pattern: /\b(my\s+)?reputation\b/i, driver: 'image', weight: 0.55 },
  { pattern: /\bvalidat(e|ion|ed)\b/i, driver: 'image', weight: 0.45 },
  { pattern: /\bprestig(e|ious)\b/i, driver: 'image', weight: 0.55 },
  { pattern: /\b(my\s+)?(brand|image)\b/i, driver: 'image', weight: 0.45 },
  { pattern: /\bset\s+(an?\s+)?example\b/i, driver: 'image', weight: 0.5 },
  { pattern: /\brole\s+model\b/i, driver: 'image', weight: 0.5 },
  { pattern: /\bproven?\s+myself\b/i, driver: 'image', weight: 0.45 },
  { pattern: /\bsuccess(ful)?\b/i, driver: 'image', weight: 0.35 },
  { pattern: /\bappear(s|ed|ance)?\b/i, driver: 'image', weight: 0.3 },

  // ===== Performance =====
  { pattern: /\bachieve(ment|d|s)?\b/i, driver: 'performance', weight: 0.45 },
  { pattern: /\boptim(al|ize|izing|ization)\b/i, driver: 'performance', weight: 0.55 },
  { pattern: /\bprogress\b/i, driver: 'performance', weight: 0.4 },
  { pattern: /\bmaster(y|ing)\b/i, driver: 'performance', weight: 0.5 },
  { pattern: /\bbest\s+version\s+of\b/i, driver: 'performance', weight: 0.55 },
  { pattern: /\bpush\s+myself\b/i, driver: 'performance', weight: 0.5 },
  { pattern: /\bperform(ance)?\b/i, driver: 'performance', weight: 0.4 },
  { pattern: /\b(my\s+)?potential\b/i, driver: 'performance', weight: 0.45 },
  { pattern: /\bgrow\s+(faster|stronger|more)\b/i, driver: 'performance', weight: 0.45 },
  { pattern: /\bmaximi[sz]e\b/i, driver: 'performance', weight: 0.5 },
  { pattern: /\b(personal|new)\s+(record|pr|best)\b/i, driver: 'performance', weight: 0.55 },
  { pattern: /\b(level\s+up|next\s+level)\b/i, driver: 'performance', weight: 0.5 },
  { pattern: /\bcompete\b/i, driver: 'performance', weight: 0.4 },
  { pattern: /\bchallenge\s+myself\b/i, driver: 'performance', weight: 0.45 },
  { pattern: /\bget\s+(faster|stronger|better)\b/i, driver: 'performance', weight: 0.45 },
  { pattern: /\bbeat\s+(my\s+)?own\b/i, driver: 'performance', weight: 0.5 },
];

// ---------------------------------------------------------------------------
// Pure scoring
// ---------------------------------------------------------------------------

const ZERO: DriverScores = { financial_security: 0, image: 0, performance: 0 };

export function scoreTurn(text: string): {
  scores: DriverScores;
  signals: DriverInferenceResult['signals'];
} {
  const t = (text ?? '').toString();
  if (!t.trim()) return { scores: { ...ZERO }, signals: [] };

  const signals: DriverInferenceResult['signals'] = [];
  const raw: DriverScores = { ...ZERO };

  for (const { pattern, driver, weight } of PATTERNS) {
    const m = t.match(pattern);
    if (m) {
      raw[driver] += weight;
      signals.push({ pattern: m[0], driver, weight });
    }
  }

  // Normalize: divide each by max-possible (cap at 1.0).
  const total = raw.financial_security + raw.image + raw.performance;
  if (total === 0) return { scores: { ...ZERO }, signals };
  const denom = Math.max(total, 1);
  return {
    scores: {
      financial_security: clamp01(raw.financial_security / denom),
      image: clamp01(raw.image / denom),
      performance: clamp01(raw.performance / denom),
    },
    signals,
  };
}

// ---------------------------------------------------------------------------
// Cumulative scoring across a session
// ---------------------------------------------------------------------------

export function combineDriverScores(history: DriverScores[]): DriverScores {
  if (history.length === 0) return { ...ZERO };
  const sum = history.reduce(
    (a, b) => ({
      financial_security: a.financial_security + b.financial_security,
      image: a.image + b.image,
      performance: a.performance + b.performance,
    }),
    { ...ZERO }
  );
  const n = history.length;
  return {
    financial_security: clamp01(sum.financial_security / n),
    image: clamp01(sum.image / n),
    performance: clamp01(sum.performance / n),
  };
}

export function pickDominantSecondary(scores: DriverScores): {
  dominant?: DominantDriver;
  secondary?: DominantDriver;
} {
  const ranked = (Object.entries(scores) as Array<[DominantDriver, number]>)
    .filter(([, v]) => v > 0.05)
    .sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return {};
  if (ranked.length === 1) return { dominant: ranked[0][0] };
  // If the top two are within 0.05 of each other, we don't declare a winner.
  if (ranked[0][1] - ranked[1][1] < 0.05) return { secondary: ranked[1][0] };
  return { dominant: ranked[0][0], secondary: ranked[1][0] };
}

export function confidenceFromObservations(history: DriverScores[]): number {
  // 0 turns → 0, 1 turn → 0.3, 3 turns → 0.6, 6+ turns → 0.85
  const n = history.length;
  if (n === 0) return 0;
  if (n === 1) return 0.3;
  if (n === 2) return 0.45;
  if (n === 3) return 0.6;
  if (n === 4) return 0.72;
  if (n === 5) return 0.8;
  return 0.85;
}

// ---------------------------------------------------------------------------
// Top-level entrypoint
// ---------------------------------------------------------------------------

export interface InferenceInputs {
  current_text: string;
  /** All prior per-turn scores in this session (most-recent last). */
  prior_per_turn_scores: DriverScores[];
}

export function inferDrivers(inputs: InferenceInputs): DriverInferenceResult {
  const { scores: per_turn, signals } = scoreTurn(inputs.current_text);
  const all = [...inputs.prior_per_turn_scores, per_turn];
  const cumulative = combineDriverScores(all);
  const { dominant, secondary } = pickDominantSecondary(cumulative);
  return {
    per_turn,
    cumulative,
    dominant,
    secondary,
    confidence: confidenceFromObservations(all),
    signals,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export const __test = {
  scoreTurn,
  combineDriverScores,
  pickDominantSecondary,
  confidenceFromObservations,
  inferDrivers,
};
