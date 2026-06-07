-- 116_userscoped_views_secure_read_and_write.sql
--
-- Proper fix for the cross-user READ leak (replaces the 114->115 churn).
--
-- For the 41 user-scoped public views (chat handled separately by 113):
--   1. security_invoker = true  -> reads run as the caller, so the existing
--      owner-scoped RLS SELECT policy (user_id = auth.uid()) filters rows.
--      Closes the cross-user read leak.
--   2. GRANT INSERT, UPDATE to authenticated + ADD owner INSERT/UPDATE policies
--      (WITH CHECK user_id = auth.uid()) so the user-client write paths that
--      previously relied on the security_definer view keep working. These
--      policies are ADDITIVE/permissive: they can only allow owner writes,
--      never block an already-permitted write (service-role writers bypass RLS
--      entirely and are unaffected).
--
-- Net effect: read leak closed AND all writes preserved. Verified post-apply
-- via the live /api/agent/chat governance-audit write path.
--
-- Idempotent (DROP POLICY IF EXISTS + ALTER ... SET).

ALTER VIEW public.analytics_user_events SET (security_invoker = true);
GRANT INSERT, UPDATE ON analytics.user_events TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON analytics.user_events;
CREATE POLICY zz_auth_owner_insert ON analytics.user_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON analytics.user_events;
CREATE POLICY zz_auth_owner_update ON analytics.user_events FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.character_findings SET (security_invoker = true);
GRANT INSERT, UPDATE ON governance.character_findings TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON governance.character_findings;
CREATE POLICY zz_auth_owner_insert ON governance.character_findings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON governance.character_findings;
CREATE POLICY zz_auth_owner_update ON governance.character_findings FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.connectors_tenant_connections SET (security_invoker = true);
-- connectors.tenant_connections: tenant-scoped (is_tenant_member); read-fix only, no user_id write policy.

