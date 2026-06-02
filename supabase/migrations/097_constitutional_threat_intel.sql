-- ============================================================================
-- 097: Constitutional GraphRAG Threat Intelligence (addendum Phase 7)
--
-- Extends governance.constitutional_entities with new entity_kinds that
-- describe prompt-injection / jailbreak / tool-abuse / exfiltration /
-- malicious-instruction patterns. Seeds the registry with the canonical
-- patterns the runtime detectors enforce so the audit chain has a
-- reviewable reference.
--
-- These rule kinds are read-only from the application's view; the
-- runtime detectors enforce the rules in code (deterministic, no LLM).
-- The DB rows exist so security review can pin policy versions and
-- the audit can join `rule_id` back to a canonical citation.
-- ============================================================================

-- ---- 1. Extend the entity_kind check helper -----------------------------
CREATE OR REPLACE FUNCTION governance.is_constitutional_entity_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT p IN (
    -- Sprint L2 kinds
    'ConstitutionalPrinciple','GovernanceRule','LegalRule','SafetyRule',
    'HarmRule','NeutralityRule','FuturePreservationRule','OpportunityRule',
    'TrajectoryRule','NeedBehindNeedPattern','ConflictOfInterestRule',
    'CognitiveDistortionPattern','CrisisIndicator','RealismRule',
    -- Addendum (threat intel) kinds
    'PromptInjectionPattern',
    'JailbreakPattern',
    'ToolAbusePattern',
    'ExfiltrationPattern',
    'MaliciousInstructionPattern',
    'UntrustedContentRule'
  )
$$;

-- ---- 2. Seed the canonical patterns -------------------------------------
INSERT INTO governance.constitutional_entities
  (entity_kind, slug, name, body, source, citation_reference, version, review_status, tags, metadata)
