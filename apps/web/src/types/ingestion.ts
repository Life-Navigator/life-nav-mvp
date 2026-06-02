/**
 * Universal Ingestion types — Sprint N.
 *
 * The ingestion pipeline is:
 *
 *   file → classify → extract → entities → relationships → facts → provenance → graph_promote
 *
 * Every step is RLS-scoped to the user. Provenance is mandatory: a
 * fact without a locator is invalid by SQL CHECK.
 */

// ---------------------------------------------------------------------------
// File kind taxonomy
// ---------------------------------------------------------------------------

export type FileKind =
  // Documents
  | 'pdf'
  | 'docx'
  | 'doc'
  | 'txt'
  | 'rtf'
  | 'md'
  // Spreadsheets
  | 'xlsx'
  | 'xls'
  | 'csv'
  // Presentations
  | 'pptx'
  | 'ppt'
  // OpenDocument
  | 'odt'
  | 'ods'
  | 'odp'
  // Structured
  | 'json'
  | 'xml'
  | 'html'
  // Images
  | 'jpg'
  | 'png'
  | 'webp'
  | 'tiff'
  | 'heic'
  // Audio
  | 'mp3'
  | 'wav'
  | 'm4a'
  | 'aac'
  | 'flac'
  // Video
  | 'mp4'
  | 'mov'
  | 'avi'
  | 'mkv'
  | 'webm'
  | 'other'
  | 'unknown';

export type FileModality =
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'structured'
  | 'image'
  | 'audio'
  | 'video'
  | 'other';

export type VirusScanStatus = 'pending' | 'clean' | 'infected' | 'skipped' | 'error';

export type JobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'partial'
  | 'failed'
  | 'deferred'
  | 'cancelled';

export type ExtractionKind =
  | 'plain_text'
  | 'rich_text'
  | 'table'
  | 'tabular'
  | 'json_tree'
  | 'xml_tree'
  | 'ocr_text'
  | 'transcript'
  | 'scene_summary'
  | 'frame_ocr'
  | 'object_list'
  | 'pdf_text'
  | 'pdf_table'
  | 'docx_blocks'
  | 'spreadsheet_sheet'
  | 'presentation_slide';

export type EntityKind =
  | 'person'
  | 'organization'
  | 'location'
  | 'address'
  | 'phone'
  | 'email'
  | 'date'
  | 'amount_usd'
  | 'account_number_masked'
  | 'bank_account'
  | 'credit_card_last4'
  | 'investment_holding'
  | 'medical_provider'
  | 'medical_condition'
  | 'medication'
  | 'lab_result'
  | 'vaccination'
  | 'icd10_code'
  | 'cpt_code'
  | 'npi'
  | 'insurance_carrier'
  | 'insurance_plan'
  | 'policy_number'
  | 'group_number'
  | 'member_id'
  | 'employer'
  | 'payroll_period'
  | 'w2_box'
  | 'paystub_line'
  | 'school'
  | 'degree'
  | 'course'
  | 'certification'
  | 'attorney'
  | 'contract_party'
  | 'clause'
  | 'receipt_merchant'
  | 'receipt_line_item'
  | 'document'
  | 'image_object'
  | 'speaker'
  | 'topic'
  | 'action_item'
  | 'other';

export type RelationshipKind =
  | 'employed_by'
  | 'employs'
  | 'spouse_of'
  | 'child_of'
  | 'parent_of'
  | 'dependent_of'
  | 'covered_by'
  | 'insured_under'
  | 'member_of'
  | 'beneficiary_of'
  | 'patient_of'
  | 'treated_with'
  | 'diagnosed_with'
  | 'prescribed'
  | 'paid_by'
  | 'paid_to'
  | 'contains_charge'
  | 'holds_account'
  | 'enrolled_in'
  | 'attended'
  | 'earned'
  | 'certified_in'
  | 'mentioned_in'
  | 'derived_from'
  | 'authored_by'
  | 'signed_by'
  | 'related_to';

// ---------------------------------------------------------------------------
// Source locator — the per-fact provenance pointer
// ---------------------------------------------------------------------------

