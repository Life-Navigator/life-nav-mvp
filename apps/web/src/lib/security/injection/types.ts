/**
 * Prompt-injection defense — shared types.
 *
 * Used by:
 *   - PromptInjectionDetector
 *   - MaliciousPromptingDetector
 *   - The runtime guards that scan ingested + outgoing content
 *   - The audit persistence layer
 *
 * Detection is deterministic (regex + lexical features). The output
 * is recorded in `security.prompt_injection_events` so the audit
 * chain is the source of truth.
 */

export type InjectionSeverity = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export const INJECTION_SEVERITY_RANK: Record<InjectionSeverity, number> = {
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  CRITICAL: 3,
};

export type InjectionCategory =
  // Phase 1 — structural injection
  | 'ignore_previous_instructions'
  | 'system_prompt_disclosure'
  | 'bypass_safety'
  | 'governance_override'
  | 'roleplay_override'
  | 'hidden_instructions'
  | 'jailbreak_string'
  // Phase 2 — malicious prompting
  | 'illegal_guidance'
  | 'crisis_manipulation'
  | 'unsafe_financial_advice'
  | 'unsafe_medical_advice'
  | 'unsafe_legal_advice'
  | 'force_ungoverned_output'
  // Phase 6 — exfiltration
  | 'api_key_disclosure'
  | 'service_role_disclosure'
  | 'plaid_token_disclosure'
  | 'byom_credential_disclosure'
  | 'tenant_secret_disclosure'
  | 'cross_user_data_access'
  | 'cross_tenant_data_access'
  | 'audit_internals_disclosure'
  // Phase 5 — tool abuse
  | 'tool_call_without_consent'
  | 'connector_sync_without_consent'
  | 'data_export_without_consent'
  | 'send_message_without_consent'
  | 'governance_decision_override';

export type ContentOrigin =
  | 'user_prompt'
  | 'uploaded_file'
  | 'pdf'
  | 'ocr'
  | 'docx'
  | 'xlsx'
  | 'audio_transcript'
  | 'video_transcript'
  | 'image_extraction'
  | 'web'
  | 'connector'
  | 'provider_note'
  | 'partner_document'
  | 'enterprise_knowledge'
  | 'system'
  | 'developer';

export type InstructionAuthority =
  /** System / Platform Constitution. Highest. */
  | 'system'
  /** Developer / Application Rules. */
  | 'developer'
  /** Governance Policies. */
  | 'governance'
  /** Authenticated user instruction with provenance. */
  | 'user'
  /** None — content is DATA only, never instruction. */
  | 'none';

/** Single detector finding. */
export interface InjectionFinding {
  category: InjectionCategory;
  severity: InjectionSeverity;
  /** Stable machine id for the matched pattern. */
  rule_id: string;
  /** Short, redacted phrase from the input that triggered the rule. */
  evidence: string;
  /** Reason in plain language. */
  reason: string;
}

/** Action taken on a payload after detection. */
export type InjectionAction =
  | 'ALLOW_WITH_SANITIZATION'
  | 'QUARANTINE'
  | 'REJECT'
  | 'MANUAL_REVIEW'
  | 'ALLOW';

export interface DetectionInputs {
  text: string;
  /** Where this text comes from. Affects severity weighting. */
  origin: ContentOrigin;
  /**
   * What authority THIS content is allowed to carry. External content
   * is always 'none' — it can never become instruction. The system
   * prompt is 'system'. The user prompt is 'user'.
   */
  authority?: InstructionAuthority;
  /** Optional: max characters to consider (defaults to 64K). */
  max_chars?: number;
}

export interface DetectionResult {
  findings: InjectionFinding[];
  highest_severity: InjectionSeverity;
  action: InjectionAction;
  /** Sanitized text — original with injection markers stripped + wrap. */
  sanitized_text: string;
  /** True when the original was modified. */
  modified: boolean;
  /** Total bytes scanned. */
  bytes_scanned: number;
  /** Stable hash of the original input (for the audit row). */
  input_hash: string;
}

export interface InjectionAuditRow {
  user_id?: string | null;
  tenant_id?: string | null;
  file_id?: string | null;
  extraction_id?: string | null;
  source_type: ContentOrigin;
  severity: InjectionSeverity;
  matched_category: InjectionCategory;
  action_taken: InjectionAction;
  evidence: string;
  rule_id: string;
  metadata?: Record<string, unknown>;
}
