/**
 * Scenario Lab - TypeScript Type Definitions
 *
 * All types for the Scenario Lab module
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export type ScenarioStatus = 'draft' | 'active' | 'committed' | 'archived';
export type JobType = 'OCR' | 'SIMULATE' | 'PDF';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type OcrStatus = 'pending' | 'queued' | 'processing' | 'completed' | 'failed';
export type ApprovalStatus = 'pending' | 'approved' | 'edited' | 'rejected';
export type GoalSnapshotStatus = 'ahead' | 'on_track' | 'behind' | 'at_risk';
export type PlanStatus = 'active' | 'paused' | 'completed' | 'abandoned';
export type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type SimRunStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ReportStatus = 'pending' | 'generating' | 'completed' | 'failed';
export type ReportType = 'full' | 'summary' | 'scoreboard_only';

export type DocumentType =
  | 'bank_statement'
  | 'pay_stub'
  | 'tuition_bill'
  | 'loan_statement'
  | 'insurance'
  | 'medical_bill'
  | 'lease'
  | 'other';

export type FieldType = 'number' | 'currency' | 'date' | 'text' | 'boolean';
export type InputType =
  | 'timeline'
  | 'budget'
  | 'income'
  | 'expense'
  | 'asset'
  | 'liability'
  | 'constraint';
export type SourceType = 'manual' | 'extracted';
export type ExtractionMethod = 'ocr_pattern' | 'pdf_text' | 'heuristic';

// ============================================================================
// DATABASE MODELS
// ============================================================================

export interface ScenarioLab {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  status: ScenarioStatus;
  committed_at: string | null;
  committed_version_id: string | null;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScenarioVersion {
  id: string;
  scenario_id: string;
  user_id: string;
  version_number: number;
  version_label: string | null;
  is_committed: boolean;
  inputs_hash: string;
  created_at: string;
}

export interface ScenarioDocument {
  id: string;
  scenario_id: string;
  user_id: string;
  filename: string;
  file_type: string;
  file_size_bytes: number;
  mime_type: string;
  storage_bucket: string;
  storage_path: string;
  content_hash: string;
  document_type: DocumentType | null;
  ocr_status: OcrStatus;
  ocr_job_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScenarioExtractedField {
  id: string;
  document_id: string;
  user_id: string;
  field_key: string;
  field_value: string;
  field_type: FieldType;
  confidence_score: number;
  extraction_method: ExtractionMethod;
  source_page: number | null;
  source_bbox: BoundingBox | null;
  source_text: string | null;
  was_redacted: boolean;
  redaction_reason: string | null;
  approval_status: ApprovalStatus;
  approved_at: string | null;
  edited_value: string | null;
  rejected_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScenarioInput {
  id: string;
  scenario_version_id: string;
  user_id: string;
  source_type: SourceType;
  source_field_id: string | null;
  input_key: string;
  input_value: any; // JSONB
  input_type: InputType;
  unit: string | null;
  confidence: number | null;
  created_at: string;
  field_name?: string;
  goal_id?: string;
  field_value?: string | number;
}

export interface ScenarioSimRun {
  id: string;
  scenario_version_id: string;
  user_id: string;
  model_version: string;
  seed: number;
  iterations: number;
  inputs_hash: string;
  job_id: string | null;
  overall_robustness_score: number | null;
  goals_simulated: number | null;
  status: SimRunStatus;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface ScenarioGoalSnapshot {
  id: string;
  sim_run_id: string;
  user_id: string;
  goal_id: string;
  goal_title: string;
  goal_category: string;
  goal_target_value: number | null;
  goal_target_date: string | null;
  probability_series: ProbabilityPoint[];
  final_success_probability: number;
  confidence_band: ConfidenceBand;
  status: GoalSnapshotStatus;
  status_thresholds: StatusThresholds;
  top_drivers: Driver[];
  top_risks: Risk[];
  created_at: string;
}

export interface ProbabilityPoint {
  date: string; // ISO date
  p10: number;
  p50: number;
  p90: number;
}

export interface ConfidenceBand {
  p10: number;
  p50: number;
  p90: number;
}

export interface StatusThresholds {
  ahead: number;
  on_track: number;
  behind: number;
}

export interface Driver {
  factor: string;
  impact: number;
  direction: 'positive' | 'negative';
  description: string;
}

export interface Risk {
  risk: string;
  probability: number;
  impact: 'low' | 'medium' | 'high';
  description: string;
}

export interface Plan {
  id: string;
  scenario_version_id: string;
  user_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: PlanStatus;
  total_phases: number;
  completed_phases: number;
  total_tasks: number;
  completed_tasks: number;
  created_at: string;
  updated_at: string;
}

export interface PlanPhase {
  id: string;
  plan_id: string;
  user_id: string;
  name: string;
  description: string | null;
  order_index: number;
  start_date: string;
  end_date: string;
  status: PhaseStatus;
  completed_at: string | null;
  total_tasks: number;
  completed_tasks: number;
  created_at: string;
  updated_at: string;
}

export interface PlanTask {
  id: string;
  plan_phase_id: string;
  user_id: string;
  title: string;
  description: string | null;
  order_index: number;
  goal_id: string | null;
  status: TaskStatus;
  completed_at: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  created_at: string;
  updated_at: string;
}

export interface ScenarioReport {
  id: string;
  scenario_version_id: string;
  user_id: string;
  report_type: ReportType;
  title: string;
  storage_bucket: string;
  storage_path: string;
  file_size_bytes: number;
  model_version: string;
  sim_run_id: string | null;
  job_id: string | null;
  status: ReportStatus;
  last_accessed_at: string | null;
  access_count: number;
  created_at: string;
  completed_at: string | null;
}

export interface ScenarioPin {
  id: string;
  user_id: string;
  scenario_version_id: string;
  goal_snapshot_id: string;
  goal_id: string;
  widget_config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ScenarioAuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  changes: any;
  metadata: any;
  created_at: string;
}

export interface ScenarioJob {
  id: string;
  user_id: string;
  scenario_id: string | null;
  job_type: JobType;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  idempotency_key: string | null;
  input_json: any;
  output_json: any | null;
  error_text: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

// Scenarios
export interface CreateScenarioRequest {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface UpdateScenarioRequest {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  status?: ScenarioStatus;
}

export interface ListScenariosResponse {
  scenarios: ScenarioLab[];
  total: number;
}

// Versions
export interface CreateVersionRequest {
  version_label?: string;
  inputs: ScenarioInputData[];
}

export interface ScenarioInputData {
  input_key: string;
  input_value: any;
  input_type: InputType;
  unit?: string;
}

export interface ForkScenarioRequest {
  new_name: string;
  version_id?: string;
}

// Documents
export interface UploadDocumentRequest {
  scenario_id: string;
  filename: string;
  mime_type: string;
  file_size_bytes: number;
  document_type?: DocumentType;
}

export interface UploadDocumentResponse {
  document: ScenarioDocument;
  upload_url: string; // Signed URL for upload
}

// OCR
export interface EnqueueOcrRequest {
  document_id: string;
}

export interface OcrJobResponse {
  job_id: string;
  status: JobStatus;
}

// Extracted Fields
export interface ApproveFieldRequest {
  field_id: string;
  approved: boolean;
  edited_value?: string;
  rejected_reason?: string;
}

export interface ApproveFieldsResponse {
  approved_count: number;
  inputs_created: number;
}

// Simulation
export interface EnqueueSimulationRequest {
  scenario_version_id: string;
  goal_ids?: string[];
}

export interface SimulationJobResponse {
  job_id: string;
  sim_run_id: string;
  status: JobStatus;
}

export interface SimulationResultsResponse {
  sim_run: ScenarioSimRun;
  goal_snapshots: ScenarioGoalSnapshot[];
}

// Commit
export interface CommitScenarioRequest {
  scenario_version_id: string;
  plan_name?: string;
  plan_description?: string;
}

export interface CommitScenarioResponse {
  scenario: ScenarioLab;
  plan: Plan;
  phases: PlanPhase[];
  tasks: PlanTask[];
}

// Reports
export interface EnqueueReportRequest {
  scenario_version_id: string;
  report_type?: ReportType;
  title?: string;
}

export interface ReportJobResponse {
  job_id: string;
  report_id: string;
  status: JobStatus;
}

export interface ListReportsResponse {
  reports: ScenarioReport[];
}

export interface GetReportDownloadResponse {
  download_url: string; // Signed URL
}

// Pins
export interface CreatePinRequest {
  scenario_version_id: string;
  goal_snapshot_id: string;
  goal_id: string;
  widget_config?: Record<string, any>;
}

export interface GetPinResponse {
  pin: ScenarioPin | null;
  goal_snapshot?: ScenarioGoalSnapshot;
}

// Jobs
export interface GetJobStatusResponse {
  job: ScenarioJob;
}

// ============================================================================
// SIMULATOR TYPES
// ============================================================================

export interface SimulatorConfig {
  model_version?: string;
  iterations: number;
  seed: number;
  include_shock_events?: boolean;
}

export interface SimulatorInputs {
  timeline: {
    start_date: string;
    end_date: string;
  };
  budget: {
    total: number;
    monthly: number;
    currency: string;
  };
  income: {
    monthly_gross: number;
    monthly_net: number;
  } | null;
  expenses: {
    monthly_total: number;
    breakdown: Record<string, number>;
  } | null;
  assets: {
    emergency_fund: number;
    total: number;
  } | null;
  liabilities: {
    total: number;
  } | null;
  constraints: string[];
  time_budget_hours_per_week: number;
}

export interface GoalInput {
  id: string;
  title: string;
  category: string;
  target_value: number | null;
  current_value: number | null;
  target_date: string;
  priority: 'essential' | 'important' | 'nice_to_have';
}

export interface SimulationOutput {
  goal_id: string;
  probability_series?: ProbabilityPoint[];
  final_success_probability?: number;
  confidence_band?: ConfidenceBand;
  completion_time_distribution?: {
    p10_days: number;
    p50_days: number;
    p90_days: number;
  };
  drivers?: Driver[];
  risks?: Risk[];
  status: GoalSnapshotStatus;
  probability?: number;
  p10?: number;
  p50?: number;
  p90?: number;
  top_drivers?: any[];
  top_risks?: any[];
}

export interface SimulatorResult {
  goals: SimulationOutput[];
  overall_robustness_score?: number;
  version_id?: string;
  iterations?: number;
  seed?: number;
  model_version?: string;
  duration_ms?: number;
  metadata?: {
    model_version: string;
    iterations: number;
    seed: number;
    duration_ms: number;
  };
}

// ============================================================================
// RATE LIMITING TYPES
// ============================================================================

export interface RateLimitCheck {
  limit_key: string;
  limit_type: 'upload' | 'simulation' | 'pdf';
  allowed: boolean;
  current_count: number;
  limit: number;
  reset_at: string;
}

// ============================================================================
// TIMELINE PLAYBACK TYPES
// ============================================================================

export type PlaybackSpeed = 'slow' | 'normal' | 'fast' | 'instant';
export type TimeStep = 'month' | 'quarter' | 'year';
export type PlaybackState = 'idle' | 'playing' | 'paused' | 'completed';
export type PathType = 'best' | 'likely' | 'worst';
export type LifeEventType =
  | 'marriage'
  | 'child_birth'
  | 'home_purchase'
  | 'education'
  | 'career_change'
  | 'health'
  | 'retirement'
  | 'other';
export type EventSeverity = 'positive' | 'neutral' | 'negative';

export interface TimelinePlaybackConfig {
  startDate: Date;
  endDate: Date;
  playbackSpeed: PlaybackSpeed;
  pauseOnEvents: boolean;
  stepSize: TimeStep;
  showMultiplePaths: boolean;
  enableNotifications: boolean;
  autoAdvance: boolean;
}

export interface TimelineState {
  currentDate: Date;
  progress: number; // 0-100
  playbackState: PlaybackState;
  elapsedMonths: number;
  totalMonths: number;
}

export interface TimePoint {
  date: Date;
  age: number;
  netWorth: number;
  income: number;
  expenses: number;
  investments: number;
  debts: number;
  goalProgress: Record<string, number>; // goal_id -> progress (0-100)
}

export interface PathData {
  type: PathType;
  color: string;
  timePoints: TimePoint[];
  successProbability: number;
}

export interface LifeEvent {
  id: string;
  date: Date;
  type: LifeEventType;
  title: string;
  description: string;
  severity: EventSeverity;
  icon: string;
  impactSummary?: {
    netWorthChange?: number;
    incomeChange?: number;
    expenseChange?: number;
  };
}

export interface Milestone {
  id: string;
  date: Date;
  title: string;
  description: string;
  type: 'financial' | 'career' | 'education' | 'health' | 'personal';
  goalId?: string;
  achieved: boolean;
  celebration?: {
    icon: string;
    message: string;
    points: number;
  };
}

export interface TimelineNotification {
  id: string;
  timestamp: Date;
  type: 'event' | 'milestone' | 'warning' | 'achievement';
  severity: EventSeverity;
  title: string;
  message: string;
  icon: string;
  autoClose?: boolean;
  duration?: number; // ms
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface DecisionPoint {
  id: string;
  date: Date;
  title: string;
  description: string;
  options: DecisionOption[];
  defaultOption?: string;
  timeoutSeconds?: number;
}

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  impacts: {
    netWorth?: number;
    income?: number;
    risk?: number;
    goalProgress?: Record<string, number>;
  };
  consequences: string[];
}

export interface TimelineSimulationResult {
  paths: PathData[];
  events: LifeEvent[];
  milestones: Milestone[];
  decisionPoints?: DecisionPoint[];
  finalOutcome: {
    bestCase: TimePoint;
    likelyCase: TimePoint;
    worstCase: TimePoint;
  };
}