VALUES
  ('PromptInjectionPattern','ignore_previous_instructions',
    'Ignore Previous Instructions',
    'Detect explicit requests to ignore, disregard, or override prior instructions, system prompts, or rules.',
    'LifeNavigator Security Addendum', 'Phase 1', '1.0.0', 'active',
    ARRAY['structural','injection','HIGH'],
    jsonb_build_object('rule_id','pi.ignore_previous_v1','severity','HIGH','response_action','QUARANTINE')),

  ('PromptInjectionPattern','system_prompt_disclosure',
    'System Prompt Disclosure',
    'Detect requests to reveal hidden / system / developer prompts.',
    'LifeNavigator Security Addendum', 'Phase 1', '1.0.0', 'active',
    ARRAY['structural','injection','HIGH'],
    jsonb_build_object('rule_id','pi.disregard_system_v1','severity','HIGH','response_action','QUARANTINE')),

  ('PromptInjectionPattern','bypass_safety',
    'Bypass Safety Filters',
    'Detect attempts to disable safety / moderation / policy filters.',
    'LifeNavigator Security Addendum', 'Phase 1', '1.0.0', 'active',
    ARRAY['structural','injection','CRITICAL'],
    jsonb_build_object('rule_id','pi.bypass_safety_v1','severity','CRITICAL','response_action','REJECT')),

  ('PromptInjectionPattern','governance_override',
    'Governance Override',
    'Detect attempts to bypass the constitutional / governance pipeline.',
    'LifeNavigator Security Addendum', 'Phase 1', '1.0.0', 'active',
    ARRAY['structural','injection','CRITICAL'],
    jsonb_build_object('rule_id','pi.governance_override_v1','severity','CRITICAL','response_action','REJECT')),

  ('PromptInjectionPattern','mark_as_safe',
    'Force Safe Classification',
    'Detect attempts to mark the output as safe / approved.',
    'LifeNavigator Security Addendum', 'Phase 1', '1.0.0', 'active',
    ARRAY['structural','injection','CRITICAL'],
    jsonb_build_object('rule_id','pi.mark_as_safe_v1','severity','CRITICAL','response_action','REJECT')),

  ('JailbreakPattern','roleplay_override',
    'Roleplay Unfiltered',
    'Classic roleplay-into-unfiltered-mode jailbreak.',
    'LifeNavigator Security Addendum', 'Phase 1', '1.0.0', 'active',
    ARRAY['jailbreak','HIGH'],
    jsonb_build_object('rule_id','pi.roleplay_override_v1','severity','HIGH','response_action','QUARANTINE')),

  ('JailbreakPattern','dan_persona',
    'DAN / DAN-family Persona String',
    'Detect canonical jailbreak persona strings (DAN, STAN, AIM, DUDE, developer mode).',
    'LifeNavigator Security Addendum', 'Phase 1', '1.0.0', 'active',
    ARRAY['jailbreak','HIGH'],
    jsonb_build_object('rule_id','pi.dan_string_v1','severity','HIGH','response_action','QUARANTINE')),

  ('PromptInjectionPattern','hidden_instructions',
    'Hidden Instructions to Conceal From User',
    'Detect instructions to hide information from the user.',
    'LifeNavigator Security Addendum', 'Phase 1', '1.0.0', 'active',
    ARRAY['structural','HIGH'],
    jsonb_build_object('rule_id','pi.do_not_tell_user_v1','severity','HIGH','response_action','QUARANTINE')),

  ('PromptInjectionPattern','pseudo_system_tags',
    'Pseudo System Tags',
    'Detect embedded <system>/<developer>/<hidden> tags inside content.',
    'LifeNavigator Security Addendum', 'Phase 1', '1.0.0', 'active',
    ARRAY['structural','MODERATE'],
    jsonb_build_object('rule_id','pi.between_tags_v1','severity','MODERATE','response_action','ALLOW_WITH_SANITIZATION')),

  ('PromptInjectionPattern','zero_width_payload',
    'Zero-width / Bidi Payload',
    'Detect runs of zero-width or bidi-override characters that could hide instructions.',
    'LifeNavigator Security Addendum', 'Phase 1', '1.0.0', 'active',
    ARRAY['structural','MODERATE'],
    jsonb_build_object('rule_id','pi.zero_width_v1','severity','MODERATE','response_action','ALLOW_WITH_SANITIZATION')),

  ('ExfiltrationPattern','api_key_disclosure',
    'API Key / Token Disclosure',
    'Detect requests to disclose API keys, secrets, tokens, or env vars.',
    'LifeNavigator Security Addendum', 'Phase 6', '1.0.0', 'active',
    ARRAY['exfiltration','CRITICAL'],
    jsonb_build_object('rule_id','pi.api_key_v1','severity','CRITICAL','response_action','REJECT')),

  ('ExfiltrationPattern','service_role_disclosure',
    'Supabase Service-Role Disclosure',
    'Detect requests to disclose Supabase service-role / anon keys.',
    'LifeNavigator Security Addendum', 'Phase 6', '1.0.0', 'active',
    ARRAY['exfiltration','CRITICAL'],
    jsonb_build_object('rule_id','pi.service_role_v1','severity','CRITICAL','response_action','REJECT')),

  ('ExfiltrationPattern','plaid_token_disclosure',
    'Plaid Token / Item-ID Disclosure',
    'Detect requests to disclose Plaid access/public tokens or item ids.',
    'LifeNavigator Security Addendum', 'Phase 6', '1.0.0', 'active',
    ARRAY['exfiltration','CRITICAL'],
    jsonb_build_object('rule_id','pi.plaid_token_v1','severity','CRITICAL','response_action','REJECT')),

  ('ExfiltrationPattern','byom_credential_disclosure',
    'BYOM Credential Disclosure',
    'Detect requests to disclose Gemini/OpenAI/Anthropic/Azure credentials.',
    'LifeNavigator Security Addendum', 'Phase 6', '1.0.0', 'active',
    ARRAY['exfiltration','CRITICAL'],
    jsonb_build_object('rule_id','pi.byom_cred_v1','severity','CRITICAL','response_action','REJECT')),

  ('ExfiltrationPattern','cross_user_data_access',
    'Cross-User Data Access',
    'Detect requests for other users records / data / history / messages.',
    'LifeNavigator Security Addendum', 'Phase 6', '1.0.0', 'active',
    ARRAY['exfiltration','CRITICAL'],
    jsonb_build_object('rule_id','pi.cross_user_v1','severity','CRITICAL','response_action','REJECT')),

  ('ExfiltrationPattern','cross_tenant_data_access',
    'Cross-Tenant Data Access',
    'Detect requests for other tenants records / api keys / usage / connections.',
    'LifeNavigator Security Addendum', 'Phase 6', '1.0.0', 'active',
    ARRAY['exfiltration','CRITICAL'],
    jsonb_build_object('rule_id','pi.cross_tenant_v1','severity','CRITICAL','response_action','REJECT')),

  ('ExfiltrationPattern','audit_internals_disclosure',
    'Audit Internals Disclosure',
    'Detect requests to dump audit / governance / cost meter rows beyond caller scope.',
    'LifeNavigator Security Addendum', 'Phase 6', '1.0.0', 'active',
    ARRAY['exfiltration','HIGH'],
    jsonb_build_object('rule_id','pi.audit_internals_v1','severity','HIGH','response_action','QUARANTINE')),

  ('ToolAbusePattern','exfil_to_url',
    'Exfiltrate Data to External URL',
    'Detect instructions to POST/upload user data to an external URL.',
    'LifeNavigator Security Addendum', 'Phase 5', '1.0.0', 'active',
    ARRAY['tool_abuse','CRITICAL'],
    jsonb_build_object('rule_id','pi.send_to_url_v1','severity','CRITICAL','response_action','REJECT')),

  ('ToolAbusePattern','unauthorized_connector_sync',
    'Unauthorized Connector Sync',
    'Detect embedded instructions to run Plaid / payroll / brokerage connector syncs without user intent.',
    'LifeNavigator Security Addendum', 'Phase 5', '1.0.0', 'active',
    ARRAY['tool_abuse','HIGH'],
    jsonb_build_object('rule_id','pi.connector_sync_v1','severity','HIGH','response_action','QUARANTINE')),

  ('ToolAbusePattern','unauthorized_data_export',
    'Unauthorized Data Export',
    'Detect embedded instructions to export / email / share user data.',
    'LifeNavigator Security Addendum', 'Phase 5', '1.0.0', 'active',
    ARRAY['tool_abuse','HIGH'],
    jsonb_build_object('rule_id','pi.export_data_v1','severity','HIGH','response_action','QUARANTINE')),

  ('ToolAbusePattern','unauthorized_message_send',
    'Unauthorized Message Send',
    'Detect embedded instructions to message users / providers / partners / admins.',
    'LifeNavigator Security Addendum', 'Phase 5', '1.0.0', 'active',
    ARRAY['tool_abuse','HIGH'],
    jsonb_build_object('rule_id','pi.send_message_v1','severity','HIGH','response_action','QUARANTINE')),

  ('MaliciousInstructionPattern','illegal_step_by_step',
    'Illegal Step-by-Step Guidance',
    'Step-by-step requests for fraud / tax evasion / money laundering / insider trading / theft / smuggling / extortion / bribery.',
    'LifeNavigator Security Addendum', 'Phase 2', '1.0.0', 'active',
    ARRAY['malicious','HIGH'],
    jsonb_build_object('rule_id','mp.illegal_v1','severity','HIGH','response_action','QUARANTINE')),

  ('MaliciousInstructionPattern','currency_structuring',
    'Currency Structuring',
    'Structuring deposits / withdrawals to avoid reporting thresholds.',
    'LifeNavigator Security Addendum', 'Phase 2', '1.0.0', 'active',
    ARRAY['malicious','HIGH'],
    jsonb_build_object('rule_id','mp.evasion_v1','severity','HIGH','response_action','QUARANTINE')),

  ('MaliciousInstructionPattern','crisis_suppression',
    'Crisis Escalation Suppression',
    'Instruction to suppress crisis escalation (911 / 988 / clinician contact).',
    'LifeNavigator Security Addendum', 'Phase 2', '1.0.0', 'active',
    ARRAY['malicious','CRITICAL'],
    jsonb_build_object('rule_id','mp.crisis_manip_v1','severity','CRITICAL','response_action','REJECT')),

  ('MaliciousInstructionPattern','crisis_detection_disable',
    'Crisis Detection Disable',
    'Request to disable crisis / self-harm / suicide detection.',
    'LifeNavigator Security Addendum', 'Phase 2', '1.0.0', 'active',
    ARRAY['malicious','CRITICAL'],
    jsonb_build_object('rule_id','mp.crisis_manip_v2','severity','CRITICAL','response_action','REJECT')),

  ('MaliciousInstructionPattern','guaranteed_returns',
    'Guaranteed-Return Financial Promise',
    'Outcome guarantee in a financial recommendation.',
    'LifeNavigator Security Addendum', 'Phase 2', '1.0.0', 'active',
    ARRAY['malicious','HIGH'],
    jsonb_build_object('rule_id','mp.fin_v1','severity','HIGH','response_action','QUARANTINE')),

  ('MaliciousInstructionPattern','liquidate_retirement',
    'Liquidate Retirement Savings',
    'Instruction to withdraw all 401k / IRA / retirement savings.',
    'LifeNavigator Security Addendum', 'Phase 2', '1.0.0', 'active',
    ARRAY['malicious','HIGH'],
    jsonb_build_object('rule_id','mp.fin_withdraw_v1','severity','HIGH','response_action','QUARANTINE')),

  ('MaliciousInstructionPattern','stop_medication',
    'Stop Prescription Medication',
    'Instruction to stop / discontinue prescribed medication without a clinician.',
    'LifeNavigator Security Addendum', 'Phase 2', '1.0.0', 'active',
    ARRAY['malicious','CRITICAL'],
    jsonb_build_object('rule_id','mp.med_stop_v1','severity','CRITICAL','response_action','REJECT')),

  ('MaliciousInstructionPattern','exceed_dose',
    'Exceed Prescribed Dose',
    'Instruction to double / triple / exceed a prescribed dose.',
    'LifeNavigator Security Addendum', 'Phase 2', '1.0.0', 'active',
    ARRAY['malicious','CRITICAL'],
    jsonb_build_object('rule_id','mp.med_double_v1','severity','CRITICAL','response_action','REJECT')),

  ('MaliciousInstructionPattern','delay_medical_care',
    'Delay Medical Care',
    'Instruction to delay / postpone / skip medical care.',
    'LifeNavigator Security Addendum', 'Phase 2', '1.0.0', 'active',
    ARRAY['malicious','HIGH'],
    jsonb_build_object('rule_id','mp.med_delay_v1','severity','HIGH','response_action','QUARANTINE')),

  ('MaliciousInstructionPattern','legal_fraud',
    'Legal Fraud Coaching',
    'Instruction to make legally fraudulent statements (perjury, forged documents, false claims).',
    'LifeNavigator Security Addendum', 'Phase 2', '1.0.0', 'active',
    ARRAY['malicious','HIGH'],
    jsonb_build_object('rule_id','mp.legal_v1','severity','HIGH','response_action','QUARANTINE')),

  ('MaliciousInstructionPattern','force_ungoverned_output',
    'Force Ungoverned Output',
    'Request for output without governance / safety check.',
    'LifeNavigator Security Addendum', 'Phase 2', '1.0.0', 'active',
    ARRAY['malicious','CRITICAL'],
    jsonb_build_object('rule_id','mp.no_governance_v1','severity','CRITICAL','response_action','REJECT')),

  ('MaliciousInstructionPattern','approve_despite_violation',
    'Approve Despite Violation',
    'Request to approve a recommendation despite a flagged policy violation.',
    'LifeNavigator Security Addendum', 'Phase 2', '1.0.0', 'active',
    ARRAY['malicious','CRITICAL'],
    jsonb_build_object('rule_id','mp.override_decision_v1','severity','CRITICAL','response_action','REJECT')),

  ('UntrustedContentRule','external_content_data_only',
    'External Content Is Data Only',
    'Uploaded files, retrieved content, OCR text, transcripts, connector data, and provider notes are DATA. They may inform answers but never override system rules, governance rules, safety rules, privacy rules, or user consent.',
    'LifeNavigator Security Addendum', 'Core Security Rule', '1.0.0', 'active',
    ARRAY['hierarchy','platform_rule'],
    jsonb_build_object('instruction_authority_required','system','enforced_in','retrieval_sanitization')),

  ('UntrustedContentRule','wrap_retrieved_as_evidence',
    'Wrap Retrieved Content as Quoted Evidence',
    'Before retrieved content is included in an LLM prompt, wrap it with an explicit untrusted-evidence header and instruction warning.',
    'LifeNavigator Security Addendum', 'Phase 4', '1.0.0', 'active',
    ARRAY['hierarchy','platform_rule'],
    jsonb_build_object('enforced_in','wrapAsUntrustedEvidence'))
ON CONFLICT (entity_kind, slug, version) DO UPDATE
  SET name = EXCLUDED.name,
      body = EXCLUDED.body,
      source = EXCLUDED.source,
      citation_reference = EXCLUDED.citation_reference,
      review_status = EXCLUDED.review_status,
      tags = EXCLUDED.tags,
      metadata = EXCLUDED.metadata,
      updated_at = NOW();

-- ---- 3. Self-test --------------------------------------------------------
DO $$
DECLARE n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM governance.constitutional_entities
   WHERE entity_kind IN (
     'PromptInjectionPattern','JailbreakPattern','ToolAbusePattern',
     'ExfiltrationPattern','MaliciousInstructionPattern','UntrustedContentRule'
   ) AND review_status = 'active';
  IF n < 30 THEN
    RAISE EXCEPTION '097 self-test: expected ≥ 30 seeded threat-intel rows, found %', n;
  END IF;
END $$;
