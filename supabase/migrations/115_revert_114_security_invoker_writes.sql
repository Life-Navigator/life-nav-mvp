-- 115_revert_114_security_invoker_writes.sql
--
-- REVERT of migration 114 (partial — chat views excluded).
--
-- 114 set security_invoker=true on 43 user-scoped public views to close a
-- cross-user READ leak. But ~15 of those tables grant `authenticated` only
-- SELECT and depend on the security_definer view to perform PRIVILEGED INSERTs
-- (governance audit, economic metering, security/injection audit, ops, outcomes,
-- projections). Under security_invoker those writes run as `authenticated` and
-- fail "permission denied" — a regression that surfaced as 500s on /api/agent/chat
-- once the chat auth bug was fixed and governance actually ran.
--
-- This reverts security_invoker on the 41 NON-chat views, restoring the prior
-- (working) privileged-write behavior. chat_conversations + chat_messages are
-- INTENTIONALLY left security_invoker (migration 113) because chat writes use the
-- service-role client (lib/chat/persistence.ts) and are unaffected.
--
-- KNOWN P0 (pre-existing, now documented): these 41 views still leak cross-user on
-- READ. Proper fix = per-table either (a) move writes to service-role + keep
-- security_invoker, or (b) grant authenticated INSERT/UPDATE + add WITH CHECK
-- (user_id = auth.uid()) RLS policies so security_invoker views are read- AND
-- write-correct. Tracked in SPRINT_HANDOFF.md / BETA_READY_FINAL_VERDICT.md.

ALTER VIEW public.analytics_user_events SET (security_invoker = false);
ALTER VIEW public.character_findings SET (security_invoker = false);
ALTER VIEW public.connectors_tenant_connections SET (security_invoker = false);
ALTER VIEW public.decision_governance_audit SET (security_invoker = false);
ALTER VIEW public.decision_outcomes_v SET (security_invoker = false);
ALTER VIEW public.economic_abuse_events SET (security_invoker = false);
ALTER VIEW public.economic_rate_limit_buckets SET (security_invoker = false);
ALTER VIEW public.economic_usage_events SET (security_invoker = false);
ALTER VIEW public.economic_user_budgets SET (security_invoker = false);
ALTER VIEW public.feedback_bug_reports SET (security_invoker = false);
ALTER VIEW public.feedback_nps_responses SET (security_invoker = false);
ALTER VIEW public.feedback_overall_feedback SET (security_invoker = false);
ALTER VIEW public.feedback_recommendation_feedback SET (security_invoker = false);
ALTER VIEW public.feedback_recommendation_quality SET (security_invoker = false);
ALTER VIEW public.feedback_simulation_feedback SET (security_invoker = false);
ALTER VIEW public.governance_review_iterations SET (security_invoker = false);
ALTER VIEW public.ingestion_extracted_entities SET (security_invoker = false);
ALTER VIEW public.ingestion_extracted_facts SET (security_invoker = false);
ALTER VIEW public.ingestion_extracted_relationships SET (security_invoker = false);
ALTER VIEW public.ingestion_extraction_jobs SET (security_invoker = false);
ALTER VIEW public.ingestion_extraction_telemetry SET (security_invoker = false);
ALTER VIEW public.ingestion_extractions SET (security_invoker = false);
ALTER VIEW public.ingestion_file_versions SET (security_invoker = false);
ALTER VIEW public.ingestion_files SET (security_invoker = false);
ALTER VIEW public.ingestion_malware_scans SET (security_invoker = false);
ALTER VIEW public.ingestion_multimodal_cost_meter SET (security_invoker = false);
ALTER VIEW public.ingestion_provenance SET (security_invoker = false);
ALTER VIEW public.ops_llm_usage_meter SET (security_invoker = false);
ALTER VIEW public.ops_user_cohorts SET (security_invoker = false);
ALTER VIEW public.ops_user_feature_flag_overrides SET (security_invoker = false);
ALTER VIEW public.outcome_attribution_links SET (security_invoker = false);
ALTER VIEW public.outcome_decision_quality_index SET (security_invoker = false);
ALTER VIEW public.outcome_goal_progress_snapshots SET (security_invoker = false);
ALTER VIEW public.outcome_life_progress_snapshots SET (security_invoker = false);
ALTER VIEW public.outcome_recommendation_effectiveness SET (security_invoker = false);
ALTER VIEW public.platform_tenant_users SET (security_invoker = false);
ALTER VIEW public.projections_constitutional_layer_rules SET (security_invoker = false);
ALTER VIEW public.projections_policy_decisions SET (security_invoker = false);
ALTER VIEW public.security_prompt_injection_events SET (security_invoker = false);
ALTER VIEW public.security_tool_abuse_attempts SET (security_invoker = false);
ALTER VIEW public.security_untrusted_content_findings SET (security_invoker = false);
