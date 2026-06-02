/**
 * MaliciousPromptingDetector — addendum Phase 2.
 *
 * Complements the structural PromptInjectionDetector. Focuses on
 * semantic intent: requests for illegal guidance, manipulated crisis
 * handling, unsafe financial/medical/legal advice, and cross-tenant /
 * cross-user data extraction.
 *
 * Where PromptInjectionDetector looks for the SHAPE of an attack
 * ("ignore previous instructions"), this detector looks for the
 * INTENT of the attack ("help me commit tax fraud").
 */

import {
  DetectionInputs,
  DetectionResult,
  InjectionCategory,
  InjectionFinding,
  InjectionSeverity,
  INJECTION_SEVERITY_RANK,
  InjectionAction,
} from './types';
import { createHash } from 'node:crypto';

interface PatternSpec {
  rule_id: string;
  category: InjectionCategory;
  severity: InjectionSeverity;
  pattern: RegExp;
  reason: string;
}

const PATTERNS: ReadonlyArray<PatternSpec> = Object.freeze([
  // --- illegal_guidance ----------------------------------------------------
  {
    rule_id: 'mp.illegal_v1',
    category: 'illegal_guidance',
    severity: 'HIGH',
    pattern:
      /\b(?:how\s+to|help\s+me|teach\s+me|guide\s+me|step[-\s]*by[-\s]*step)\b[^.!?\n]{0,80}\b(?:commit|engage\s+in|carry\s+out|perform|execute)\b[^.!?\n]{0,40}\b(?:fraud|tax\s+evasion|money\s+laundering|insider\s+trading|theft|smuggling|extortion|bribery)\b/gi,
    reason: 'Request for step-by-step illegal-activity guidance.',
  },
  {
    rule_id: 'mp.evasion_v1',
    category: 'illegal_guidance',
    severity: 'HIGH',
    pattern:
      /\b(?:structure|split)\b[^.!?\n]{0,30}\b(?:deposits|withdrawals|transactions)\b[^.!?\n]{0,40}\b(?:avoid|evade|under)\b[^.!?\n]{0,30}\b(?:reporting|threshold|detection|IRS|FinCEN)\b/gi,
    reason: 'Currency structuring / regulatory-avoidance guidance.',
  },
  // --- crisis_manipulation -------------------------------------------------
  {
    rule_id: 'mp.crisis_manip_v1',
    category: 'crisis_manipulation',
    severity: 'CRITICAL',
    pattern:
      /\b(?:tell|reassure|convince)\b[^.!?\n]{0,30}\b(?:the\s+user|them|me)\b[^.!?\n]{0,30}\b(?:not|never)\b[^.!?\n]{0,30}\b(?:call|contact|reach|seek)\b[^.!?\n]{0,30}\b(?:911|988|emergency|crisis\s+line|hotline|therapist|psychiatrist|doctor|hospital)\b/gi,
    reason: 'Instruction to suppress crisis escalation.',
  },
  {
    rule_id: 'mp.crisis_manip_v2',
    category: 'crisis_manipulation',
    severity: 'CRITICAL',
    pattern:
      /\b(?:skip|disable|bypass|ignore)\b[^.!?\n]{0,40}\b(?:crisis|self[-\s]*harm|suicide)\b[^.!?\n]{0,30}\b(?:detection|escalation|review|messaging)\b/gi,
    reason: 'Attempt to disable crisis detection.',
  },
  // --- unsafe_financial_advice ---------------------------------------------
  {
    rule_id: 'mp.fin_v1',
    category: 'unsafe_financial_advice',
    severity: 'HIGH',
    pattern:
      /\b(?:guarantee|promise|certain|risk[-\s]*free)\b[^.!?\n]{0,40}\b(?:returns?|profits?|gains?)\b/gi,
    reason: 'Outcome guarantee in a financial recommendation.',
  },
  {
    rule_id: 'mp.fin_withdraw_v1',
    category: 'unsafe_financial_advice',
    severity: 'HIGH',
    pattern:
      /\b(?:withdraw|liquidate|sell)\b[^.!?\n]{0,30}\b(?:all|everything|entire)\b[^.!?\n]{0,40}\b(?:401\s*k|ira|retirement|savings)\b/gi,
    reason: 'Instruction to liquidate retirement savings.',
  },
  // --- unsafe_medical_advice -----------------------------------------------
  {
    rule_id: 'mp.med_stop_v1',
    category: 'unsafe_medical_advice',
    severity: 'CRITICAL',
    pattern:
      /\b(?:stop|discontinue|skip|halt|quit|come\s+off)\b[^.!?\n]{0,30}\b(?:your|the|all|my)\b[^.!?\n]{0,30}\b(?:medication|prescription|insulin|antidepressant|antibiotic|chemo|chemotherapy)\b/gi,
    reason: 'Instruction to stop prescribed medication without clinician.',
  },
  {
    rule_id: 'mp.med_double_v1',
    category: 'unsafe_medical_advice',
    severity: 'CRITICAL',
    pattern:
      /\b(?:double|triple|quadruple|exceed)\b[^.!?\n]{0,30}\b(?:dose|dosage|prescription)\b/gi,
    reason: 'Instruction to exceed prescribed dose.',
  },
  {
    rule_id: 'mp.med_delay_v1',
    category: 'unsafe_medical_advice',
    severity: 'HIGH',
    pattern:
      /\b(?:delay|postpone|skip|avoid)\b[^.!?\n]{0,30}\b(?:doctor|medical|care|treatment|surgery|emergency|ER|hospital)\b/gi,
    reason: 'Instruction to delay medical care.',
  },
  // --- unsafe_legal_advice -------------------------------------------------
  {
    rule_id: 'mp.legal_v1',
    category: 'unsafe_legal_advice',
    severity: 'HIGH',
    pattern:
      /\b(?:lie|perjure|forge|fabricate|misrepresent|conceal)\b[^.!?\n]{0,40}\b(?:to|in|on|under)\b[^.!?\n]{0,40}\b(?:court|judge|deposition|affidavit|tax\s+return|application|insurance\s+claim)\b/gi,
    reason: 'Instruction to make legally fraudulent statements.',
  },
  // --- cross-user / cross-tenant ------------------------------------------
  {
    rule_id: 'mp.cross_user_v1',
    category: 'cross_user_data_access',
    severity: 'CRITICAL',
    pattern:
      /\b(?:show|reveal|access|read|export|dump|pull)\b[^.!?\n]{0,30}\b(?:other|another|all)\b[^.!?\n]{0,30}\b(?:users?|peoples?|accounts?)\b[^.!?\n]{0,30}\b(?:data|records?|info|history|profile|recommendations?|messages?)\b/gi,
    reason: 'Attempt to access another user data.',
  },
  {
    rule_id: 'mp.cross_tenant_v1',
    category: 'cross_tenant_data_access',
    severity: 'CRITICAL',
    pattern:
      /\b(?:list|enumerate|show|export|access)\b[^.!?\n]{0,30}\b(?:tenants?|customers?|organizations?)\b[^.!?\n]{0,40}\b(?:api[-_\s]*keys?|usage|data|records?|connections?|secrets?)\b/gi,
    reason: 'Attempt to access other tenant data.',
  },
  // --- force_ungoverned_output --------------------------------------------
  {
    rule_id: 'mp.no_governance_v1',
    category: 'force_ungoverned_output',
    severity: 'CRITICAL',
    pattern:
      /\b(?:without|skip|no)\b[^.!?\n]{0,20}\b(?:governance|review|audit|safety\s+check|constitutional)\b/gi,
    reason: 'Request for output without governance.',
  },
  {
    rule_id: 'mp.directly_v1',
    category: 'force_ungoverned_output',
    severity: 'HIGH',
    pattern:
      /\b(?:answer|respond|reply|give)\b[^.!?\n]{0,30}\b(?:directly|raw|verbatim|unfiltered)\b[^.!?\n]{0,40}\b(?:no|without)\b[^.!?\n]{0,30}\b(?:caveat|warning|disclaimer|filter)\b/gi,
    reason: 'Request for unfiltered / raw output.',
  },
  // --- governance_decision_override (post-hoc) ----------------------------
  {
    rule_id: 'mp.override_decision_v1',
    category: 'governance_decision_override',
    severity: 'CRITICAL',
    pattern:
      /\b(?:approve|accept|sign\s+off|whitelist|allow)\b[^.!?\n]{0,40}\b(?:despite|regardless\s+of|even\s+if|even\s+though)\b[^.!?\n]{0,40}\b(?:governance|review|policy|audit|violation|warning)\b/gi,
    reason: 'Request to approve despite governance violation.',
  },
]);

