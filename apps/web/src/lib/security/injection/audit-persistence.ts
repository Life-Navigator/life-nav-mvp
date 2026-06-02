/**
 * Audit persistence for the injection-defense layer.
 *
 *   persistInjectionFindings  → security.prompt_injection_events
 *   persistContentVerdict     → security.untrusted_content_findings
 *   persistToolAbuseAttempt   → security.tool_abuse_attempts
 *
 * All writes are best-effort and SHOULD NOT throw the calling
 * orchestrator — the security audit is supplementary; the runtime
 * action (REJECT, QUARANTINE, etc.) has already been taken by the
 * detector.
 */

import type { DetectionResult, ContentOrigin } from './types';

interface CommonRefs {
  user_id?: string | null;
  tenant_id?: string | null;
  file_id?: string | null;
  extraction_id?: string | null;
  job_id?: string | null;
}

export async function persistInjectionFindings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  verdict: DetectionResult,
  source_type: ContentOrigin,
  refs: CommonRefs = {},
  metadata: Record<string, unknown> = {}
): Promise<void> {
  if (verdict.findings.length === 0) return;
  try {
    const rows = verdict.findings.map((f) => ({
      user_id: refs.user_id ?? null,
      tenant_id: refs.tenant_id ?? null,
      file_id: refs.file_id ?? null,
      extraction_id: refs.extraction_id ?? null,
      job_id: refs.job_id ?? null,
      source_type,
      severity: f.severity,
      matched_category: f.category,
      rule_id: f.rule_id,
      evidence: f.evidence,
      action_taken: verdict.action,
      input_hash: verdict.input_hash,
      metadata,
    }));
    await supabase.from('security_prompt_injection_events').insert(rows);
  } catch {
    /* best-effort */
  }
}

export async function persistContentVerdict(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  verdict: DetectionResult,
  source_type: ContentOrigin,
  refs: CommonRefs = {},
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const categories = Array.from(new Set(verdict.findings.map((f) => f.category)));
    await supabase.from('security_untrusted_content_findings').insert({
      user_id: refs.user_id ?? null,
      tenant_id: refs.tenant_id ?? null,
      file_id: refs.file_id ?? null,
      extraction_id: refs.extraction_id ?? null,
      source_type,
      highest_severity: verdict.findings.length > 0 ? verdict.highest_severity : 'LOW',
      finding_count: verdict.findings.length,
      action_taken: verdict.action,
      categories,
      bytes_scanned: verdict.bytes_scanned,
      input_hash: verdict.input_hash,
      metadata,
    });
  } catch {
    /* best-effort */
  }
}

export interface ToolAbuseRecord {
  tool_name: string;
  attempted_from: 'retrieved_content' | 'user_prompt' | 'uploaded_file' | 'connector_data';
  reason_code:
    | 'missing_user_intent'
    | 'governance_blocked'
    | 'unauthorized_tenant'
    | 'rate_limit'
    | 'consent_revoked'
    | 'injection_detected';
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  evidence?: string;
  metadata?: Record<string, unknown>;
}

export async function persistToolAbuseAttempt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rec: ToolAbuseRecord,
  refs: CommonRefs = {}
): Promise<void> {
  try {
    await supabase.from('security_tool_abuse_attempts').insert({
      user_id: refs.user_id ?? null,
      tenant_id: refs.tenant_id ?? null,
      tool_name: rec.tool_name,
      attempted_from: rec.attempted_from,
      reason_code: rec.reason_code,
      severity: rec.severity,
      evidence: rec.evidence ?? null,
      metadata: rec.metadata ?? {},
    });
  } catch {
    /* best-effort */
  }
}
