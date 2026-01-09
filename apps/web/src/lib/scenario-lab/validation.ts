/**
 * Scenario Lab - Zod Validation Schemas
 *
 * All input validation schemas for the Scenario Lab module
 */

import { z } from 'zod';

// ============================================================================
// SCENARIO VALIDATION
// ============================================================================

export const createScenarioSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color').optional(),
});

export const updateScenarioSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  status: z.enum(['draft', 'active', 'committed', 'archived']).optional(),
});

export const forkScenarioSchema = z.object({
  new_name: z.string().min(1).max(100),
  version_id: z.string().uuid().optional(),
});

// ============================================================================
// VERSION VALIDATION
// ============================================================================

export const scenarioInputDataSchema = z.object({
  input_key: z.string().min(1),
  input_value: z.any(),
  input_type: z.enum(['timeline', 'budget', 'income', 'expense', 'asset', 'liability', 'constraint']),
  unit: z.string().optional(),
});

export const createVersionSchema = z.object({
  name: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
});

// ============================================================================
// DOCUMENT VALIDATION
// ============================================================================

export const uploadDocumentSchema = z.object({
  filename: z.string().min(1).max(255),
  mime_type: z.enum(['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp']),
  file_size_bytes: z.number().int().min(1).max(10485760), // 10MB max
  document_type: z.enum([
    'bank_statement',
    'pay_stub',
    'tuition_bill',
    'loan_statement',
    'insurance',
    'medical_bill',
    'lease',
    'other',
  ]).optional(),
});

export const enqueueOcrSchema = z.object({
  document_id: z.string().uuid(),
});

// ============================================================================
// EXTRACTED FIELDS VALIDATION
// ============================================================================

export const createInputSchema = z.object({
  goal_id: z.string(),
  field_name: z.string().min(1).max(100),
  field_value: z.string().min(1),
  field_type: z.enum(['number', 'currency', 'date', 'text', 'boolean']).optional(),
  source: z.enum(['manual', 'extracted']).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const approveFieldSchema = z.object({
  extracted_field_id: z.string().uuid(),
  goal_id: z.string(),
  field_name: z.string(),
  approved_value: z.string().optional(), // If edited
});

export const approveFieldsSchema = z.object({
  fields: z.array(approveFieldSchema).min(1),
});

// ============================================================================
// SIMULATION VALIDATION
// ============================================================================

export const enqueueSimulationSchema = z.object({
  scenario_version_id: z.string().uuid(),
  goal_ids: z.array(z.string()).optional(),
});

// ============================================================================
// COMMIT VALIDATION
// ============================================================================

export const commitScenarioSchema = z.object({
  scenario_version_id: z.string().uuid(),
  plan_name: z.string().min(1).max(100).optional(),
  plan_description: z.string().max(500).optional(),
});

// ============================================================================
// REPORT VALIDATION
// ============================================================================

export const enqueueReportSchema = z.object({
  scenario_version_id: z.string().uuid(),
  report_type: z.enum(['full', 'summary', 'scoreboard_only']).default('full'),
  title: z.string().min(1).max(100).optional(),
});

// ============================================================================
// PIN VALIDATION
// ============================================================================

export const createPinSchema = z.object({
  scenario_version_id: z.string().uuid(),
  goal_snapshot_id: z.string().uuid(),
  goal_id: z.string().min(1),
  widget_config: z.record(z.any()).optional(),
});

// ============================================================================
// PLAN/PHASE/TASK VALIDATION
// ============================================================================

export const updatePlanSchema = z.object({
  status: z.enum(['active', 'paused', 'completed', 'abandoned']).optional(),
  description: z.string().max(500).optional(),
});

export const updatePhaseSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).optional(),
  description: z.string().max(500).optional(),
});

export const updateTaskSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'skipped']).optional(),
  description: z.string().max(500).optional(),
  actual_hours: z.number().min(0).optional(),
});

// ============================================================================
// FILE VALIDATION HELPERS
// ============================================================================

export function validateFileType(filename: string, allowedMimeTypes: string[]): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();

  const extensionMap: Record<string, string> = {
    'pdf': 'application/pdf',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
  };

  const mimeType = ext ? extensionMap[ext] : null;
  return mimeType ? allowedMimeTypes.includes(mimeType) : false;
}

export function validateFileSize(sizeBytes: number, maxSizeBytes: number = 10485760): boolean {
  return sizeBytes > 0 && sizeBytes <= maxSizeBytes;
}

// ============================================================================
// SENSITIVE DATA DETECTION
// ============================================================================

// Patterns for detecting sensitive data that should be redacted
export const SENSITIVE_PATTERNS = {
  SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
  SSN_NO_DASH: /\b\d{9}\b/g,
  CREDIT_CARD: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  ACCOUNT_NUMBER: /\b\d{8,17}\b/g,  // Common bank account number lengths
};

export function detectSensitiveData(text: string): {
  hasSensitiveData: boolean;
  redacted: string;
  redactions: Array<{ type: string; count: number }>;
} {
  let redacted = text;
  const redactions: Array<{ type: string; count: number }> = [];

  // Redact SSN
  const ssnMatches = text.match(SENSITIVE_PATTERNS.SSN);
  if (ssnMatches) {
    redacted = redacted.replace(SENSITIVE_PATTERNS.SSN, 'XXX-XX-XXXX');
    redactions.push({ type: 'SSN', count: ssnMatches.length });
  }

  // Redact SSN without dashes
  const ssnNoDashMatches = text.match(SENSITIVE_PATTERNS.SSN_NO_DASH);
  if (ssnNoDashMatches) {
    // Only redact if not already caught by SSN pattern
    const newMatches = ssnNoDashMatches.filter(m => !ssnMatches?.includes(m));
    if (newMatches.length > 0) {
      redacted = redacted.replace(SENSITIVE_PATTERNS.SSN_NO_DASH, 'XXXXXXXXX');
      redactions.push({ type: 'SSN_NO_DASH', count: newMatches.length });
    }
  }

  // Redact credit cards
  const ccMatches = text.match(SENSITIVE_PATTERNS.CREDIT_CARD);
  if (ccMatches) {
    redacted = redacted.replace(SENSITIVE_PATTERNS.CREDIT_CARD, 'XXXX-XXXX-XXXX-XXXX');
    redactions.push({ type: 'CREDIT_CARD', count: ccMatches.length });
  }

  return {
    hasSensitiveData: redactions.length > 0,
    redacted,
    redactions,
  };
}
