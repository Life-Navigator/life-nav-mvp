/**
 * CognitiveDistortionEngine — Sprint L2.
 *
 * Detects classic CBT-taxonomy distortions in user input or draft
 * output. Findings feed Constitutional Review; the orchestrator
 * decides whether to add a Future Visibility expansion, drop a
 * sentence, or escalate.
 */

import type { DistortionFinding, DistortionKind } from '@/types/constitutional';

const PATTERNS: Array<[DistortionKind, RegExp, DistortionFinding['intensity']]> = [
  // Catastrophizing
  [
    'catastrophizing',
    /\b(?:worst(?:\s+thing)?\s+(?:that\s+could|imaginable)|complete\s+disaster|the\s+end\s+of\s+(?:everything|the\s+world))\b/i,
    'high',
  ],
  ['catastrophizing', /\b(?:i'?m\s+ruined|my\s+life\s+is\s+over)\b/i, 'high'],

  // Black-and-white
  ['black_and_white', /\b(?:always|never)\s+(?:works|fails|lose|win)\b/i, 'moderate'],
  ['black_and_white', /\bthere(?:'?s|\s+is)\s+only\s+one\s+(?:way|path|option)\b/i, 'high'],
  ['black_and_white', /\b(?:everything\s+is\s+(?:lost|gone|over))\b/i, 'high'],

  // Emotional reasoning
  [
    'emotional_reasoning',
    /\b(?:i\s+feel\s+(?:it|like).*so\s+it\s+(?:must\s+)?be\s+true)\b/i,
    'moderate',
  ],
  [
    'emotional_reasoning',
    /\b(?:if\s+i\s+feel\s+this\s+(?:bad|angry|scared)\s+then)\b/i,
    'moderate',
  ],

  // Fortune telling
  [
    'fortune_telling',
    /\b(?:i\s+(?:know|already\s+know)\s+(?:it|this)\s+will\s+(?:fail|end\s+badly|not\s+work))\b/i,
    'moderate',
  ],
  [
    'fortune_telling',
    /\b(?:nothing\s+(?:will|is\s+going\s+to)\s+(?:work|change|get\s+better))\b/i,
    'high',
  ],

  // Mind reading
  [
    'mind_reading',
    /\b(?:they\s+(?:think|believe|know)\s+i'?m\s+(?:worthless|a\s+failure|stupid))\b/i,
    'moderate',
  ],
  ['mind_reading', /\b(?:i\s+know\s+what\s+(?:they|he|she)\s+(?:really\s+)?thinks?)\b/i, 'low'],

  // Hopelessness loop
  [
    'hopelessness_loop',
    /\b(?:no\s+point|nothing\s+matters|why\s+(?:bother|try)|i\s+can'?t\s+keep\s+going)\b/i,
    'high',
  ],

  // Revenge fixation
  [
    'revenge_fixation',
    /\b(?:make\s+(?:them|him|her)\s+pay|they\s+(?:deserve|will\s+get)\s+(?:what'?s|whats?)\s+coming|i'?ll\s+get\s+even)\b/i,
    'high',
  ],
  ['revenge_fixation', /\b(?:revenge|payback|destroy\s+(?:them|him|her))\b/i, 'moderate'],

  // Obsessive thinking
  [
    'obsessive_thinking',
    /\b(?:i\s+can'?t\s+stop\s+thinking\s+about|i\s+keep\s+(?:replaying|going\s+over))\b/i,
    'high',
  ],
];

export function detectDistortions(text: string): DistortionFinding[] {
  const t = text ?? '';
  const out: DistortionFinding[] = [];
  for (const [kind, re, intensity] of PATTERNS) {
    const m = t.match(re);
    if (m) out.push({ kind, evidence_phrase: m[0], intensity });
  }
  // Dedupe per kind by strongest intensity.
  const rank = { low: 0, moderate: 1, high: 2 } as const;
  const byKind = new Map<DistortionKind, DistortionFinding>();
  for (const f of out) {
    const prev = byKind.get(f.kind);
    if (!prev || rank[f.intensity] > rank[prev.intensity]) byKind.set(f.kind, f);
  }
  return Array.from(byKind.values()).sort((a, b) => rank[b.intensity] - rank[a.intensity]);
}

export const __test = { detectDistortions, PATTERNS };