ALTER VIEW public.decision_governance_audit SET (security_invoker = true);
GRANT INSERT, UPDATE ON governance.decision_governance_audit TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON governance.decision_governance_audit;
CREATE POLICY zz_auth_owner_insert ON governance.decision_governance_audit FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON governance.decision_governance_audit;
CREATE POLICY zz_auth_owner_update ON governance.decision_governance_audit FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.decision_outcomes_v SET (security_invoker = true);
GRANT INSERT, UPDATE ON public.decision_outcomes TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON public.decision_outcomes;
CREATE POLICY zz_auth_owner_insert ON public.decision_outcomes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON public.decision_outcomes;
CREATE POLICY zz_auth_owner_update ON public.decision_outcomes FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.economic_abuse_events SET (security_invoker = true);
GRANT INSERT, UPDATE ON economic.abuse_events TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON economic.abuse_events;
CREATE POLICY zz_auth_owner_insert ON economic.abuse_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON economic.abuse_events;
CREATE POLICY zz_auth_owner_update ON economic.abuse_events FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.economic_rate_limit_buckets SET (security_invoker = true);
GRANT INSERT, UPDATE ON economic.rate_limit_buckets TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON economic.rate_limit_buckets;
CREATE POLICY zz_auth_owner_insert ON economic.rate_limit_buckets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON economic.rate_limit_buckets;
CREATE POLICY zz_auth_owner_update ON economic.rate_limit_buckets FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.economic_usage_events SET (security_invoker = true);
GRANT INSERT, UPDATE ON economic.usage_events TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON economic.usage_events;
CREATE POLICY zz_auth_owner_insert ON economic.usage_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON economic.usage_events;
CREATE POLICY zz_auth_owner_update ON economic.usage_events FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.economic_user_budgets SET (security_invoker = true);
GRANT INSERT, UPDATE ON economic.user_budgets TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON economic.user_budgets;
CREATE POLICY zz_auth_owner_insert ON economic.user_budgets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON economic.user_budgets;
CREATE POLICY zz_auth_owner_update ON economic.user_budgets FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.feedback_bug_reports SET (security_invoker = true);
GRANT INSERT, UPDATE ON feedback.bug_reports TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON feedback.bug_reports;
CREATE POLICY zz_auth_owner_insert ON feedback.bug_reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON feedback.bug_reports;
CREATE POLICY zz_auth_owner_update ON feedback.bug_reports FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.feedback_nps_responses SET (security_invoker = true);
GRANT INSERT, UPDATE ON feedback.nps_responses TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON feedback.nps_responses;
CREATE POLICY zz_auth_owner_insert ON feedback.nps_responses FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON feedback.nps_responses;
CREATE POLICY zz_auth_owner_update ON feedback.nps_responses FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.feedback_overall_feedback SET (security_invoker = true);
GRANT INSERT, UPDATE ON feedback.overall_feedback TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON feedback.overall_feedback;
CREATE POLICY zz_auth_owner_insert ON feedback.overall_feedback FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON feedback.overall_feedback;
CREATE POLICY zz_auth_owner_update ON feedback.overall_feedback FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.feedback_recommendation_feedback SET (security_invoker = true);
GRANT INSERT, UPDATE ON feedback.recommendation_feedback TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON feedback.recommendation_feedback;
CREATE POLICY zz_auth_owner_insert ON feedback.recommendation_feedback FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON feedback.recommendation_feedback;
CREATE POLICY zz_auth_owner_update ON feedback.recommendation_feedback FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.feedback_recommendation_quality SET (security_invoker = true);
GRANT INSERT, UPDATE ON feedback.recommendation_quality TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON feedback.recommendation_quality;
CREATE POLICY zz_auth_owner_insert ON feedback.recommendation_quality FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON feedback.recommendation_quality;
CREATE POLICY zz_auth_owner_update ON feedback.recommendation_quality FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.feedback_simulation_feedback SET (security_invoker = true);
GRANT INSERT, UPDATE ON feedback.simulation_feedback TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON feedback.simulation_feedback;
CREATE POLICY zz_auth_owner_insert ON feedback.simulation_feedback FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON feedback.simulation_feedback;
CREATE POLICY zz_auth_owner_update ON feedback.simulation_feedback FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.governance_review_iterations SET (security_invoker = true);
GRANT INSERT, UPDATE ON governance.review_iterations TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON governance.review_iterations;
CREATE POLICY zz_auth_owner_insert ON governance.review_iterations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON governance.review_iterations;
CREATE POLICY zz_auth_owner_update ON governance.review_iterations FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.ingestion_extracted_entities SET (security_invoker = true);
GRANT INSERT, UPDATE ON ingestion.extracted_entities TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON ingestion.extracted_entities;
CREATE POLICY zz_auth_owner_insert ON ingestion.extracted_entities FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON ingestion.extracted_entities;
CREATE POLICY zz_auth_owner_update ON ingestion.extracted_entities FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.ingestion_extracted_facts SET (security_invoker = true);
GRANT INSERT, UPDATE ON ingestion.extracted_facts TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON ingestion.extracted_facts;
CREATE POLICY zz_auth_owner_insert ON ingestion.extracted_facts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON ingestion.extracted_facts;
CREATE POLICY zz_auth_owner_update ON ingestion.extracted_facts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.ingestion_extracted_relationships SET (security_invoker = true);
GRANT INSERT, UPDATE ON ingestion.extracted_relationships TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON ingestion.extracted_relationships;
CREATE POLICY zz_auth_owner_insert ON ingestion.extracted_relationships FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON ingestion.extracted_relationships;
CREATE POLICY zz_auth_owner_update ON ingestion.extracted_relationships FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.ingestion_extraction_jobs SET (security_invoker = true);
GRANT INSERT, UPDATE ON ingestion.extraction_jobs TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON ingestion.extraction_jobs;
CREATE POLICY zz_auth_owner_insert ON ingestion.extraction_jobs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON ingestion.extraction_jobs;
CREATE POLICY zz_auth_owner_update ON ingestion.extraction_jobs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.ingestion_extraction_telemetry SET (security_invoker = true);
GRANT INSERT, UPDATE ON ingestion.extraction_telemetry TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON ingestion.extraction_telemetry;
CREATE POLICY zz_auth_owner_insert ON ingestion.extraction_telemetry FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON ingestion.extraction_telemetry;
CREATE POLICY zz_auth_owner_update ON ingestion.extraction_telemetry FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.ingestion_extractions SET (security_invoker = true);
GRANT INSERT, UPDATE ON ingestion.extractions TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON ingestion.extractions;
CREATE POLICY zz_auth_owner_insert ON ingestion.extractions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON ingestion.extractions;
CREATE POLICY zz_auth_owner_update ON ingestion.extractions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.ingestion_file_versions SET (security_invoker = true);
GRANT INSERT, UPDATE ON ingestion.file_versions TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON ingestion.file_versions;
CREATE POLICY zz_auth_owner_insert ON ingestion.file_versions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON ingestion.file_versions;
CREATE POLICY zz_auth_owner_update ON ingestion.file_versions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.ingestion_files SET (security_invoker = true);
GRANT INSERT, UPDATE ON ingestion.files TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON ingestion.files;
CREATE POLICY zz_auth_owner_insert ON ingestion.files FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON ingestion.files;
CREATE POLICY zz_auth_owner_update ON ingestion.files FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.ingestion_malware_scans SET (security_invoker = true);
GRANT INSERT, UPDATE ON ingestion.malware_scans TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON ingestion.malware_scans;
CREATE POLICY zz_auth_owner_insert ON ingestion.malware_scans FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON ingestion.malware_scans;
CREATE POLICY zz_auth_owner_update ON ingestion.malware_scans FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.ingestion_multimodal_cost_meter SET (security_invoker = true);
GRANT INSERT, UPDATE ON ingestion.multimodal_cost_meter TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON ingestion.multimodal_cost_meter;
CREATE POLICY zz_auth_owner_insert ON ingestion.multimodal_cost_meter FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON ingestion.multimodal_cost_meter;
CREATE POLICY zz_auth_owner_update ON ingestion.multimodal_cost_meter FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.ingestion_provenance SET (security_invoker = true);
GRANT INSERT, UPDATE ON ingestion.provenance TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON ingestion.provenance;
CREATE POLICY zz_auth_owner_insert ON ingestion.provenance FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON ingestion.provenance;
CREATE POLICY zz_auth_owner_update ON ingestion.provenance FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.ops_llm_usage_meter SET (security_invoker = true);
GRANT INSERT, UPDATE ON ops.llm_usage_meter TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON ops.llm_usage_meter;
CREATE POLICY zz_auth_owner_insert ON ops.llm_usage_meter FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON ops.llm_usage_meter;
CREATE POLICY zz_auth_owner_update ON ops.llm_usage_meter FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.ops_user_cohorts SET (security_invoker = true);
GRANT INSERT, UPDATE ON ops.user_cohorts TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON ops.user_cohorts;
CREATE POLICY zz_auth_owner_insert ON ops.user_cohorts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON ops.user_cohorts;
CREATE POLICY zz_auth_owner_update ON ops.user_cohorts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.ops_user_feature_flag_overrides SET (security_invoker = true);
GRANT INSERT, UPDATE ON ops.user_feature_flag_overrides TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON ops.user_feature_flag_overrides;
CREATE POLICY zz_auth_owner_insert ON ops.user_feature_flag_overrides FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON ops.user_feature_flag_overrides;
CREATE POLICY zz_auth_owner_update ON ops.user_feature_flag_overrides FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.outcome_attribution_links SET (security_invoker = true);
GRANT INSERT, UPDATE ON outcome.attribution_links TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON outcome.attribution_links;
CREATE POLICY zz_auth_owner_insert ON outcome.attribution_links FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON outcome.attribution_links;
CREATE POLICY zz_auth_owner_update ON outcome.attribution_links FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.outcome_decision_quality_index SET (security_invoker = true);
GRANT INSERT, UPDATE ON outcome.decision_quality_index TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON outcome.decision_quality_index;
CREATE POLICY zz_auth_owner_insert ON outcome.decision_quality_index FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON outcome.decision_quality_index;
CREATE POLICY zz_auth_owner_update ON outcome.decision_quality_index FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.outcome_goal_progress_snapshots SET (security_invoker = true);
GRANT INSERT, UPDATE ON outcome.goal_progress_snapshots TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON outcome.goal_progress_snapshots;
CREATE POLICY zz_auth_owner_insert ON outcome.goal_progress_snapshots FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON outcome.goal_progress_snapshots;
CREATE POLICY zz_auth_owner_update ON outcome.goal_progress_snapshots FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.outcome_life_progress_snapshots SET (security_invoker = true);
GRANT INSERT, UPDATE ON outcome.life_progress_snapshots TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON outcome.life_progress_snapshots;
CREATE POLICY zz_auth_owner_insert ON outcome.life_progress_snapshots FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON outcome.life_progress_snapshots;
CREATE POLICY zz_auth_owner_update ON outcome.life_progress_snapshots FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.outcome_recommendation_effectiveness SET (security_invoker = true);
GRANT INSERT, UPDATE ON outcome.recommendation_effectiveness TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON outcome.recommendation_effectiveness;
CREATE POLICY zz_auth_owner_insert ON outcome.recommendation_effectiveness FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON outcome.recommendation_effectiveness;
CREATE POLICY zz_auth_owner_update ON outcome.recommendation_effectiveness FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.platform_tenant_users SET (security_invoker = true);
GRANT INSERT, UPDATE ON platform.tenant_users TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON platform.tenant_users;
CREATE POLICY zz_auth_owner_insert ON platform.tenant_users FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON platform.tenant_users;
CREATE POLICY zz_auth_owner_update ON platform.tenant_users FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.projections_constitutional_layer_rules SET (security_invoker = true);
GRANT INSERT, UPDATE ON projections.constitutional_layer_rules TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON projections.constitutional_layer_rules;
CREATE POLICY zz_auth_owner_insert ON projections.constitutional_layer_rules FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON projections.constitutional_layer_rules;
CREATE POLICY zz_auth_owner_update ON projections.constitutional_layer_rules FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.projections_policy_decisions SET (security_invoker = true);
GRANT INSERT, UPDATE ON projections.policy_decisions TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON projections.policy_decisions;
CREATE POLICY zz_auth_owner_insert ON projections.policy_decisions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON projections.policy_decisions;
CREATE POLICY zz_auth_owner_update ON projections.policy_decisions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.security_prompt_injection_events SET (security_invoker = true);
GRANT INSERT, UPDATE ON security.prompt_injection_events TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON security.prompt_injection_events;
CREATE POLICY zz_auth_owner_insert ON security.prompt_injection_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON security.prompt_injection_events;
CREATE POLICY zz_auth_owner_update ON security.prompt_injection_events FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.security_tool_abuse_attempts SET (security_invoker = true);
GRANT INSERT, UPDATE ON security.tool_abuse_attempts TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON security.tool_abuse_attempts;
CREATE POLICY zz_auth_owner_insert ON security.tool_abuse_attempts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON security.tool_abuse_attempts;
CREATE POLICY zz_auth_owner_update ON security.tool_abuse_attempts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER VIEW public.security_untrusted_content_findings SET (security_invoker = true);
GRANT INSERT, UPDATE ON security.untrusted_content_findings TO authenticated;
DROP POLICY IF EXISTS zz_auth_owner_insert ON security.untrusted_content_findings;
CREATE POLICY zz_auth_owner_insert ON security.untrusted_content_findings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zz_auth_owner_update ON security.untrusted_content_findings;
CREATE POLICY zz_auth_owner_update ON security.untrusted_content_findings FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

