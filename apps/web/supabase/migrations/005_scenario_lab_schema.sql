-- ============================================================================
-- Scenario Lab - Core Schema
-- ============================================================================
-- This migration creates all tables for the Scenario Lab module
-- Run AFTER 004_enhanced_schema.sql
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SCENARIO_LABS (Scenario Header)
-- ============================================================================
CREATE TABLE public.scenario_labs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Metadata
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'flask',
  color TEXT DEFAULT '#3B82F6',

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'committed', 'archived')),
  committed_at TIMESTAMPTZ,
  committed_version_id UUID,  -- Reference to the committed version

  -- Current working version (for draft/active scenarios)
  current_version_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scenario_labs_user ON public.scenario_labs(user_id, created_at DESC);
CREATE INDEX idx_scenario_labs_status ON public.scenario_labs(status);

-- ============================================================================
-- SCENARIO_VERSIONS (Immutable Save States)
-- ============================================================================
CREATE TABLE public.scenario_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scenario_id UUID NOT NULL REFERENCES public.scenario_labs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Version metadata
  version_number INT NOT NULL,
  version_label TEXT,
  is_committed BOOLEAN DEFAULT FALSE,

  -- Reproducibility tracking
  inputs_hash TEXT NOT NULL,  -- SHA256 of combined inputs for cache/dedup

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(scenario_id, version_number)
);

CREATE INDEX idx_scenario_versions_scenario ON public.scenario_versions(scenario_id, version_number DESC);
CREATE INDEX idx_scenario_versions_user ON public.scenario_versions(user_id);
CREATE INDEX idx_scenario_versions_hash ON public.scenario_versions(inputs_hash);

-- ============================================================================
-- SCENARIO_DOCUMENTS (Uploaded Files Metadata)
-- ============================================================================
CREATE TABLE public.scenario_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scenario_id UUID NOT NULL REFERENCES public.scenario_labs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- File metadata
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,  -- 'pdf', 'png', 'jpeg', 'jpg'
  file_size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,

  -- Storage
  storage_bucket TEXT NOT NULL DEFAULT 'scenario-docs',
  storage_path TEXT NOT NULL,
  content_hash TEXT NOT NULL,  -- SHA256 for deduplication

  -- Document classification
  document_type TEXT CHECK (document_type IN ('bank_statement', 'pay_stub', 'tuition_bill', 'loan_statement', 'insurance', 'medical_bill', 'lease', 'other')),

  -- Processing status
  ocr_status TEXT NOT NULL DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'queued', 'processing', 'completed', 'failed')),
  ocr_job_id UUID,  -- Reference to scenario_jobs

  -- Soft delete
  deleted_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scenario_documents_scenario ON public.scenario_documents(scenario_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_scenario_documents_user ON public.scenario_documents(user_id);
CREATE INDEX idx_scenario_documents_hash ON public.scenario_documents(content_hash);
CREATE INDEX idx_scenario_documents_ocr_status ON public.scenario_documents(ocr_status);

-- ============================================================================
-- SCENARIO_EXTRACTED_FIELDS (Raw OCR/Extraction Output)
-- ============================================================================
-- These are RAW extracted fields. Never used directly for simulation.
-- User must approve them first, then they are copied to scenario_inputs.
CREATE TABLE public.scenario_extracted_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES public.scenario_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Field metadata
  field_key TEXT NOT NULL,  -- e.g., "monthly_income", "tuition_cost", "rent"
  field_value TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('number', 'currency', 'date', 'text', 'boolean')),

  -- Extraction quality
  confidence_score FLOAT NOT NULL,  -- 0.0 to 1.0
  extraction_method TEXT NOT NULL,  -- 'ocr_pattern', 'pdf_text', 'heuristic'

  -- Source reference
  source_page INT,
  source_bbox JSONB,  -- {x, y, width, height}
  source_text TEXT,

  -- Redaction flag (for sensitive data)
  was_redacted BOOLEAN DEFAULT FALSE,
  redaction_reason TEXT,  -- e.g., "SSN_PATTERN", "CC_PATTERN"

  -- Approval status
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'edited', 'rejected')),
  approved_at TIMESTAMPTZ,
  edited_value TEXT,  -- If user edited the value
  rejected_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_extracted_fields_document ON public.scenario_extracted_fields(document_id);
CREATE INDEX idx_extracted_fields_user ON public.scenario_extracted_fields(user_id);
CREATE INDEX idx_extracted_fields_approval ON public.scenario_extracted_fields(approval_status);

-- ============================================================================
-- SCENARIO_INPUTS (User-Approved Structured Inputs for Simulation)
-- ============================================================================
-- This is the ONLY table the simulator reads from.
-- Contains both manual inputs and approved extracted fields.
CREATE TABLE public.scenario_inputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scenario_version_id UUID NOT NULL REFERENCES public.scenario_versions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Input source
  source_type TEXT NOT NULL CHECK (source_type IN ('manual', 'extracted')),
  source_field_id UUID,  -- Reference to scenario_extracted_fields if source_type='extracted'

  -- Input data
  input_key TEXT NOT NULL,
  input_value JSONB NOT NULL,  -- Structured value
  input_type TEXT NOT NULL,  -- 'timeline', 'budget', 'income', 'expense', 'asset', 'liability', 'constraint'

  -- Metadata
  unit TEXT,  -- 'USD', 'months', 'hours', etc.
  confidence FLOAT,  -- For extracted inputs

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(scenario_version_id, input_key, source_type)
);

