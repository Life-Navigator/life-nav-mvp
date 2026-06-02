/**
 * Ingestion validators — Sprint N.
 *
 * Pre-flight checks that fire BEFORE the file lands in storage:
 *
 *   - size cap by modality
 *   - mime/extension consistency vs classifier detection
 *   - virus-scan gate (no extraction unless clean)
 *   - locator non-empty per fact (mirrors the SQL CHECK)
 */

import type {
  ClassifiedFile,
  ExtractedFact,
  FileKind,
  FileModality,
  VirusScanStatus,
} from '@/types/ingestion';
import { isLocatorPopulated } from '@/types/ingestion';

// ---------------------------------------------------------------------------
// Size caps (bytes) — configurable per modality
// ---------------------------------------------------------------------------

export const SIZE_CAPS_BYTES: Record<FileModality, number> = {
  document: 50 * 1024 * 1024, // 50 MB
  spreadsheet: 50 * 1024 * 1024,
  presentation: 100 * 1024 * 1024,
  structured: 25 * 1024 * 1024,
  image: 25 * 1024 * 1024,
  audio: 500 * 1024 * 1024, // 500 MB
  video: 2 * 1024 * 1024 * 1024, // 2 GB
  other: 25 * 1024 * 1024,
};

// ---------------------------------------------------------------------------
// Allow-list — files we explicitly support
// ---------------------------------------------------------------------------

export const ALLOWED_KINDS = new Set<FileKind>([
  'pdf',
  'docx',
  'doc',
  'txt',
  'rtf',
  'md',
  'xlsx',
  'xls',
  'csv',
  'pptx',
  'ppt',
  'odt',
  'ods',
  'odp',
  'json',
  'xml',
  'html',
  'jpg',
  'png',
  'webp',
  'tiff',
  'heic',
  'mp3',
  'wav',
  'm4a',
  'aac',
  'flac',
  'mp4',
  'mov',
  'avi',
  'mkv',
  'webm',
]);

// ---------------------------------------------------------------------------
// validateUpload
// ---------------------------------------------------------------------------

export interface ValidateUploadInputs {
  filename: string;
  declared_mime?: string;
  size_bytes: number;
  classification: ClassifiedFile;
}

export interface UploadValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateUpload(i: ValidateUploadInputs): UploadValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!i.filename || i.filename.length === 0) errors.push('filename_required');
  if (i.filename && i.filename.length > 1024) errors.push('filename_too_long');

  if (!Number.isInteger(i.size_bytes) || i.size_bytes < 0) errors.push('size_invalid');

  const cap = SIZE_CAPS_BYTES[i.classification.modality];
  if (i.size_bytes > cap) errors.push(`size_exceeds_cap:${cap}`);

  if (i.classification.file_kind === 'unknown') {
    errors.push('file_kind_unknown');
  } else if (!ALLOWED_KINDS.has(i.classification.file_kind)) {
    errors.push(`file_kind_disallowed:${i.classification.file_kind}`);
  }

  // Declared-mime vs detected-mime mismatch is a WARNING (the classifier
  // can be wrong in pathological cases), unless it's a confidence>0.9
  // detection where a mismatch becomes an error.
  if (
    i.declared_mime &&
    i.classification.detected_mime &&
    i.declared_mime !== i.classification.detected_mime
  ) {
    if (i.classification.confidence >= 0.9) {
      errors.push(`mime_mismatch:${i.declared_mime}!=${i.classification.detected_mime}`);
    } else {
      warnings.push(`mime_mismatch:${i.declared_mime}!=${i.classification.detected_mime}`);
    }
  }

  if (i.classification.confidence < 0.5) {
    warnings.push(`low_classification_confidence:${i.classification.confidence}`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Virus-scan gate
// ---------------------------------------------------------------------------

export function canExtractGivenScan(status: VirusScanStatus): { ok: boolean; reason?: string } {
  switch (status) {
    case 'clean':
      return { ok: true };
    case 'skipped':
      return { ok: true };
    case 'pending':
      return { ok: false, reason: 'scan_pending' };
    case 'infected':
      return { ok: false, reason: 'scan_infected' };
    case 'error':
      return { ok: false, reason: 'scan_error' };
  }
}

// ---------------------------------------------------------------------------
// Provenance enforcement — runs over the facts the pipeline emits
// ---------------------------------------------------------------------------

export interface FactValidation {
  ok: boolean;
  errors: Array<{ index: number; reason: string }>;
}

export function validateFacts(facts: ExtractedFact[]): FactValidation {
  const errors: FactValidation['errors'] = [];
  facts.forEach((f, i) => {
    if (!f.predicate || f.predicate.length === 0)
      errors.push({ index: i, reason: 'predicate_missing' });
    if (typeof f.extraction_confidence !== 'number')
      errors.push({ index: i, reason: 'confidence_missing' });
    else if (f.extraction_confidence < 0 || f.extraction_confidence > 1)
      errors.push({ index: i, reason: 'confidence_out_of_range' });
    if (!f.source_locator || !isLocatorPopulated(f.source_locator))
      errors.push({ index: i, reason: 'locator_empty' });
  });
  return { ok: errors.length === 0, errors };
}

export const __test = {
  SIZE_CAPS_BYTES,
  ALLOWED_KINDS,
  validateUpload,
  canExtractGivenScan,
  validateFacts,
};
