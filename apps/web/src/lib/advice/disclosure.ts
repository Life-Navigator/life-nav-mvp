/**
 * Context-aware advice disclosure.
 *
 * Intelligent disclosure, NOT a blanket disclaimer under every message (that ruins the experience).
 * Four tiers:
 *   - none     → onboarding / discovery / clarification / goal capture / low-risk coaching (render nothing)
 *   - subtle   → general financial / benefits / education / career planning
 *   - explicit → financial recommendations, investment, insurance, retirement, tax, estate/legal-adjacent,
 *                medical/health-sensitive
 *   - formal   → reports / PDFs / advisor-ready summaries (already handled by the report/PDF engine;
 *                kept here for completeness)
 *
 * The level is computed CLIENT-SIDE from existing signals — the latest user message text on open
 * chat, or the advisor's context-panel themes/risks — because no domain/risk classification reaches
 * the frontend today. Keyword match is word-boundary + case-insensitive; EXPLICIT wins over SUBTLE.
 */

export type DisclaimerLevel = 'none' | 'subtle' | 'explicit' | 'formal';

export const SUBTLE_COPY =
  'Use this as decision support, not a substitute for a licensed professional.';
export const EXPLICIT_COPY =
  "This is planning guidance based on what you've shared, not legal, tax, medical, or investment advice.";
export const FORMAL_COPY =
  'Decision support across domains — not financial, medical, legal, or tax advice. Consult a licensed professional before acting.';

// EXPLICIT: high-stakes topics where a licensed professional's domain is directly implicated.
const EXPLICIT_KEYWORDS = [
  'invest',
  'investment',
  'investing',
  'portfolio',
  'stock',
  'stocks',
  'etf',
  'mutual fund',
  '401k',
  'ira',
  'roth',
  'retire',
  'retirement',
  'pension',
  'annuity',
  'insurance',
  'life insurance',
  'tax',
  'taxes',
  'deduction',
  'irs',
  'capital gains',
  'estate',
  'estate plan',
  'living will',
  'power of attorney',
  'probate',
  'beneficiary',
  'trust fund',
  'attorney',
  'lawsuit',
  'medical',
  'diagnosis',
  'diagnose',
  'symptom',
  'symptoms',
  'medication',
  'prescription',
  'surgery',
  'chemotherapy',
];

// SUBTLE: general planning topics — useful, but lower stakes.
const SUBTLE_KEYWORDS = [
  'budget',
  'save',
  'savings',
  'debt',
  'mortgage',
  'loan',
  'net worth',
  'financial',
  'finances',
  'money',
  'income',
  'salary',
  'benefit',
  'benefits',
  'hsa',
  'fsa',
  'health',
  'wellness',
  'college',
  'tuition',
  'education',
  'student loan',
  'career',
  'job',
  'promotion',
];

// Match at a word START. Stems of 5+ chars allow a suffix (budget→budgeting, invest→investing,
// retire→retirement); short/ambiguous tokens (ira, etf, tax) require a full-word boundary so we
// don't trip on "irate"/"taxonomy". EXPLICIT is checked before SUBTLE by the callers.
function makeMatcher(words: string[]): RegExp {
  const parts = words.map((w) => {
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return w.length >= 5 ? `${esc}\\w*` : `${esc}\\b`;
  });
  return new RegExp(`\\b(${parts.join('|')})`, 'i');
}

const EXPLICIT_RE = makeMatcher(EXPLICIT_KEYWORDS);
const SUBTLE_RE = makeMatcher(SUBTLE_KEYWORDS);

/** Compute the disclosure tier from free text (e.g. the latest user message). */
export function levelFromText(text: string | null | undefined): DisclaimerLevel {
  if (!text) return 'none';
  if (EXPLICIT_RE.test(text)) return 'explicit';
  if (SUBTLE_RE.test(text)) return 'subtle';
  return 'none';
}

/** Compute the disclosure tier from the advisor context-panel themes/risks. */
export function levelFromThemes(
  themes: ReadonlyArray<string | null | undefined> | null | undefined
): DisclaimerLevel {
  if (!themes || themes.length === 0) return 'none';
  return levelFromText(themes.filter(Boolean).join(' '));
}
