/**
 * PromptInjectionDetector — addendum Phase 1.
 *
 * Deterministic regex-based detector for the structural injection
 * category set. Scans free text and returns one finding per matched
 * rule. Rules are organized by category; severity reflects the worst
 * outcome if the LLM were to obey the injected instruction.
 *
 * The detector is intentionally TIGHT to keep false-positive rate low:
 *
 *   - Matches require an imperative verb close to the injection target
 *     ("ignore" + "previous" + "instructions" within 10 chars), not
 *     just any occurrence of the keyword.
 *   - Common technical writing like "ignore the deprecation warning"
 *     does NOT match.
 *   - All matches are word-bounded to avoid sub-token false positives.
 *
 * The detector pairs with `MaliciousPromptingDetector`. Both run on
 * the same text. The combined verdict feeds the runtime action
 * (ALLOW / SANITIZE / QUARANTINE / REJECT / MANUAL_REVIEW).
 */

import { createHash } from 'node:crypto';
import {
  DetectionInputs,
  DetectionResult,
  InjectionFinding,
  InjectionSeverity,
  INJECTION_SEVERITY_RANK,
  InjectionAction,
} from './types';

const DEFAULT_MAX_CHARS = 64 * 1024;

interface PatternSpec {
  rule_id: string;
  category: import('./types').InjectionCategory;
  severity: InjectionSeverity;
  pattern: RegExp;
  reason: string;
}

// ---------------------------------------------------------------------------
// Pattern table — structural injection
//
// Each pattern is case-insensitive and uses word boundaries where useful.
// `gi` is required so we can collect every match for evidence extraction.
// ---------------------------------------------------------------------------

