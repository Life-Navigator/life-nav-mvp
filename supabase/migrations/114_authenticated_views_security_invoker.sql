-- 114_authenticated_views_security_invoker.sql
--
-- SECURITY FIX (systemic) — companion to 113.
--
-- Audit (2026-06-06) found that EVERY public view granted SELECT to
-- `authenticated` was created WITHOUT security_invoker. Because a normal view
-- runs its underlying reads as the view OWNER (a BYPASSRLS superuser), the
-- row-level security on the user-scoped base tables was bypassed for any read
-- through the public.* view layer.
--
-- Live proof: an authenticated identity owning nothing read all 50
-- economic_user_budgets rows and all 1,163 analytics_user_events rows through
-- the views, while direct base-table access was denied. Cross-user leak.
--
-- This migration sets security_invoker = true on the 43 USER-SCOPED views
-- (base table has RLS + a user_id column). After this, each view evaluates the
-- base table's RLS as the querying role, so the owner-only policies apply.
--
-- NOT included here (require separate classification — RLS but no user_id;
-- tenant/global config that may intentionally serve all authenticated users):
--   connectors_connector_registry, constitutional_entities,
--   economic_circuit_breakers, economic_platform_budget,
--   governance_agent_registry, governance_policy_versions,
--   governance_safety_messages, models_model_registry,
--   models_tenant_model_overrides, ops_beta_invites, ops_cohorts,
--   ops_feature_flags, outcome_tenant_reports, platform_tenant_api_keys,
--   platform_tenant_api_usage, platform_tenant_quotas, platform_tenants,
--   projections_enterprise_projections, projections_industry_templates,
--   projections_organization_policies
--
-- Idempotent; requires PostgreSQL 15+ (prod is 17.6).

ALTER VIEW public.analytics_user_events SET (security_invoker = true);
ALTER VIEW public.character_findings SET (security_invoker = true);
ALTER VIEW public.chat_conversations SET (security_invoker = true);
ALTER VIEW public.chat_messages SET (security_invoker = true);
ALTER VIEW public.connectors_tenant_connections SET (security_invoker = true);
ALTER VIEW public.decision_governance_audit SET (security_invoker = true);
ALTER VIEW public.decision_outcomes_v SET (security_invoker = true);
ALTER VIEW public.economic_abuse_events SET (security_invoker = true);
ALTER VIEW public.economic_rate_limit_buckets SET (security_invoker = true);
ALTER VIEW public.economic_usage_events SET (security_invoker = true);
ALTER VIEW public.economic_user_budgets SET (security_invoker = true);
ALTER VIEW public.feedback_bug_reports SET (security_invoker = true);
ALTER VIEW public.feedback_nps_responses SET (security_invoker = true);
ALTER VIEW public.feedback_overall_feedback SET (security_invoker = true);
ALTER VIEW public.feedback_recommendation_feedback SET (security_invoker = true);
ALTER VIEW public.feedback_recommendation_quality SET (security_invoker = true);
ALTER VIEW public.feedback_simulation_feedback SET (security_invoker = true);
ALTER VIEW public.governance_review_iterations SET (security_invoker = true);
ALTER VIEW public.ingestion_extracted_entities SET (security_invoker = true);
ALTER VIEW public.ingestion_extracted_facts SET (security_invoker = true);
ALTER VIEW public.ingestion_extracted_relationships SET (security_invoker = true);
ALTER VIEW public.ingestion_extraction_jobs SET (security_invoker = true);
ALTER VIEW public.ingestion_extraction_telemetry SET (security_invoker = true);
ALTER VIEW public.ingestion_extractions SET (security_invoker = true);
ALTER VIEW public.ingestion_file_versions SET (security_invoker = true);
ALTER VIEW public.ingestion_files SET (security_invoker = true);
ALTER VIEW public.ingestion_malware_scans SET (security_invoker = true);
ALTER VIEW public.ingestion_multimodal_cost_meter SET (security_invoker = true);
ALTER VIEW public.ingestion_provenance SET (security_invoker = true);
ALTER VIEW public.ops_llm_usage_meter SET (security_invoker = true);
ALTER VIEW public.ops_user_cohorts SET (security_invoker = true);
ALTER VIEW public.ops_user_feature_flag_overrides SET (security_invoker = true);
ALTER VIEW public.outcome_attribution_links SET (security_invoker = true);
ALTER VIEW public.outcome_decision_quality_index SET (security_invoker = true);
ALTER VIEW public.outcome_goal_progress_snapshots SET (security_invoker = true);
ALTER VIEW public.outcome_life_progress_snapshots SET (security_invoker = true);
ALTER VIEW public.outcome_recommendation_effectiveness SET (security_invoker = true);
ALTER VIEW public.platform_tenant_users SET (security_invoker = true);
ALTER VIEW public.projections_constitutional_layer_rules SET (security_invoker = true);
ALTER VIEW public.projections_policy_decisions SET (security_invoker = true);
ALTER VIEW public.security_prompt_injection_events SET (security_invoker = true);
ALTER VIEW public.security_tool_abuse_attempts SET (security_invoker = true);
ALTER VIEW public.security_untrusted_content_findings SET (security_invoker = true);