CREATE INDEX idx_scenario_inputs_version ON public.scenario_inputs(scenario_version_id);
CREATE INDEX idx_scenario_inputs_type ON public.scenario_inputs(input_type);

-- ============================================================================
-- SCENARIO_SIM_RUNS (Simulation Run Metadata)
-- ============================================================================
CREATE TABLE public.scenario_sim_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scenario_version_id UUID NOT NULL REFERENCES public.scenario_versions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Reproducibility
  model_version TEXT NOT NULL,  -- e.g., 'v1.0.0'
  seed BIGINT NOT NULL,
  iterations INT NOT NULL DEFAULT 10000,
  inputs_hash TEXT NOT NULL,  -- Must match scenario_versions.inputs_hash

  -- Job reference
  job_id UUID,  -- Reference to scenario_jobs

  -- Results summary
  overall_robustness_score FLOAT,  -- 0-1 scale
  goals_simulated INT,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message TEXT,

  -- Performance
  duration_ms INT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_sim_runs_version ON public.scenario_sim_runs(scenario_version_id);
CREATE INDEX idx_sim_runs_hash ON public.scenario_sim_runs(inputs_hash, model_version);
CREATE INDEX idx_sim_runs_status ON public.scenario_sim_runs(status);

-- ============================================================================
-- SCENARIO_GOAL_SNAPSHOTS (Per-Goal Simulation Results)
-- ============================================================================
CREATE TABLE public.scenario_goal_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sim_run_id UUID NOT NULL REFERENCES public.scenario_sim_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Goal reference (from Prisma, not FK)
  goal_id TEXT NOT NULL,  -- CUID from Prisma Goal
  goal_title TEXT NOT NULL,
  goal_category TEXT NOT NULL,
  goal_target_value FLOAT,
  goal_target_date DATE,

  -- Probability results
  probability_series JSONB NOT NULL,
  -- [{date: '2025-01-01', p10: 0.3, p50: 0.5, p90: 0.7}, ...]

  final_success_probability FLOAT NOT NULL,  -- P50 at target date
  confidence_band JSONB NOT NULL,  -- {p10, p50, p90}

  -- Status classification
  status TEXT NOT NULL CHECK (status IN ('ahead', 'on_track', 'behind', 'at_risk')),
  status_thresholds JSONB NOT NULL,  -- {ahead: 0.8, on_track: 0.6, behind: 0.4}

  -- Explainability
  top_drivers JSONB NOT NULL,
  -- [{factor, impact, direction, description}, ...]
  top_risks JSONB NOT NULL,
  -- [{risk, probability, impact, description}, ...]

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_goal_snapshots_sim_run ON public.scenario_goal_snapshots(sim_run_id);
CREATE INDEX idx_goal_snapshots_user_goal ON public.scenario_goal_snapshots(user_id, goal_id);

-- ============================================================================
-- PLANS (Generated Roadmaps from Committed Scenarios)
-- ============================================================================
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scenario_version_id UUID NOT NULL REFERENCES public.scenario_versions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Plan metadata
  name TEXT NOT NULL,
  description TEXT,

  -- Timeline
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),

  -- Progress (denormalized for fast display)
  total_phases INT NOT NULL DEFAULT 0,
  completed_phases INT NOT NULL DEFAULT 0,
  total_tasks INT NOT NULL DEFAULT 0,
  completed_tasks INT NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plans_user ON public.plans(user_id, created_at DESC);
CREATE INDEX idx_plans_scenario_version ON public.plans(scenario_version_id);

-- ============================================================================
-- PLAN_PHASES (Roadmap Phases)
-- ============================================================================
CREATE TABLE public.plan_phases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Phase metadata
  name TEXT NOT NULL,
  description TEXT,
  order_index INT NOT NULL,

  -- Timeline
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  completed_at TIMESTAMPTZ,

  -- Progress (denormalized)
  total_tasks INT NOT NULL DEFAULT 0,
  completed_tasks INT NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(plan_id, order_index)
);

CREATE INDEX idx_plan_phases_plan ON public.plan_phases(plan_id, order_index);

-- ============================================================================
-- PLAN_TASKS (Roadmap Tasks)
-- ============================================================================
CREATE TABLE public.plan_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_phase_id UUID NOT NULL REFERENCES public.plan_phases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Task metadata
  title TEXT NOT NULL,
  description TEXT,
  order_index INT NOT NULL,

  -- Goal linkage
  goal_id TEXT,  -- CUID from Prisma

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  completed_at TIMESTAMPTZ,

  -- Effort
  estimated_hours FLOAT,
  actual_hours FLOAT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(plan_phase_id, order_index)
);