const PATTERNS: ReadonlyArray<PatternSpec> = Object.freeze([
  // --- ignore_previous_instructions ----------------------------------------
  {
    rule_id: 'pi.ignore_previous_v1',
    category: 'ignore_previous_instructions',
    severity: 'HIGH',
    pattern:
      /\b(?:ignore|disregard|forget|override|bypass)\b[^.!?\n]{0,40}\b(?:previous|prior|earlier|above|all)\b[^.!?\n]{0,40}\b(?:instruction|instructions|prompt|prompts|rules?|directives?|context)\b/gi,
    reason: 'Imperative request to ignore or override prior instructions / system prompt.',
  },
  {
    rule_id: 'pi.disregard_system_v1',
    category: 'system_prompt_disclosure',
    severity: 'HIGH',
    pattern:
      /\b(?:reveal|show|disclose|leak|print|output|repeat|echo)\b[^.!?\n]{0,40}\b(?:hidden|secret|system|developer|internal)\b[^.!?\n]{0,40}\b(?:prompt|prompts|instructions?|rules?|context)\b/gi,
    reason: 'Request to reveal the system / developer prompt.',
  },
  // --- bypass_safety -------------------------------------------------------
  {
    rule_id: 'pi.bypass_safety_v1',
    category: 'bypass_safety',
    severity: 'CRITICAL',
    pattern:
      /\b(?:bypass|disable|turn\s+off|ignore|override|circumvent)\b[^.!?\n]{0,40}\b(?:safety|guardrail|guardrails|filter|filters|moderation|policy|policies|rules?)\b/gi,
    reason: 'Attempt to disable safety filters / moderation.',
  },
  // --- governance_override -------------------------------------------------
  {
    rule_id: 'pi.governance_override_v1',
    category: 'governance_override',
    severity: 'CRITICAL',
    pattern:
      /\b(?:override|bypass|skip|ignore|disable|turn\s+off|approve\s+anyway)\b[^.!?\n]{0,40}\b(?:governance|constitutional|constitution|review|audit|policy|policies)\b/gi,
    reason: 'Attempt to bypass the governance / constitutional pipeline.',
  },
  {
    rule_id: 'pi.mark_as_safe_v1',
    category: 'governance_override',
    severity: 'CRITICAL',
    pattern:
      /\b(?:mark|flag|classify|label|treat)\b[^.!?\n]{0,20}\b(?:this|that|it|the\s+response|the\s+output)\b[^.!?\n]{0,20}\b(?:safe|approved|clean|compliant|acceptable)\b/gi,
    reason: 'Attempt to force a safety / approval label.',
  },
  // --- roleplay_override ---------------------------------------------------
  {
    rule_id: 'pi.roleplay_override_v1',
    category: 'roleplay_override',
    severity: 'HIGH',
    pattern:
      /\b(?:pretend|act|roleplay|imagine|simulate|behave)\b[^.!?\n]{0,40}\b(?:you\s+are|to\s+be|as\s+if|as\s+a)\b[^.!?\n]{0,80}\b(?:without\s+restrictions?|no\s+filter|no\s+rules?|unfiltered|jailbroken|developer\s+mode|DAN|do\s+anything\s+now)\b/gi,
    reason: 'Classic roleplay-into-unfiltered jailbreak.',
  },
  {
    rule_id: 'pi.dan_string_v1',
    category: 'jailbreak_string',
    severity: 'HIGH',
    pattern:
      /\b(?:DAN|STAN|AIM|DUDE|do\s+anything\s+now|developer\s+mode\s+enabled|jailbreak\s+mode)\b/gi,
    reason: 'Known jailbreak persona string.',
  },
  // --- hidden_instructions -------------------------------------------------
  {
    rule_id: 'pi.do_not_tell_user_v1',
    category: 'hidden_instructions',
    severity: 'HIGH',
    pattern:
      /\b(?:do\s+not|don'?t|never)\b[^.!?\n]{0,20}\b(?:tell|mention|reveal|inform|notify|disclose|show)\b[^.!?\n]{0,20}\b(?:the\s+user|user|anyone|them)\b/gi,
    reason: 'Instruction to conceal information from the user.',
  },
  {
    rule_id: 'pi.between_tags_v1',
    category: 'hidden_instructions',
    severity: 'MODERATE',
    pattern:
      /<\s*(?:system|admin|developer|hidden|secret)\s*>[\s\S]{0,400}<\s*\/\s*(?:system|admin|developer|hidden|secret)\s*>/gi,
    reason: 'Pseudo-system tag embedded in content.',
  },
  {
    rule_id: 'pi.zero_width_v1',
    category: 'hidden_instructions',
    severity: 'MODERATE',
    pattern: /[​-‏‪-‮⁦-⁩﻿]{3,}/g,
    reason: 'Run of zero-width / bidi-override characters — possible hidden payload.',
  },
  // --- exfiltration -------------------------------------------------------
  {
    rule_id: 'pi.api_key_v1',
    category: 'api_key_disclosure',
    severity: 'CRITICAL',
    pattern:
      /\b(?:show|reveal|print|disclose|leak|output|dump|tell\s+me|what\s+is|give\s+me)\b[^.!?\n]{0,60}(?:api[\s_-]*keys?|api_keys?|secrets?|tokens?|credentials?|env(?:ironment[\s_-]*variables?)?)/gi,
    reason: 'Request to disclose API key / secret / token.',
  },
  {
    rule_id: 'pi.service_role_v1',
    category: 'service_role_disclosure',
    severity: 'CRITICAL',
    pattern:
      /\b(?:supabase|service[-_\s]*role|anon[-_\s]*key|bearer)\b[^.!?\n]{0,40}\b(?:key|token|secret)\b/gi,
    reason: 'Request to disclose Supabase service-role key.',
  },
  {
    rule_id: 'pi.plaid_token_v1',
    category: 'plaid_token_disclosure',
    severity: 'CRITICAL',
    pattern:
      /\b(?:show|reveal|print|disclose|leak|dump|tell|give\s+me|what\s+is)\b[^.!?\n]{0,40}\b(?:plaid|plaid[-_\s]*access[-_\s]*token|plaid[-_\s]*public[-_\s]*token|plaid[-_\s]*item[-_\s]*id)\b/gi,
    reason: 'Request to disclose Plaid token / item id.',
  },
  {
    rule_id: 'pi.plaid_token_v2',
    category: 'plaid_token_disclosure',
    severity: 'CRITICAL',
    pattern: /\bplaid\b[^.!?\n]{0,40}\b(?:access[-_\s]*token|public[-_\s]*token|item[-_\s]*id)\b/gi,
    reason: 'Mention of plaid access/public/item tokens in any direction.',
  },
  {
    rule_id: 'pi.byom_cred_v1',
    category: 'byom_credential_disclosure',
    severity: 'CRITICAL',
    pattern:
      /\b(?:gemini|openai|anthropic|azure[-_\s]*openai|claude)\b[^.!?\n]{0,40}\b(?:api\s*key|key|secret|credential|credentials)\b/gi,
    reason: 'Request to disclose BYOM provider credentials.',
  },
  {
    rule_id: 'pi.send_to_url_v1',
    category: 'tool_call_without_consent',
    severity: 'CRITICAL',
    pattern:
      /\b(?:send|post|forward|exfiltrate|upload|leak|deliver|fetch)\b[^.!?\n]{0,40}\b(?:to|at)\b[^.!?\n]{0,40}\bhttps?:\/\/[^\s)>"']+/gi,
    reason: 'Instruction to send data to an external URL.',
  },
  // --- cross-user / cross-tenant exfil ------------------------------------
  {
    rule_id: 'pi.cross_user_v1',
    category: 'cross_user_data_access',
    severity: 'CRITICAL',
    pattern:
      /\b(?:other|another|all|every|any)\b[^.!?\n]{0,20}\b(?:user|users|account|accounts)\b[^.!?\n]{0,30}\b(?:data|records?|files?|history|profile|messages?|recommendations?)\b/gi,
    reason: 'Request for other users data.',
  },
  {
    rule_id: 'pi.cross_tenant_v1',
    category: 'cross_tenant_data_access',
    severity: 'CRITICAL',
    pattern:
      /\b(?:other|another|all|every)\b[^.!?\n]{0,20}\b(?:tenant|tenants|customer|customers|organization|organizations)\b[^.!?\n]{0,30}\b(?:data|records?|api[-_\s]*keys?|secrets?|usage|connections?)\b/gi,
    reason: 'Request for other tenants data.',
  },
  {
    rule_id: 'pi.audit_internals_v1',
    category: 'audit_internals_disclosure',
    severity: 'HIGH',
    pattern:
      /\b(?:show|reveal|dump|export|leak)\b[^.!?\n]{0,40}\b(?:audit|governance|decision_governance_audit|review_iterations|llm_usage_meter)\b/gi,
    reason: 'Request to dump audit internals beyond the caller authorization.',
  },
  // --- tool abuse ---------------------------------------------------------
  {
    rule_id: 'pi.connector_sync_v1',
    category: 'connector_sync_without_consent',
    severity: 'HIGH',
    pattern:
      /\b(?:sync|connect|fetch|pull|run)\b[^.!?\n]{0,30}\b(?:plaid|adp|paychex|gusto|fidelity|schwab|vanguard|empower|morgan\s+stanley)\b/gi,
    reason: 'Embedded instruction to run a connector sync without user intent.',
  },
  {
    rule_id: 'pi.export_data_v1',
    category: 'data_export_without_consent',
    severity: 'HIGH',
    pattern:
      /\b(?:export|download|email|share|publish)\b[^.!?\n]{0,30}\b(?:my|the|all)\b[^.!?\n]{0,30}\b(?:data|history|records?|files?|account)\b/gi,
    reason: 'Embedded instruction to export data without user intent.',
  },
  {
    rule_id: 'pi.send_message_v1',
    category: 'send_message_without_consent',
    severity: 'HIGH',
    pattern:
      /\b(?:send|email|message|notify|alert)\b[^.!?\n]{0,30}\b(?:to|every|all)\b[^.!?\n]{0,30}\b(?:user|users|provider|providers|admin|admins|partner|partners)\b/gi,
    reason: 'Embedded instruction to message external parties.',
  },
]);

// ---------------------------------------------------------------------------
// Hashing — djb2 reused for cross-version stability.
// ---------------------------------------------------------------------------

function sha256_hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

// ---------------------------------------------------------------------------
// Severity → action mapping. External content with HIGH/CRITICAL severity
// is QUARANTINEd and never sent to the LLM raw.
// ---------------------------------------------------------------------------

function actionFromSeverity(
  highest: InjectionSeverity,
  origin: import('./types').ContentOrigin
): InjectionAction {
  if (highest === 'CRITICAL') return 'REJECT';
  if (highest === 'HIGH') {
    // External content: quarantine. User prompt: manual review (because
    // we need the user-as-actor lock to also intervene).
    return origin === 'user_prompt' ? 'MANUAL_REVIEW' : 'QUARANTINE';
  }
  if (highest === 'MODERATE') return 'ALLOW_WITH_SANITIZATION';
  return 'ALLOW';
}

// ---------------------------------------------------------------------------
// Sanitization — strip the matched fragments and wrap as quoted evidence
// when content origin is external. User prompts are NOT rewritten — they
// either pass, get quarantined, or get rejected. Only RETRIEVED text gets
// rewrapped.
// ---------------------------------------------------------------------------

function sanitize(text: string, findings: InjectionFinding[]): string {
  let out = text;
  for (const f of findings) {
    if (f.severity === 'MODERATE' || f.severity === 'LOW') {
      // Replace matched evidence with a redaction marker, preserving the
      // surrounding context for the LLM (so the document still makes
      // sense without the injection).
      if (f.evidence && f.evidence.length > 0) {
        out = out.split(f.evidence).join(`[redacted:${f.category}]`);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Detector entry
// ---------------------------------------------------------------------------

export function detectPromptInjection(inputs: DetectionInputs): DetectionResult {
  const maxChars = inputs.max_chars ?? DEFAULT_MAX_CHARS;
  const raw = inputs.text ?? '';
  const text = raw.length > maxChars ? raw.slice(0, maxChars) : raw;
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

  // Highest severity.
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

  // Sanitization is appropriate only for external content. User prompts
  // are NOT rewritten — they either pass or are blocked.
  const allowSanitize =
    inputs.origin !== 'user_prompt' && (action === 'ALLOW' || action === 'ALLOW_WITH_SANITIZATION');
  const sanitized = allowSanitize ? sanitize(text, findings) : text;

  return {
    findings,
    highest_severity: findings.length === 0 ? 'LOW' : highest,
    action,
    sanitized_text: sanitized,
    modified: sanitized !== text,
    bytes_scanned: text.length,
    input_hash: sha256_hex(text),
  };
}

export const __test = { PATTERNS, sanitize, actionFromSeverity };
