-- ============================================================================
-- Scenario Lab - Row Level Security Policies
-- ============================================================================
-- This migration enables RLS and creates policies for all Scenario Lab tables
-- Run AFTER 005_scenario_lab_schema.sql
-- ============================================================================

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================
ALTER TABLE public.scenario_labs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_extracted_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_sim_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_goal_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SCENARIO_LABS POLICIES
-- ============================================================================
CREATE POLICY "Users can view own scenarios"
  ON public.scenario_labs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own scenarios"
  ON public.scenario_labs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scenarios"
  ON public.scenario_labs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own scenarios"
  ON public.scenario_labs FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SCENARIO_VERSIONS POLICIES
-- ============================================================================
CREATE POLICY "Users can view own scenario versions"
  ON public.scenario_versions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own scenario versions"
  ON public.scenario_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Versions are immutable (no UPDATE/DELETE policies)

-- ============================================================================
-- SCENARIO_DOCUMENTS POLICIES
-- ============================================================================
CREATE POLICY "Users can view own documents"
  ON public.scenario_documents FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can upload own documents"
  ON public.scenario_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can soft-delete own documents"
  ON public.scenario_documents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- SCENARIO_EXTRACTED_FIELDS POLICIES
-- ============================================================================
CREATE POLICY "Users can view own extracted fields"
  ON public.scenario_extracted_fields FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own extracted fields"
  ON public.scenario_extracted_fields FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own extracted fields"
  ON public.scenario_extracted_fields FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own extracted fields"
  ON public.scenario_extracted_fields FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SCENARIO_INPUTS POLICIES
-- ============================================================================
CREATE POLICY "Users can view own inputs"
  ON public.scenario_inputs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own inputs"
  ON public.scenario_inputs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own inputs"
  ON public.scenario_inputs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own inputs"
  ON public.scenario_inputs FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SCENARIO_SIM_RUNS POLICIES
-- ============================================================================
CREATE POLICY "Users can view own sim runs"
  ON public.scenario_sim_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sim runs"
  ON public.scenario_sim_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sim runs"
  ON public.scenario_sim_runs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- SCENARIO_GOAL_SNAPSHOTS POLICIES
-- ============================================================================
CREATE POLICY "Users can view own goal snapshots"
  ON public.scenario_goal_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own goal snapshots"
  ON public.scenario_goal_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Snapshots are immutable (no UPDATE/DELETE policies)

-- ============================================================================
-- PLANS POLICIES
-- ============================================================================
CREATE POLICY "Users can view own plans"
  ON public.plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own plans"
  ON public.plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plans"
  ON public.plans FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own plans"
  ON public.plans FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- PLAN_PHASES POLICIES
-- ============================================================================
CREATE POLICY "Users can view own plan phases"
  ON public.plan_phases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own plan phases"
  ON public.plan_phases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plan phases"
  ON public.plan_phases FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own plan phases"
  ON public.plan_phases FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- PLAN_TASKS POLICIES
-- ============================================================================
CREATE POLICY "Users can view own plan tasks"
  ON public.plan_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own plan tasks"
  ON public.plan_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plan tasks"
  ON public.plan_tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own plan tasks"
  ON public.plan_tasks FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SCENARIO_REPORTS POLICIES
-- ============================================================================
CREATE POLICY "Users can view own reports"
  ON public.scenario_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own reports"
  ON public.scenario_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports"
  ON public.scenario_reports FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- SCENARIO_PINS POLICIES
-- ============================================================================
CREATE POLICY "Users can view own pin"
  ON public.scenario_pins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own pin"
  ON public.scenario_pins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pin"
  ON public.scenario_pins FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own pin"
  ON public.scenario_pins FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SCENARIO_AUDIT_LOG POLICIES
-- ============================================================================
CREATE POLICY "Users can view own audit logs"
  ON public.scenario_audit_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own audit logs"
  ON public.scenario_audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Audit logs are append-only (no UPDATE/DELETE policies)

-- ============================================================================
-- SCENARIO_JOBS POLICIES
-- ============================================================================
CREATE POLICY "Users can view own jobs"
  ON public.scenario_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own jobs"
  ON public.scenario_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs"
  ON public.scenario_jobs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
