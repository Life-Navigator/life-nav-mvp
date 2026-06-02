/**
 * Upload pipeline orchestrator — Sprint N.2 Phases 2 + 3 + 4.
 *
 * Single in-process orchestrator that the /api/ingest/upload route
 * delegates to. Responsibilities (in order):
 *
 *   1. classify + validate
 *   2. SCAN — mandatory malware scan via injected MalwareScanner.
 *      Persist ingestion_malware_scans row. Block on infected/error.
 *   3. STORE — upload bytes via injected StorageAdapter when configured.
 *      DB carries (storage_bucket, storage_path). Optional dev fallback
 *      to inline-only via INGESTION_STORAGE_FALLBACK=1.
 *   4. EXTRACT — runs the pipeline. Per-extractor telemetry rows are
 *      persisted to ingestion_extraction_telemetry. Per-provider cost
 *      rows go into ingestion_multimodal_cost_meter and the
 *      ops_llm_usage_meter (via recordLlmUsage).
 *   5. PROMOTE — entities / facts / extractions persisted to ingestion.*.
 *
 * The orchestrator returns a fail-explicit envelope. The HTTP layer is
 * thin and only translates this envelope into a NextResponse.
 *
 * NO direct console.log / NO raw error.message returned to clients.
 */

import { createHash } from 'node:crypto';
import { classifyFile } from './mime-classifier';
import { validateUpload } from './validators';
import { runPipeline, collectEntities, collectFacts } from './pipeline';
import { promoteEntities } from './graph-promoter';
import { recordLlmUsage } from '@/lib/ops/observability';
import { detectInjection } from '@/lib/security/injection';
import {
  persistInjectionFindings,
  persistContentVerdict,
} from '@/lib/security/injection/audit-persistence';
import { recordUserEvent } from '@/lib/analytics/events';
import { checkFile, checkDailyUploadBudget } from '@/lib/economic/quota-engine';
import { consumeRate } from '@/lib/economic';
import type { ContentOrigin } from '@/lib/security/injection/types';
import type { MalwareScanner, ScanResult } from '@/lib/malware/scanner';
import type { StorageAdapter } from '@/lib/storage/object-store';
import type { ClassifiedFile, ExtractorOutput } from '@/types/ingestion';

// ---------------------------------------------------------------------------
// Inputs / outputs
// ---------------------------------------------------------------------------

export interface UploadProcessInputs {
  user_id: string;
  filename: string;
  declared_mime?: string;
  bytes: Uint8Array;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  scanner: MalwareScanner;
  /** When undefined, no object-store upload is attempted. */
  storage?: StorageAdapter;
}

export type UploadProcessResult = UploadAccepted | UploadRejected;

export interface UploadAccepted {
  ok: true;
  status: 'accepted' | 'partial' | 'deferred';
  file_id: string;
  job_id: string;
  classification: ClassifiedFile;
  extractors_run: string[];
  entity_count: number;
  fact_count: number;
  scan: ScanResult;
  storage?: { bucket: string; path: string };
  warnings: string[];
  errors: Array<{ extractor: string; message: string }>;
}

export interface UploadRejected {
  ok: false;
  status: 'invalid' | 'infected' | 'scan_error' | 'storage_error' | 'persistence_error';
  /** Stable machine-readable code for the client. */
  reason_code: string;
  /** Human-safe message — does NOT leak internal error details. */
  client_message: string;
  scan?: ScanResult;
  warnings?: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isTextyKind(kind: string): boolean {
  return ['txt', 'rtf', 'md', 'html', 'csv', 'json', 'xml'].includes(kind);
}

/** Map ingestion file kind → security ContentOrigin label. */
function originFromKind(kind: string): ContentOrigin {
  if (['pdf'].includes(kind)) return 'pdf';
  if (['docx'].includes(kind)) return 'docx';
  if (['xlsx', 'csv'].includes(kind)) return 'xlsx';
  if (['png', 'jpg', 'jpeg', 'webp', 'tiff', 'gif'].includes(kind)) return 'image_extraction';
  if (['mp3', 'wav', 'm4a', 'flac', 'ogg'].includes(kind)) return 'audio_transcript';
  if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(kind)) return 'video_transcript';
  return 'uploaded_file';
}