export interface SourceLocator {
  page?: number;
  row?: number;
  col?: number;
  char_start?: number;
  char_end?: number;
  timestamp_ms?: number;
  bbox?: [number, number, number, number]; // [x, y, w, h] image coords
  slide_index?: number;
  sheet_name?: string;
  json_path?: string;
  xml_path?: string;
}

export function isLocatorPopulated(loc: SourceLocator): boolean {
  return Object.keys(loc).length > 0;
}

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

export interface FileRow {
  id: string;
  user_id: string;
  display_name: string;
  file_kind: FileKind;
  modality: FileModality;
  declared_mime?: string | null;
  detected_mime?: string | null;
  size_bytes: number;
  sha256?: string | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
  source: 'upload' | 'integration_sync' | 'provider_share' | 'migration' | 'test';
  source_reference?: string | null;
  virus_scan_status: VirusScanStatus;
  virus_scan_engine?: string | null;
  virus_scan_at?: string | null;
  archived_at?: string | null;
  current_version_id?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FileVersionRow {
  id: string;
  file_id: string;
  user_id: string;
  version_number: number;
  sha256: string;
  size_bytes: number;
  storage_bucket?: string | null;
  storage_path?: string | null;
  uploaded_by?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ExtractionJobRow {
  id: string;
  user_id: string;
  file_id: string;
  file_version_id?: string | null;
  status: JobStatus;
  pipeline_version: string;
  routed_extractors: string[];
  attempts: number;
  deferred_reason?: string | null;
  last_error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ExtractionRow {
  id: string;
  user_id: string;
  job_id: string;
  file_id: string;
  extractor_name: string;
  extractor_version: string;
  extraction_kind: ExtractionKind;
  page?: number | null;
  block_index?: number | null;
  text?: string | null;
  structured?: Record<string, unknown> | unknown[] | null;
  confidence?: number | null;
  language?: string | null;
  duration_ms?: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ExtractedEntity {
  id?: string;
  user_id?: string;
  extraction_id?: string;
  job_id?: string;
  file_id?: string;
  entity_kind: EntityKind;
  canonical_text: string;
  attributes?: Record<string, unknown>;
  confidence: number;
  graph_promoted?: boolean;
  graph_entity_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface ExtractedRelationship {
  id?: string;
  user_id?: string;
  job_id?: string;
  file_id?: string;
  subject_entity_id: string;
  object_entity_id: string;
  relationship_kind: RelationshipKind;
  attributes?: Record<string, unknown>;
  confidence: number;
  graph_promoted?: boolean;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface ExtractedFact {
  id?: string;
  user_id?: string;
  job_id?: string;
  file_id?: string;
  extraction_id?: string | null;
  subject_entity_id?: string | null;
  predicate: string;
  object_text?: string | null;
  object_value?: number | null;
  object_unit?: string | null;
  object_date?: string | null;
  object_jsonb?: Record<string, unknown> | unknown[] | null;
  language?: string | null;
  extraction_confidence: number;
  evidence_text?: string | null;
  source_locator: SourceLocator;
  ingested_at?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Classifier output
// ---------------------------------------------------------------------------

export interface ClassifiedFile {
  file_kind: FileKind;
  modality: FileModality;
  detected_mime: string;
  confidence: number;
  signals: string[]; // 'ext_match', 'magic:%PDF', etc.
}

// ---------------------------------------------------------------------------
// Pipeline outputs
// ---------------------------------------------------------------------------

export interface ExtractorOutput {
  extractor_name: string;
  extractor_version: string;
  extraction_kind: ExtractionKind;
  text?: string;
  structured?: Record<string, unknown> | unknown[];
  pages?: number;
  language?: string;
  duration_ms?: number;
  entities?: ExtractedEntity[];
  facts?: ExtractedFact[];
  relationships?: Array<
    Omit<ExtractedRelationship, 'subject_entity_id' | 'object_entity_id'> & {
      subject_index: number; // index into entities[]
      object_index: number;
    }
  >;
  confidence?: number;
  needs_remote_provider?: boolean;
  deferred_reason?: string;
}

export interface PipelineResult {
  classification: ClassifiedFile;
  extractors_run: string[];
  outputs: ExtractorOutput[];
  /** TRUE iff at least one extractor produced something AND every required
   *  provenance field exists on every emitted fact. */
  ok: boolean;
  deferred: boolean;
  errors: Array<{ extractor: string; message: string }>;
}
