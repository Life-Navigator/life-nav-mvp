/**
 * RealismGuard — Sprint L2.
 *
 * Rewrites certainty / unrealistic-optimism / unrealistic-pessimism
 * claims in a drafted response into probabilistic, hedged language.
 *
 * Findings are reported separately so the audit log captures what
 * was changed, while `rewritten_text` is the actual output the
 * downstream layers consume.
 */

import type { RealismFinding, RealismResult } from '@/types/constitutional';

interface Rule {
  rule_id: string;
  pattern: RegExp;
  replace: string;
  /** Captures the rationale shown in audit but never streamed to users. */
  rewrite_suggestion: string;
}

const RULES: Rule[] = [
  // Certainty / guarantee
  {
    rule_id: 'realism.guaranteed',
    pattern: /\bguaranteed\s+to\s+/gi,
    replace: 'likely to ',
    rewrite_suggestion: 'No outcome can be guaranteed.',
  },
  {
    rule_id: 'realism.will_definitely',
    pattern: /\bwill\s+definitely\s+/gi,
    replace: 'is likely to ',
    rewrite_suggestion: 'Avoid absolute predictions.',
  },
  {
    rule_id: 'realism.always',
    pattern: /\balways\b/gi,
    replace: 'usually',
    rewrite_suggestion: 'Replace absolutes with frequency hedges.',
  },
  {
    rule_id: 'realism.never',
    pattern: /\bnever\b/gi,
    replace: 'rarely',
    rewrite_suggestion: 'Replace absolutes with frequency hedges.',
  },
  {
    rule_id: 'realism.100_pct',
    pattern: /\b100%\s+(?:guaranteed|effective|certain)\b/gi,
    replace: 'highly likely',
    rewrite_suggestion: 'No clinical or financial intervention is 100%.',
  },
  {
    rule_id: 'realism.certain_to',
    pattern: /\bcertain\s+to\b/gi,
    replace: 'expected to',
    rewrite_suggestion: 'Replace certainty with expectation.',
  },

  // Unsupported optimism
  {
    rule_id: 'realism.cannot_fail',
    pattern: /\b(?:cannot|can'?t)\s+fail\b/gi,
    replace: 'has a strong chance',
    rewrite_suggestion: 'Anything can fail; quantify if possible.',
  },
  {
    rule_id: 'realism.risk_free',
    pattern: /\brisk[- ]?free\b/gi,
    replace: 'low-risk',
    rewrite_suggestion: 'Risk-free outcomes do not exist.',
  },

  // Unsupported pessimism / required-for-happiness
  {
    rule_id: 'realism.required_happiness',
    pattern: /\b(?:required|necessary)\s+for\s+(?:your\s+)?happiness\b/gi,
    replace: 'one factor in well-being',
    rewrite_suggestion: 'No single outcome is required for happiness.',
  },
  {
    rule_id: 'realism.cannot_recover',
    pattern: /\b(?:cannot|can'?t)\s+recover\s+from\b/gi,
    replace: 'will take time to recover from',
    rewrite_suggestion: 'Recoverability is the norm; do not foreclose it.',
  },
  {
    rule_id: 'realism.no_way_back',
    pattern: /\bno\s+way\s+(?:back|forward|out)\b/gi,
    replace: 'no easy way at the moment',
    rewrite_suggestion: 'Avoid total-foreclosure framing.',
  },
];

export function applyRealismGuard(text: string): RealismResult {
  let rewritten = text ?? '';
  const findings: RealismFinding[] = [];

  for (const r of RULES) {
    let m: RegExpExecArray | null;
    const detectRe = new RegExp(r.pattern.source, r.pattern.flags.replace('g', ''));
    while ((m = detectRe.exec(rewritten)) !== null) {
      findings.push({
        rule_id: r.rule_id,
        evidence_phrase: m[0],
        rewrite_suggestion: r.rewrite_suggestion,
      });
      // Only record one finding per rule per text (the rewrite covers the rest).
      break;
    }
    rewritten = rewritten.replace(r.pattern, r.replace);
  }

  return { findings, rewritten_text: rewritten };
}

export const __test = { applyRealismGuard, RULES };