function safeMessage(internalMsg: string, code: string): string {
  // Map an internal reason to a small set of stable client-safe strings.
  switch (code) {
    case 'invalid_upload':
      return 'The uploaded file is invalid or unsupported.';
    case 'infected':
      return 'The uploaded file was rejected by the security scanner.';
    case 'scan_error':
      return 'The security scanner is currently unavailable. Please try again later.';
    case 'storage_error':
      return 'Could not store the uploaded file. Please try again later.';
    case 'persistence_error':
      return 'Could not record the upload. Please try again later.';
    default:
      return 'Upload could not be processed.';
  }
}

function providerKindFromUsage(p: string): 'gemini' | 'openai' | 'anthropic' | 'local' | 'other' {
  if (p === 'gemini' || p === 'openai' || p === 'anthropic' || p === 'local') return p;
  return 'other';
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function processUpload(inputs: UploadProcessInputs): Promise<UploadProcessResult> {
  const sb = inputs.supabase;
  const size_bytes = inputs.bytes.length;

  // ---- 1. classify + validate -------------------------------------------
  const classification = classifyFile({
    filename: inputs.filename,
    declared_mime: inputs.declared_mime,
    head: inputs.bytes.slice(0, 32),
  });
  const v = validateUpload({
    filename: inputs.filename,
    declared_mime: inputs.declared_mime,
    size_bytes,
    classification,
  });
  if (!v.ok) {
    return {
      ok: false,
      status: 'invalid',
      reason_code: 'invalid_upload',
      client_message: safeMessage(v.errors.join(','), 'invalid_upload'),
      warnings: v.warnings,
    };
  }

  // ---- 1a. Economic governance — quota + rate-limit gate ----------------
  const quotaCheck = checkFile({ file_kind: classification.file_kind, size_bytes });
  if (quotaCheck.allowed === false) {
    return {
      ok: false,
      status: 'invalid',
      reason_code: quotaCheck.reason_code,
      client_message: quotaCheck.client_message,
    };
  }
  const dailyCheck = await checkDailyUploadBudget({
    supabase: sb,
    user_id: inputs.user_id,
    new_file_bytes: size_bytes,
  });
  if (dailyCheck.allowed === false) {
    return {
      ok: false,
      status: 'invalid',
      reason_code: dailyCheck.reason_code,
      client_message: dailyCheck.client_message,
    };
  }
  // Token-bucket gate.
  const rate = await consumeRate({
    supabase: sb,
    scope: 'upload',
    user_id: inputs.user_id,
  });
  if (rate.verdict !== 'ALLOW') {
    return {
      ok: false,
      status: 'invalid',
      reason_code:
        rate.verdict === 'DAILY_CAP' ? 'daily_upload_quota_exhausted' : 'upload_rate_limited',
      client_message:
        rate.verdict === 'DAILY_CAP'
          ? 'Daily upload quota reached. Please try again tomorrow.'
          : 'Too many uploads — slow down and try again shortly.',
    };
  }

  const sha256 = createHash('sha256').update(inputs.bytes).digest('hex');

  // ---- 2. SCAN — mandatory ----------------------------------------------
  const scan = await inputs.scanner.scan(inputs.bytes);

  // Persist the file row early so we can attach scan + storage to it.
  // virus_scan_status reflects the live verdict; if scanner errored, the
  // status is 'error' and extraction is blocked.
  const fileRow = await sb
    .from('ingestion_files')
    .insert({
      user_id: inputs.user_id,
      display_name: inputs.filename,
      file_kind: classification.file_kind,
      modality: classification.modality,
      declared_mime: inputs.declared_mime ?? null,
      detected_mime: classification.detected_mime,
      size_bytes,
      sha256,
      source: 'upload',
      virus_scan_status: scan.status,
    })
    .select('id')
    .single();
  if (fileRow.error) {
    return {
      ok: false,
      status: 'persistence_error',
      reason_code: 'file_row_insert_failed',
      client_message: safeMessage(fileRow.error.message, 'persistence_error'),
    };
  }
  const file_id = fileRow.data.id as string;

  // Persist the malware scan row (best-effort, append-only audit).
  await sb.from('ingestion_malware_scans').insert({
    user_id: inputs.user_id,
    file_id,
    scanner: scan.scanner,
    scanner_version: scan.scanner_version ?? null,
    status: scan.status,
    signature: scan.signature ?? null,
    details: scan.details ?? {},
    scan_started_at: new Date(Date.now() - scan.duration_ms).toISOString(),
    scan_completed_at: new Date().toISOString(),
    duration_ms: scan.duration_ms,
  });

  // Reject on infected or error. Skipped is allowed (dev only).
  if (scan.status === 'infected') {
    return {
      ok: false,
      status: 'infected',
      reason_code: 'malware_detected',
      client_message: safeMessage('infected', 'infected'),
      scan,
    };
  }
  if (scan.status === 'error') {
    return {
      ok: false,
      status: 'scan_error',
      reason_code: 'scanner_unavailable',
      client_message: safeMessage('scan_error', 'scan_error'),
      scan,
    };
  }

  // ---- 3. STORE ---------------------------------------------------------
  let storage_ref: { bucket: string; path: string } | undefined;
  const verIns = await sb
    .from('ingestion_file_versions')
    .insert({
      file_id,
      user_id: inputs.user_id,
      version_number: 1,
      sha256,
      size_bytes,
      uploaded_by: inputs.user_id,
    })
    .select('id')
    .single();
  if (verIns.error) {
    return {
      ok: false,
      status: 'persistence_error',
      reason_code: 'version_row_insert_failed',
      client_message: safeMessage(verIns.error.message, 'persistence_error'),
      scan,
    };
  }
  const version_id = verIns.data.id as string;

  if (inputs.storage) {
    try {
      const ref = await inputs.storage.uploadObject({
        user_id: inputs.user_id,
        file_id,
        version_number: 1,
        sha256,
        bytes: inputs.bytes,
        content_type: classification.detected_mime,
      });
      storage_ref = { bucket: ref.bucket, path: ref.path };
      // Persist storage path on file + version rows.
      await sb
        .from('ingestion_files')
        .update({
          storage_bucket: ref.bucket,
          storage_path: ref.path,
        })
        .eq('id', file_id);
      await sb
        .from('ingestion_file_versions')
        .update({
          storage_bucket: ref.bucket,
          storage_path: ref.path,
        })
        .eq('id', version_id);
    } catch (err) {
      if (process.env.INGESTION_STORAGE_FALLBACK !== '1') {
        return {
          ok: false,
          status: 'storage_error',
          reason_code: 'storage_upload_failed',
          client_message: safeMessage(
            err instanceof Error ? err.message : 'unknown',
            'storage_error'
          ),
          scan,
        };
      }
      // Dev fallback — log only via metadata, keep going.
    }
  }

  // ---- 4. EXTRACT -------------------------------------------------------
  const jobIns = await sb
    .from('ingestion_extraction_jobs')
    .insert({
      user_id: inputs.user_id,
      file_id,
      file_version_id: version_id,
      status: 'running',
      routed_extractors: [],
    })
    .select('id')
    .single();
  if (jobIns.error) {
    return {
      ok: false,
      status: 'persistence_error',
      reason_code: 'job_row_insert_failed',
      client_message: safeMessage(jobIns.error.message, 'persistence_error'),
      scan,
    };
  }
  const job_id = jobIns.data.id as string;

  const text = isTextyKind(classification.file_kind)
    ? new TextDecoder('utf-8', { fatal: false }).decode(inputs.bytes)
    : undefined;

  const startedAt = Date.now();
  const result = await runPipeline({
    filename: inputs.filename,
    declared_mime: inputs.declared_mime,
    size_bytes,
    bytes: inputs.bytes,
    text,
    default_locator: {
      page: classification.modality === 'document' ? 1 : undefined,
      char_start: 0,
    },
  });

  // Update job state.
  await sb
    .from('ingestion_extraction_jobs')
    .update({
      status: result.deferred ? 'deferred' : result.ok ? 'succeeded' : 'partial',
      routed_extractors: result.extractors_run,
      deferred_reason: result.deferred ? 'provider_unconfigured' : null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', job_id);

  // ---- 4a. INJECTION SCAN over every extractor text ---------------------
  // External content is data-only. We scan each extractor's text for
  // injection / malicious-prompting / exfil patterns and:
  //   * persist a content-verdict row to security_untrusted_content_findings
  //   * persist per-finding rows to security_prompt_injection_events
  //   * rewrite the extractor text to the sanitized version (so the
  //     promoted entities + facts are based on cleaned content)
  const fileOrigin = originFromKind(classification.file_kind);
  let any_critical_injection = false;
  for (const out of result.outputs) {
    if (!out.text || out.text.length === 0) continue;
    const verdict = detectInjection({ text: out.text, origin: fileOrigin, authority: 'none' });
    await persistContentVerdict(
      sb,
      verdict,
      fileOrigin,
      {
        user_id: inputs.user_id,
        file_id,
        job_id,
      },
      { extractor: out.extractor_name }
    );
    if (verdict.findings.length > 0) {
      await persistInjectionFindings(
        sb,
        verdict,
        fileOrigin,
        {
          user_id: inputs.user_id,
          file_id,
          job_id,
        },
        { extractor: out.extractor_name }
      );
    }
    if (verdict.action === 'REJECT') {
      any_critical_injection = true;
    }
    // Always replace the extractor's text with the sanitized variant so
    // any downstream promotion runs on cleaned content.
    if (verdict.modified) {
      out.text = verdict.sanitized_text;
    }
  }
  if (any_critical_injection) {
    // The file is poison. Update the job and stop before promotion.
    await sb
      .from('ingestion_extraction_jobs')
      .update({
        status: 'failed',
        deferred_reason: 'injection_critical',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job_id);
    return {
      ok: false,
      status: 'persistence_error',
      reason_code: 'injection_critical',
      client_message:
        'The uploaded file contains content that violates the security policy and was rejected.',
      scan,
    };
  }

  // Telemetry + cost meter — one row per extractor.
  for (const out of result.outputs) {
    const completedAt = new Date();
    const startedIso = new Date(startedAt).toISOString();
    const completedIso = completedAt.toISOString();
    const status: string = out.deferred_reason
      ? 'deferred'
      : (out.entities?.length ?? 0) + (out.facts?.length ?? 0) > 0
        ? 'succeeded'
        : 'partial';
    await sb.from('ingestion_extraction_telemetry').insert({
      user_id: inputs.user_id,
      job_id,
      file_id,
      extractor_name: out.extractor_name,
      extractor_version: out.extractor_version,
      status,
      started_at: startedIso,
      completed_at: completedIso,
      duration_ms: out.duration_ms ?? null,
      pages_processed: out.pages ?? null,
      entities_emitted: out.entities?.length ?? 0,
      facts_emitted: out.facts?.length ?? 0,
      error_message: out.deferred_reason ?? null,
      metadata: {},
    });
    // Cost meter — only for provider-backed extractors that report usage.
    await recordCostFromExtractor(sb, {
      user_id: inputs.user_id,
      job_id,
      file_id,
      out,
    });
  }

  // Persist extractions.
  for (const out of result.outputs) {
    await sb.from('ingestion_extractions').insert({
      user_id: inputs.user_id,
      job_id,
      file_id,
      extractor_name: out.extractor_name,
      extractor_version: out.extractor_version,
      extraction_kind: out.extraction_kind,
      text: out.text ?? null,
      structured: out.structured ?? null,
      confidence: out.confidence ?? null,
      language: out.language ?? null,
      duration_ms: out.duration_ms ?? null,
    });
  }

  // ---- 5. PROMOTE -------------------------------------------------------
  const promotion = promoteEntities({ entities: collectEntities(result) });
  for (const e of promotion.promoted_entities) {
    await sb.from('ingestion_extracted_entities').insert({
      user_id: inputs.user_id,
      extraction_id: null,
      job_id,
      file_id,
      entity_kind: e.entity_kind,
      canonical_text: e.canonical_text,
      attributes: e.attributes,
      confidence: e.confidence,
      graph_promoted: true,
      // Trust boundary: uploaded content is data only, never instruction.
      trusted_source: false,
      instruction_authority: 'none',
      content_origin: fileOrigin,
    });
  }
  for (const f of collectFacts(result)) {
    await sb.from('ingestion_extracted_facts').insert({
      user_id: inputs.user_id,
      job_id,
      file_id,
      predicate: f.predicate,
      object_text: f.object_text ?? null,
      object_value: f.object_value ?? null,
      object_unit: f.object_unit ?? null,
      object_date: f.object_date ?? null,
      object_jsonb: f.object_jsonb ?? null,
      extraction_confidence: f.extraction_confidence,
      evidence_text: f.evidence_text ?? null,
      source_locator: f.source_locator,
      // Trust boundary: uploaded content is data only, never instruction.
      trusted_source: false,
      instruction_authority: 'none',
      content_origin: fileOrigin,
    });
  }

  // Telemetry: every accepted upload counts as a document_uploaded event.
  await recordUserEvent(sb, {
    user_id: inputs.user_id,
    event_type: 'document_uploaded',
    event_metadata: {
      file_kind: classification.file_kind,
      modality: classification.modality,
      size_bytes,
    },
    subject_kind: 'file',
    subject_id: file_id,
  });

  return {
    ok: true,
    status: result.deferred ? 'deferred' : result.ok ? 'accepted' : 'partial',
    file_id,
    job_id,
    classification,
    extractors_run: result.extractors_run,
    entity_count: promotion.promoted_entities.length,
    fact_count: collectFacts(result).length,
    scan,
    storage: storage_ref,
    warnings: v.warnings,
    errors: result.errors,
  };
}

// ---------------------------------------------------------------------------
// Cost meter — peel `usage` and `provider` from structured outputs that
// real BYOM extractors (vision-prod, speech-prod, video-prod) attach.
// ---------------------------------------------------------------------------

interface UsageShape {
  cost_usd_micros?: number;
  tokens_in?: number;
  tokens_out?: number;
  latency_ms?: number;
}

interface StructuredWithUsage {
  provider?: string;
  model_id?: string;
  usage?: UsageShape;
  audio_minutes?: number;
  video_minutes?: number;
  pages?: number;
}

async function recordCostFromExtractor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  args: {
    user_id: string;
    job_id: string;
    file_id: string;
    out: ExtractorOutput;
  }
): Promise<void> {
  const s = args.out.structured as StructuredWithUsage | undefined;
  if (!s || !s.usage) return;
  const u = s.usage;
  const provider = s.provider ?? 'local';
  const model = s.model_id ?? args.out.extractor_name;
  const cost_usd_micros = Math.max(0, Math.round(u.cost_usd_micros ?? 0));
  const tokens_in = Math.max(0, Math.round(u.tokens_in ?? 0));
  const tokens_out = Math.max(0, Math.round(u.tokens_out ?? 0));

  // ingestion_multimodal_cost_meter — units depend on extractor family.
  let cost_kind = 'llm_call';
  let units = 1;
  let unit_label = 'calls';
  if (args.out.extractor_name.startsWith('vision')) {
    cost_kind = args.out.pages && args.out.pages > 0 ? 'ocr_page' : 'vision_call';
    units = args.out.pages ?? 1;
    unit_label = args.out.pages ? 'pages' : 'calls';
  } else if (args.out.extractor_name.startsWith('speech')) {
    cost_kind = 'audio_minute';
    units = s.audio_minutes ?? 1;
    unit_label = 'minutes';
  } else if (args.out.extractor_name.startsWith('video')) {
    cost_kind = 'video_minute';
    units = s.video_minutes ?? 1;
    unit_label = 'minutes';
  } else if (args.out.extractor_name.startsWith('pdf')) {
    cost_kind = 'pdf_doc';
    units = 1;
    unit_label = 'documents';
  }

  await sb.from('ingestion_multimodal_cost_meter').insert({
    user_id: args.user_id,
    job_id: args.job_id,
    file_id: args.file_id,
    extractor_name: args.out.extractor_name,
    cost_kind,
    provider,
    model,
    units,
    unit_label,
    cost_usd_micros,
    tokens_in,
    tokens_out,
    latency_ms: u.latency_ms ?? args.out.duration_ms ?? null,
  });

  // ops.llm_usage_meter — for the BYOM-resolved providers only.
  if (provider === 'gemini' || provider === 'openai' || provider === 'anthropic') {
    await recordLlmUsage(sb, {
      user_id: args.user_id,
      provider: providerKindFromUsage(provider),
      model,
      operation_kind: cost_kind,
      tokens_in,
      tokens_out,
      latency_ms: u.latency_ms,
      cost_usd_micros,
      metadata: { extractor: args.out.extractor_name, job_id: args.job_id, file_id: args.file_id },
    });
  }
}

export const __test = { processUpload, recordCostFromExtractor };
