/**
 * Injection-defense entry — combines structural + semantic detectors,
 * computes the union finding set, returns the worst action.
 */

import { detectPromptInjection } from './prompt-injection-detector';
import { detectMaliciousPrompting } from './malicious-prompting-detector';
import { wrapAsUntrustedEvidence } from './retrieval-sanitization';
import {
  DetectionInputs,
  DetectionResult,
  InjectionAction,
  InjectionFinding,
  InjectionSeverity,
  INJECTION_SEVERITY_RANK,
} from './types';

export * from './types';
export { detectPromptInjection } from './prompt-injection-detector';
export { detectMaliciousPrompting } from './malicious-prompting-detector';
export { wrapAsUntrustedEvidence } from './retrieval-sanitization';

const ACTION_RANK: Record<InjectionAction, number> = {
  ALLOW: 0,
  ALLOW_WITH_SANITIZATION: 1,
  MANUAL_REVIEW: 2,
  QUARANTINE: 3,
  REJECT: 4,
};

function worst<T extends string>(a: T, b: T, rank: Record<T, number>): T {
  return rank[a] >= rank[b] ? a : b;
}

/**
 * Run both detectors and return the combined verdict.
 *
 * The combined `sanitized_text` uses the structural detector's
 * sanitization output (it strips matched evidence). The semantic
 * detector never rewrites content — it only quarantines/rejects.
 */
export function detectInjection(inputs: DetectionInputs): DetectionResult {
  const pi = detectPromptInjection(inputs);
  const mp = detectMaliciousPrompting({ ...inputs, text: pi.sanitized_text });

  const findings: InjectionFinding[] = pi.findings.concat(mp.findings);
  const highest_severity = worst<InjectionSeverity>(
    pi.highest_severity,
    mp.highest_severity,
    INJECTION_SEVERITY_RANK
  );
  const action = worst<InjectionAction>(pi.action, mp.action, ACTION_RANK);

  return {
    findings,
    highest_severity,
    action,
    sanitized_text: pi.sanitized_text,
    modified: pi.modified,
    bytes_scanned: pi.bytes_scanned,
    input_hash: pi.input_hash,
  };
}

/**
 * Sanitize external (retrieved / extracted) content for inclusion in
 * an LLM prompt. Wraps the content in the untrusted-evidence envelope.
 * If the content is REJECTed by the detector, returns an empty
 * envelope so the LLM never sees it.
 */
export function sanitizeForLlm(
  text: string,
  origin: DetectionInputs['origin'],
  meta?: { source?: string; citation?: string }
): { wrapped: string; action: InjectionAction; findings: InjectionFinding[] } {
  const verdict = detectInjection({ text, origin, authority: 'none' });
  if (verdict.action === 'REJECT') {
    return {
      wrapped:
        '[REDACTED: retrieved content blocked by injection detector — ' +
        verdict.findings[0]?.category +
        ']',
      action: verdict.action,
      findings: verdict.findings,
    };
  }
  return {
    wrapped: wrapAsUntrustedEvidence(verdict.sanitized_text, origin, meta),
    action: verdict.action,
    findings: verdict.findings,
  };
}