CREATE INDEX idx_plan_tasks_phase ON public.plan_tasks(plan_phase_id, order_index);
CREATE INDEX idx_plan_tasks_goal ON public.plan_tasks(goal_id) WHERE goal_id IS NOT NULL;

-- ============================================================================
-- SCENARIO_REPORTS (Generated PDFs)
-- ============================================================================
CREATE TABLE public.scenario_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scenario_version_id UUID NOT NULL REFERENCES public.scenario_versions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Report metadata
  report_type TEXT NOT NULL DEFAULT 'full' CHECK (report_type IN ('full', 'summary', 'scoreboard_only')),
  title TEXT NOT NULL,

  -- Storage
  storage_bucket TEXT NOT NULL DEFAULT 'scenario-reports',
  storage_path TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,

  -- Generation metadata
  model_version TEXT NOT NULL,
  sim_run_id UUID REFERENCES public.scenario_sim_runs(id) ON DELETE SET NULL,

  -- Job reference
  job_id UUID,  -- Reference to scenario_jobs

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),

  -- Access tracking
  last_accessed_at TIMESTAMPTZ,
  access_count INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_scenario_reports_version ON public.scenario_reports(scenario_version_id, created_at DESC);
CREATE INDEX idx_scenario_reports_user ON public.scenario_reports(user_id);
CREATE INDEX idx_scenario_reports_status ON public.scenario_reports(status);

-- ============================================================================
-- SCENARIO_PINS (User's Pinned Goal Widget)
-- ============================================================================
CREATE TABLE public.scenario_pins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE,  -- One pin per user

  scenario_version_id UUID NOT NULL REFERENCES public.scenario_versions(id) ON DELETE CASCADE,
  goal_snapshot_id UUID NOT NULL REFERENCES public.scenario_goal_snapshots(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL,  -- CUID from Prisma

  -- Widget config
  widget_config JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scenario_pins_user ON public.scenario_pins(user_id);

-- ============================================================================
-- SCENARIO_AUDIT_LOG (User Actions for Compliance)
-- ============================================================================
CREATE TABLE public.scenario_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,

  -- Action metadata
  action TEXT NOT NULL,  -- 'create_scenario', 'upload_document', 'approve_field', 'run_simulation', 'commit_scenario', 'generate_report', 'delete_document'
  resource_type TEXT NOT NULL,  -- 'scenario', 'document', 'field', 'simulation', 'report'
  resource_id UUID NOT NULL,

  -- Details
  changes JSONB,
  metadata JSONB,  -- IP, user agent, etc.

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scenario_audit_log_user ON public.scenario_audit_log(user_id, created_at DESC);
CREATE INDEX idx_scenario_audit_log_resource ON public.scenario_audit_log(resource_type, resource_id);
CREATE INDEX idx_scenario_audit_log_action ON public.scenario_audit_log(action);

-- ============================================================================
-- SCENARIO_JOBS (Async Job Queue)
-- ============================================================================
CREATE TABLE public.scenario_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  scenario_id UUID REFERENCES public.scenario_labs(id) ON DELETE CASCADE,

  -- Job metadata
  job_type TEXT NOT NULL CHECK (job_type IN ('OCR', 'SIMULATE', 'PDF')),

  -- Status
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),

  -- Retry logic
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,

  -- Idempotency
  idempotency_key TEXT UNIQUE,  -- For safe retries

  -- Input/Output
  input_json JSONB NOT NULL,
  output_json JSONB,
  error_text TEXT,

  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scenario_jobs_user ON public.scenario_jobs(user_id);
CREATE INDEX idx_scenario_jobs_scenario ON public.scenario_jobs(scenario_id);
CREATE INDEX idx_scenario_jobs_status ON public.scenario_jobs(status, created_at);
CREATE INDEX idx_scenario_jobs_type ON public.scenario_jobs(job_type);
CREATE INDEX idx_scenario_jobs_idempotency ON public.scenario_jobs(idempotency_key);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-increment version numbers
CREATE OR REPLACE FUNCTION increment_scenario_version_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version_number := COALESCE(
    (SELECT MAX(version_number) FROM public.scenario_versions WHERE scenario_id = NEW.scenario_id),
    0
  ) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_version_number
  BEFORE INSERT ON public.scenario_versions
  FOR EACH ROW
  EXECUTE FUNCTION increment_scenario_version_number();

-- Update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_scenario_labs_updated_at
  BEFORE UPDATE ON public.scenario_labs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_scenario_documents_updated_at
  BEFORE UPDATE ON public.scenario_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_extracted_fields_updated_at
  BEFORE UPDATE ON public.scenario_extracted_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_plan_phases_updated_at
  BEFORE UPDATE ON public.plan_phases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_plan_tasks_updated_at
  BEFORE UPDATE ON public.plan_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_scenario_pins_updated_at
  BEFORE UPDATE ON public.scenario_pins
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_scenario_jobs_updated_at
  BEFORE UPDATE ON public.scenario_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
