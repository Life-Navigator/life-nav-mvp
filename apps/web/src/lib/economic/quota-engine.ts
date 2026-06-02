/**
 * QuotaEngine — Sprint O.0.2 Phase 7.
 *
 * Enforces multimodal per-file size caps + per-user daily upload
 * volume. Runs INSIDE `processUpload` before storage / extraction.
 *
 * Limits derive from `BETA_FILE_LIMITS` so a sprint that lifts the
 * caps is a single-file change.
 */

import type { CostDimension } from './types';

/** File-size caps per modality (bytes). */
export const BETA_FILE_LIMITS = Object.freeze({
  pdf: { max_bytes: 50 * 1024 * 1024, max_pages: 250 },
  docx: { max_bytes: 25 * 1024 * 1024 },
  xlsx: { max_bytes: 25 * 1024 * 1024 },
  audio: { max_bytes: 100 * 1024 * 1024, max_seconds: 15 * 60 },
  video: { max_bytes: 250 * 1024 * 1024, max_seconds: 5 * 60 },
  image: { max_bytes: 25 * 1024 * 1024 },
  txt: { max_bytes: 10 * 1024 * 1024 },
});

/** Daily per-user upload volume cap (bytes). */
export const BETA_DAILY_UPLOAD_BUDGET_BYTES = 500 * 1024 * 1024;

export type QuotaVerdict =
  | { allowed: true }
  | { allowed: false; reason_code: string; client_message: string };

export interface CheckFileInputs {
  file_kind: string; // 'pdf' | 'docx' | 'xlsx' | ...
  size_bytes: number;
  pages?: number;
  duration_seconds?: number;
}

/**
 * Per-file gate. Returns allowed:false with a reason_code that the
 * upload route can map onto a user-safe 4xx response.
 */
export function checkFile(inputs: CheckFileInputs): QuotaVerdict {
  const limits = limitsForKind(inputs.file_kind);
  if (!limits) return { allowed: true };

  if (inputs.size_bytes > limits.max_bytes) {
    return {
      allowed: false,
      reason_code: 'file_too_large',
      client_message: `Files of this kind are capped at ${humanBytes(limits.max_bytes)}.`,
    };
  }
  const max_pages = 'max_pages' in limits ? (limits.max_pages as number | undefined) : undefined;
  if (max_pages && inputs.pages && inputs.pages > max_pages) {
    return {
      allowed: false,
      reason_code: 'too_many_pages',
      client_message: `PDFs are capped at ${max_pages} pages.`,
    };
  }
  const max_seconds =
    'max_seconds' in limits ? (limits.max_seconds as number | undefined) : undefined;
  if (max_seconds && inputs.duration_seconds && inputs.duration_seconds > max_seconds) {
    return {
      allowed: false,
      reason_code: 'duration_too_long',
      client_message: `Media is capped at ${Math.floor(max_seconds / 60)} minutes.`,
    };
  }
  return { allowed: true };
}

export interface CheckDailyInputs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  user_id: string;
  /** Size of the NEW file we're trying to add (bytes). */
  new_file_bytes: number;
  /** Optional override of the daily cap (bytes). */
  daily_cap_bytes?: number;
}

/**
 * Per-day cumulative gate. Sums `ingestion.files.size_bytes` for the
 * user over the last 24h and refuses the new file when adding it
 * would exceed the cap.
 */
export async function checkDailyUploadBudget(inputs: CheckDailyInputs): Promise<QuotaVerdict> {
  const sb = inputs.supabase;
  const cap = inputs.daily_cap_bytes ?? BETA_DAILY_UPLOAD_BUDGET_BYTES;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let already = 0;
  try {
    const r = await sb
      .from('ingestion_files')
      .select('size_bytes')
      .eq('user_id', inputs.user_id)
      .gte('created_at', since);
    if (Array.isArray(r.data)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      already = (r.data as Array<{ size_bytes: number }>).reduce(
        (s, x) => s + (x.size_bytes ?? 0),
        0
      );
    }
  } catch {
    /* fail-open on read; rely on per-file gate */
    return { allowed: true };
  }
  if (already + inputs.new_file_bytes > cap) {
    return {
      allowed: false,
      reason_code: 'daily_upload_budget_exceeded',
      client_message: `Daily upload budget exceeded (${humanBytes(cap)}/day).`,
    };
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function limitsForKind(file_kind: string) {
  if (file_kind === 'pdf') return BETA_FILE_LIMITS.pdf;
  if (file_kind === 'docx') return BETA_FILE_LIMITS.docx;
  if (file_kind === 'xlsx' || file_kind === 'csv') return BETA_FILE_LIMITS.xlsx;
  if (['mp3', 'wav', 'm4a', 'flac', 'ogg'].includes(file_kind)) return BETA_FILE_LIMITS.audio;
  if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(file_kind)) return BETA_FILE_LIMITS.video;
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'tiff'].includes(file_kind))
    return BETA_FILE_LIMITS.image;
  if (['txt', 'rtf', 'md', 'html', 'json', 'xml'].includes(file_kind)) return BETA_FILE_LIMITS.txt;
  return null;
}

function humanBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(0)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} bytes`;
}

/** Estimate the cost dimension a file will charge against (for the
 *  CostEstimator). Used by integration code to feed estimates BEFORE
 *  the file's real extractor runs. */
export function costDimensionForKind(file_kind: string): CostDimension {
  if (['mp3', 'wav', 'm4a', 'flac', 'ogg'].includes(file_kind)) return 'speech_minute';
  if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(file_kind)) return 'video_minute';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'tiff'].includes(file_kind)) return 'vision_image';
  if (file_kind === 'pdf' || file_kind === 'docx') return 'vision_image'; // OCR fallback
  return 'other';
}

export const __test = { limitsForKind, humanBytes };