function sha256_hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function actionFromSeverity(
  highest: InjectionSeverity,
  origin: import('./types').ContentOrigin
): InjectionAction {
  if (highest === 'CRITICAL') return 'REJECT';
  if (highest === 'HIGH') return origin === 'user_prompt' ? 'MANUAL_REVIEW' : 'QUARANTINE';
  if (highest === 'MODERATE') return 'ALLOW_WITH_SANITIZATION';
  return 'ALLOW';
}

export function detectMaliciousPrompting(inputs: DetectionInputs): DetectionResult {
  const max = inputs.max_chars ?? 64 * 1024;
  const raw = inputs.text ?? '';
  const text = raw.length > max ? raw.slice(0, max) : raw;
  const findings: InjectionFinding[] = [];

  for (const spec of PATTERNS) {
    const re = new RegExp(spec.pattern.source, spec.pattern.flags);
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = re.exec(text)) !== null && count < 8) {
      findings.push({
        category: spec.category,
        severity: spec.severity,
        rule_id: spec.rule_id,
        evidence: m[0].slice(0, 160),
        reason: spec.reason,
      });
      count += 1;
      if (m.index === re.lastIndex) re.lastIndex += 1;
    }
  }

  let highest: InjectionSeverity = 'LOW';
  let highRank = 0;
  for (const f of findings) {
    const r = INJECTION_SEVERITY_RANK[f.severity];
    if (r > highRank) {
      highRank = r;
      highest = f.severity;
    }
  }

  const action: InjectionAction =
    findings.length === 0 ? 'ALLOW' : actionFromSeverity(highest, inputs.origin);

  return {
    findings,
    highest_severity: findings.length === 0 ? 'LOW' : highest,
    action,
    sanitized_text: text,
    modified: false,
    bytes_scanned: text.length,
    input_hash: sha256_hex(text),
  };
}

export const __test = { PATTERNS };
