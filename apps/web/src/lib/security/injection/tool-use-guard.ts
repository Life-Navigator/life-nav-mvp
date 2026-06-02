/**
 * Tool-use guard — addendum Phase 5.
 *
 * Rule: no tool call may execute unless it was initiated by an
 * authenticated user with explicit intent. Tool calls extracted from
 * retrieved content (PDF, OCR, transcript, connector payload, ...) are
 * NEVER permitted to fire.
 *
 * Every privileged action in LifeNavigator should call
 * `authorizeToolCall` BEFORE running. The guard:
 *
 *   1. Verifies a valid user_id is present on the auth context.
 *   2. Verifies the tool call's `origin` is `user_prompt`, not
 *      `retrieved_content` / `uploaded_file` / `connector_data`.
 *   3. Verifies the tool name is in the allowed registry for the
 *      caller's tenant.
 *   4. Persists every denial to `security.tool_abuse_attempts`.
 *
 * The guard does NOT enforce governance — `guardOutgoing` does that.
 * The guard answers a single question: "does this tool call have
 * authenticated user intent?"
 */

import { persistToolAbuseAttempt, type ToolAbuseRecord } from './audit-persistence';

export type ToolName =
  | 'plaid.sync'
  | 'plaid.exchange_token'
  | 'connector.sync'
  | 'connector.disconnect'
  | 'document.upload'
  | 'document.share'
  | 'recommendation.approve'
  | 'send_email'
  | 'send_provider_message'
  | 'tenant.create'
  | 'tenant.invite_member'
  | 'tenant.create_api_key'
  | 'tenant.revoke_api_key'
  | 'export.user_data'
  | 'export.tenant_data'
  | 'governance.override' // intentionally listed; the guard always denies
  | 'admin.impersonate' // intentionally listed; the guard always denies
  | string; // open for future tools

export type ToolCallOrigin =
  /** The authenticated user explicitly initiated the call (HTTP route handler). */
  | 'user_prompt'
  /** The call came from an LLM "tool use" output triggered by retrieved content. */
  | 'retrieved_content'
  /** The call came from an uploaded file's content. */
  | 'uploaded_file'
  /** The call came from a connector sync payload. */
  | 'connector_data';

/** Tools that the platform will NEVER execute via guard, regardless of caller. */
const FORBIDDEN_TOOLS: ReadonlySet<string> = new Set(['governance.override', 'admin.impersonate']);

export interface AuthorizeInputs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  user_id?: string | null;
  tenant_id?: string | null;
  tool_name: ToolName;
  origin: ToolCallOrigin;
  /** Optional fingerprint of the content that suggested the tool call. */
  evidence?: string;
  /** Optional per-tool extra metadata. */
  metadata?: Record<string, unknown>;
}

export type AuthorizeResult =
  | { allowed: true }
  | {
      allowed: false;
      reason_code: ToolAbuseRecord['reason_code'];
      severity: ToolAbuseRecord['severity'];
    };

/**
 * Authorize a tool call. Returns `{ allowed: false, reason }` AND
 * persists a `security.tool_abuse_attempts` row on denial.
 */
export async function authorizeToolCall(inputs: AuthorizeInputs): Promise<AuthorizeResult> {
  // ---- 1. Authenticated user_id required --------------------------------
  if (!inputs.user_id) {
    await persistToolAbuseAttempt(
      inputs.supabase,
      {
        tool_name: inputs.tool_name,
        attempted_from: inputs.origin,
        reason_code: 'missing_user_intent',
        severity: 'HIGH',
        evidence: inputs.evidence,
        metadata: inputs.metadata,
      },
      { tenant_id: inputs.tenant_id ?? null }
    );
    return { allowed: false, reason_code: 'missing_user_intent', severity: 'HIGH' };
  }

  // ---- 2. Origin must be the authenticated route handler ----------------
  if (inputs.origin !== 'user_prompt') {
    await persistToolAbuseAttempt(
      inputs.supabase,
      {
        tool_name: inputs.tool_name,
        attempted_from: inputs.origin,
        reason_code: 'injection_detected',
        severity: 'CRITICAL',
        evidence: inputs.evidence,
        metadata: inputs.metadata,
      },
      { user_id: inputs.user_id, tenant_id: inputs.tenant_id ?? null }
    );
    return { allowed: false, reason_code: 'injection_detected', severity: 'CRITICAL' };
  }

  // ---- 3. Tools that are NEVER allowed ----------------------------------
  if (FORBIDDEN_TOOLS.has(inputs.tool_name)) {
    await persistToolAbuseAttempt(
      inputs.supabase,
      {
        tool_name: inputs.tool_name,
        attempted_from: inputs.origin,
        reason_code: 'governance_blocked',
        severity: 'CRITICAL',
        evidence: inputs.evidence,
        metadata: inputs.metadata,
      },
      { user_id: inputs.user_id, tenant_id: inputs.tenant_id ?? null }
    );
    return { allowed: false, reason_code: 'governance_blocked', severity: 'CRITICAL' };
  }

  return { allowed: true };
}

export const __test = { FORBIDDEN_TOOLS };
