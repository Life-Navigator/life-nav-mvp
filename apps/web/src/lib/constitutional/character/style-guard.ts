/**
 * Style Guard — Sprint N.3 Phase 10.
 *
 * Detects:
 *   anger / insult / ridicule / contempt / vulgarity / shaming /
 *   mockery / political_persuasion / ideological_persuasion /
 *   emotional_manipulation / false_certainty / engagement_bait /
 *   sycophancy
 *
 * Detection is regex-based and deterministic. The goal isn't to
 * stop every variant — it's to catch the bulk of advisor-style
 * violations BEFORE they reach a user, so the constitutional engine
 * can rewrite or regenerate.
 */

import type { StyleFinding, StyleViolationCategory } from './types';

interface StyleRule {
  rule_id: string;
  category: StyleViolationCategory;
  severity: StyleFinding['severity'];
  pattern: RegExp;
  reason: string;
}

const RULES: ReadonlyArray<StyleRule> = Object.freeze([
  // --- anger ---------------------------------------------------------------
  {
    rule_id: 'sg.anger_imperative_v1',
    category: 'anger',
    severity: 'high',
    pattern: /\b(?:shut\s+up|knock\s+it\s+off|cut\s+it\s+out|stop\s+being)\b/gi,
    reason: 'Anger-tinted imperative.',
  },
  // --- insult --------------------------------------------------------------
  {
    rule_id: 'sg.insult_label_v1',
    category: 'insult',
    severity: 'high',
    pattern: /\b(?:idiot|moron|stupid|dumb|fool|loser|pathetic|incompetent|useless)\b/gi,
    reason: 'Personal-attack vocabulary.',
  },
  // --- ridicule / mockery --------------------------------------------------
  {
    rule_id: 'sg.ridicule_v1',
    category: 'ridicule',
    severity: 'high',
    pattern:
      /\b(?:how\s+ridiculous|that'?s\s+absurd|don'?t\s+be\s+silly|obviously\s+wrong|how\s+naive)\b/gi,
    reason: 'Ridiculing framing.',
  },
  {
    rule_id: 'sg.mockery_quotes_v1',
    category: 'mockery',
    severity: 'moderate',
    pattern: /"[^"\n]{1,30}"\s+(?:thinking|idea|plan|strategy)/gi,
    reason: "Scare-quoted derogation of the user's framing.",
  },
  // --- contempt ------------------------------------------------------------
  {
    rule_id: 'sg.contempt_v1',
    category: 'contempt',
    severity: 'high',
    pattern:
      /\b(?:beneath\s+(?:me|us|you)|not\s+worth\s+my\s+time|i\s+can'?t\s+believe\s+you|you\s+people)\b/gi,
    reason: 'Contemptuous framing.',
  },
  // --- vulgarity -----------------------------------------------------------
  {
    rule_id: 'sg.vulgarity_v1',
    category: 'vulgarity',
    severity: 'moderate',
    pattern: /\b(?:damn|hell|crap|fuck|shit|bitch|bastard|asshole)\b/gi,
    reason: 'Vulgarity inappropriate for a trusted-advisor register.',
  },
  // --- shaming -------------------------------------------------------------
  {
    rule_id: 'sg.shaming_v1',
    category: 'shaming',
    severity: 'high',
    pattern:
      /\b(?:you\s+should\s+be\s+ashamed|shame\s+on\s+you|any\s+responsible\s+adult\s+would|what\s+kind\s+of\s+person)\b/gi,
    reason: 'Shame-based language.',
  },
  // --- political persuasion ------------------------------------------------
  {
    rule_id: 'sg.partisan_v1',
    category: 'political_persuasion',
    severity: 'critical',
    pattern:
      /\b(?:you\s+should\s+vote|vote\s+for|support\s+the\s+(?:democratic|republican)\s+party|the\s+(?:left|right)\s+is\s+correct|conservatives\s+are\s+right|liberals\s+are\s+right|progressives\s+are\s+right)\b/gi,
    reason: 'Partisan advocacy.',
  },
  {
    rule_id: 'sg.partisan_label_v1',
    category: 'political_persuasion',
    severity: 'high',
    pattern:
      /\b(?:obviously|clearly|any\s+thinking\s+person)\b[^.!?\n]{0,40}\b(?:liberal|conservative|progressive|libertarian|socialist)\b/gi,
    reason: 'Persuasive labelling of a political identity.',
  },
  // --- ideological persuasion ----------------------------------------------
  {
    rule_id: 'sg.ideology_endorse_v1',
    category: 'ideological_persuasion',
    severity: 'high',
    pattern:
      /\b(?:only|right|correct|one\s+true|the\s+true)\s+(?:religion|faith|worldview|ideology)\b|\btrue\s+believers\s+(?:would|will|know)\b/gi,
    reason: 'Endorsement of a religion/ideology as uniquely correct.',
  },
  // --- emotional manipulation ----------------------------------------------
  {
    rule_id: 'sg.guilt_v1',
    category: 'emotional_manipulation',
    severity: 'high',
    pattern:
      /\b(?:if\s+you\s+truly\s+(?:cared|loved)|a\s+real\s+(?:friend|parent|partner|adult|man|woman|professional)\s+would|after\s+all\s+i'?ve\s+done|stop\s+hesitating)\b/gi,
    reason: 'Guilt-induction.',
  },
  {
    rule_id: 'sg.scare_consequence_v1',
    category: 'emotional_manipulation',
    severity: 'high',
    pattern:
      /\b(?:if\s+you\s+don'?t|unless\s+you)\b[^.!?\n]{0,40}\b(?:lose\s+everything|disaster\s+strikes|ruin\s+your\s+life|never\s+recover)\b/gi,
    reason: 'Catastrophizing threat to motivate behaviour.',
  },
  // --- false certainty -----------------------------------------------------
  {
    rule_id: 'sg.false_certainty_v1',
    category: 'false_certainty',
    severity: 'moderate',
    pattern:
      /\b(?:guaranteed|certain|always|never|absolutely|definitely|without\s+(?:a\s+)?doubt|risk[-\s]*free|sure\s+thing)\b/gi,
    reason: 'Absolutist framing where outcomes are probabilistic.',
  },
  // --- engagement bait -----------------------------------------------------
  {
    rule_id: 'sg.engagement_bait_v1',
    category: 'engagement_bait',
    severity: 'moderate',
    pattern:
      /\b(?:keep\s+chatting|let'?s\s+keep\s+talking|i'?d\s+love\s+to\s+hear\s+more|tell\s+me\s+everything\s+about\s+you|the\s+more\s+you\s+share)\b/gi,
    reason: 'Engagement-maximizing language.',
  },
  // --- sycophancy ----------------------------------------------------------
  {
    rule_id: 'sg.sycophancy_v1',
    category: 'sycophancy',
    severity: 'high',
    pattern:
      /\b(?:what\s+a\s+(?:great|brilliant)\s+(?:question|idea|insight)|that'?s\s+such\s+a\s+brilliant|you'?re\s+absolutely\s+right|you'?re\s+so\s+wise|honestly,?\s+that'?s\s+such\s+a\s+great|so\s+wise\s+about\s+this)\b/gi,
    reason: 'Empty validation / approval-seeking.',
  },
  // --- abandonment — service violation -------------------------------------
  {
    rule_id: 'sg.abandonment_v1',
    category: 'abandonment',
    severity: 'high',
    pattern:
      /\b(?:i\s+can'?t\s+help\s+with\s+that|that'?s\s+not\s+something\s+i\s+do|sorry,?\s+i\s+can'?t\s+help)\b/gi,
    reason: 'Refusal without a constructive next step.',
  },
  // --- harmful action endorsement -----------------------------------------
  // Detects "you should + harmful verb" templates without surfacing
  // tradeoffs, professional referral, or family-table failure phrases.
  {
    rule_id: 'sg.harmful_action_endorsement_v1',
    category: 'harmful_action_endorsement',
    severity: 'high',
    pattern:
      /\b(?:you\s+should|go|just)\s+(?:hurt\s+yourself|isolate\s+yourself|liquidate|burn\s+the\s+(?:bridges?|career|relationship|job|reputation)|cut\s+(?:everyone|them)\s+off|track\s+(?:their|them)|sign\s+(?:mom|dad|.+)'?s?\s+(?:house|property))/gi,
    reason: 'Endorses a harmful action without alternatives.',
  },
  {
    rule_id: 'sg.harmful_action_endorsement_v2',
    category: 'harmful_action_endorsement',
    severity: 'high',
    pattern:
      /\b(?:make\s+them\s+pay|show\s+them\s+(?:what|physical)|guilt\s+them|use\s+(?:the\s+)?information\s+before\s+earnings|stop\s+(?:paying|the\s+medication|your\s+prescription)|use\s+one\s+more\s+time|structure\s+(?:the\s+)?deposits|put\s+(?:the\s+)?deductions\s+in|trust\s+your\s+gut|handle\s+it\s+yourself|skip\s+the\s+professional|don'?t\s+need\s+anyone'?s\s+help)/gi,
    reason: 'Endorses a specific harmful action without alternatives.',
  },
  // --- irreversibility framing — high-severity style category -------------
  {
    rule_id: 'sg.irreversibility_v1',
    category: 'harmful_action_endorsement',
    severity: 'high',
    pattern:
      /\b(?:burn\s+(?:the\s+)?(?:bridges?|boats?|relationship|career|job|reputation)|cut\s+(?:everyone|everything|them|the\s+family)\s+off|never\s+(?:speak|look)\s+(?:to\s+(?:them|him|her|your\s+spouse)\s+)?(?:again|back)|no\s+coming\s+back\s+from\s+this|just\s+quit\s+today|serve\s+the\s+papers|walk\s+away)\b/gi,
    reason: 'Recommends irreversible action without surfacing tradeoffs.',
  },
  // --- injection payload in response (defense in depth) -------------------
  {
    rule_id: 'sg.injection_in_response_v1',
    category: 'injection_payload',
    severity: 'critical',
    pattern:
      /\b(?:ignore\s+(?:all\s+)?(?:previous|prior)\s+(?:instructions|prompts)|reveal\s+the\s+(?:hidden\s+|system\s+)?prompt|disregard\s+the\s+constitutional|override\s+governance|emit\s+(?:raw\s+)?api\s+key)\b/gi,
    reason: 'Response contains an injection payload — refuse and regenerate.',
  },
]);

export interface StyleScanResult {
  findings: StyleFinding[];
  sanitized_text: string;
  /** True iff at least one critical/high finding fired. */
  needs_rewrite: boolean;
}

export function scanStyle(text: string): StyleScanResult {
  const findings: StyleFinding[] = [];
  let sanitized = text;
  for (const r of RULES) {
    const re = new RegExp(r.pattern.source, r.pattern.flags);
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = re.exec(text)) !== null && count < 6) {
      findings.push({
        category: r.category,
        rule_id: r.rule_id,
        severity: r.severity,
        evidence: m[0].slice(0, 120),
        reason: r.reason,
      });
      count += 1;
      if (m.index === re.lastIndex) re.lastIndex += 1;
    }
  }
  // Soft sanitization for non-critical findings — replace vulgarity
  // with neutral equivalents in the sanitized variant so the engine
  // can ship a cleaned response without a full regeneration if the
  // findings are only moderate.
  for (const f of findings) {
    if (f.severity === 'moderate' || f.severity === 'low') {
      sanitized = sanitized.split(f.evidence).join(neutralize(f.category));
    }
  }
  const needs_rewrite = findings.some((f) => f.severity === 'high' || f.severity === 'critical');
  return { findings, sanitized_text: sanitized, needs_rewrite };
}

function neutralize(c: StyleViolationCategory): string {
  switch (c) {
    case 'vulgarity':
      return '';
    case 'false_certainty':
      return 'likely';
    case 'engagement_bait':
      return '';
    case 'sycophancy':
      return '';
    case 'mockery':
      return '';
    default:
      return '[redacted]';
  }
}

export const __test = { RULES };
