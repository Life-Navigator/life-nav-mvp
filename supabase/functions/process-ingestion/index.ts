import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';
import mammoth from 'https://esm.sh/mammoth@1.8.0';

type IngestionJob = {
  id: string;
  document_id: string;
  user_id: string;
  attempts: number;
  parser_version: string;
};

type UploadDocument = {
  id: string;
  user_id: string;
  domain: 'financial' | 'health' | 'career' | 'education' | 'other';
  bucket_id: string;
  storage_path: string;
  checksum_sha256?: string | null;
  original_filename: string;
  detected_file_type: string;
  mime_type: string;
  file_size_bytes: number;
};

type IngestionResult = {
  parser: string;
  detected_type: string;
  [key: string]: unknown;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-worker-secret',
};

const FILE_SIZE_LIMITS: Record<string, number> = {
  CSV: 10 * 1024 * 1024,
  XLSX: 10 * 1024 * 1024,
  DOCX: 10 * 1024 * 1024,
  PDF: 10 * 1024 * 1024,
  PNG: 10 * 1024 * 1024,
  JPEG: 10 * 1024 * 1024,
  JPG: 10 * 1024 * 1024,
};

const XLSX_MAX_SHEETS = 5;
const XLSX_MAX_ROWS_TOTAL = 25_000;
const CSV_MAX_ROWS = 100_000;
const DOCX_MAX_TEXT_BYTES = 2 * 1024 * 1024;
const JOB_TIME_BUDGET_MS = 20_000;
const MAX_CLAIM_LIMIT = 25;

function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;

  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function safeError(value: unknown): string {
  const raw = value instanceof Error ? value.message : String(value);
  return raw.length > 2000 ? raw.slice(0, 2000) : raw;
}

function checkTimeBudget(startedAtMs: number, step: string) {
  const elapsed = Date.now() - startedAtMs;
  if (elapsed > JOB_TIME_BUDGET_MS) {
    throw new Error(`Job exceeded time budget at step: ${step}`);
  }
}

function ensureFileSizeWithinLimit(doc: UploadDocument, bytesLength: number) {
  const fileType = doc.detected_file_type.toUpperCase();
  const limit = FILE_SIZE_LIMITS[fileType] ?? 10 * 1024 * 1024;

  const effectiveSize = Math.max(bytesLength, doc.file_size_bytes || 0);
  if (effectiveSize > limit) {
    throw new Error(`${fileType} exceeds maximum allowed size of ${Math.round(limit / (1024 * 1024))}MB`);
  }
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) return [];
  if (lines.length - 1 > CSV_MAX_ROWS) {
    throw new Error(`CSV row limit exceeded (${CSV_MAX_ROWS})`);
  }

  const headers = lines[0].split(',').map((h) => normalizeHeader(h));
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const columns = lines[i].split(',');
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header || `col_${idx + 1}`] = (columns[idx] || '').trim();
    });
    rows.push(row);
  }

  return rows;
}

function toIsoDate(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function parseAmount(value: string | number | undefined): number | null {
  if (value === undefined || value === null) return null;
  const normalized = String(value).replace(/[$,\s]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapFinancialRow(row: Record<string, string>) {
  return {
    transaction_date: toIsoDate(row.date || row.transaction_date || row.posted_date),
    description: row.description || row.memo || row.details || null,
    merchant: row.merchant || row.payee || null,
    amount: parseAmount(row.amount || row.debit || row.credit),
    category: row.category || row.type || null,
    raw_row: row,
  };
}

function buildRowHash(jobId: string, row: Record<string, unknown>): string {
  const payload = `${jobId}|${JSON.stringify(row)}`;
  return new TextEncoder().encode(payload).reduce((acc, b) => {
    acc = (acc * 33 + b) >>> 0;
    return acc;
  }, 5381).toString(16);
}

async function parseXlsx(fileBytes: Uint8Array): Promise<Array<Record<string, string>>> {
  const workbook = XLSX.read(fileBytes, { type: 'array' });

  if (workbook.SheetNames.length > XLSX_MAX_SHEETS) {
    throw new Error(`XLSX sheet limit exceeded (${XLSX_MAX_SHEETS})`);
  }

  const rows: Array<Record<string, string>> = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    });

    for (const row of jsonRows) {
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        normalized[normalizeHeader(key)] = String(value ?? '').trim();
      }
      rows.push(normalized);

      if (rows.length > XLSX_MAX_ROWS_TOTAL) {
        throw new Error(`XLSX row limit exceeded (${XLSX_MAX_ROWS_TOTAL})`);
      }
    }
  }

  return rows;
}

async function parseDocx(fileBytes: Uint8Array): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer: fileBytes.buffer.slice(0) });
  const text = result.value?.trim() || '';
  const byteLength = new TextEncoder().encode(text).length;
  if (byteLength > DOCX_MAX_TEXT_BYTES) {
    throw new Error('DOCX extracted text exceeds 2MB limit');
  }
  return text;
}

async function processFinancialDocument(
  supabase: ReturnType<typeof createClient>,
  job: IngestionJob,
  doc: UploadDocument,
  fileBytes: Uint8Array,
  startedAtMs: number,
): Promise<IngestionResult> {
  checkTimeBudget(startedAtMs, 'financial:start');

  let rows: Array<Record<string, string>> = [];
  const type = doc.detected_file_type.toUpperCase();

  if (type === 'CSV') {
    rows = parseCsv(new TextDecoder('utf-8', { fatal: false }).decode(fileBytes));
  } else if (type === 'XLSX') {
    rows = await parseXlsx(fileBytes);
  } else if (type === 'DOCX') {
    const text = await parseDocx(fileBytes);
    rows = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => ({ description: line }));
  }

  checkTimeBudget(startedAtMs, 'financial:parsed');

  const mapped = rows.map(mapFinancialRow).filter((row) => row.description || row.amount !== null);

  if (mapped.length > 0) {
    const payload = mapped.map((tx) => ({
      user_id: doc.user_id,
      document_id: doc.id,
      ingestion_job_id: job.id,
      source_type: type.toLowerCase(),
      transaction_date: tx.transaction_date,
      description: tx.description,
      merchant: tx.merchant,
      amount: tx.amount,
      category: tx.category,
      source_row_hash: buildRowHash(job.id, tx.raw_row),
      raw_row: tx.raw_row,
    }));

    const { error } = await supabase
      .schema('finance')
      .from('transactions_inbox')
      .upsert(payload, { onConflict: 'ingestion_job_id,source_row_hash', ignoreDuplicates: true });

    if (error) {
      throw new Error(`Failed to upsert finance transactions: ${error.message}`);
    }
  }

  return {
    parser: 'financial-mvp',
    detected_type: type,
    rows_parsed: rows.length,
    rows_inserted: mapped.length,
  };
}

async function processHealthDocument(
  supabase: ReturnType<typeof createClient>,
  job: IngestionJob,
  doc: UploadDocument,
): Promise<IngestionResult> {
  const lowerName = doc.original_filename.toLowerCase();
  const documentKind =
    lowerName.includes('front')
      ? 'card_front'
      : lowerName.includes('back')
        ? 'card_back'
        : lowerName.includes('policy')
          ? 'policy'
          : lowerName.includes('claim')
            ? 'claim'
            : 'other';

  const { error } = await supabase
    .schema('health_meta')
    .from('insurance_documents')
    .upsert({
      user_id: doc.user_id,
      document_id: doc.id,
      document_kind: documentKind,
      ingestion_job_id: job.id,
    }, { onConflict: 'document_id,document_kind', ignoreDuplicates: true });

  if (error) {
    throw new Error(`Failed to upsert health document metadata: ${error.message}`);
  }

  return {
    parser: 'health-meta-mvp',
    detected_type: doc.detected_file_type.toUpperCase(),
    document_kind: documentKind,
  };
}

async function processCareerOrEducationDocument(
  supabase: ReturnType<typeof createClient>,
  job: IngestionJob,
  doc: UploadDocument,
  fileBytes: Uint8Array,
): Promise<IngestionResult> {
  const type = doc.detected_file_type.toUpperCase();
  let summary: IngestionResult = {
    parser: 'document-facts-mvp',
    detected_type: type,
  };

  if (type === 'DOCX') {
    const text = await parseDocx(fileBytes);
    summary = {
      ...summary,
      text_length: text.length,
      preview: text.slice(0, 400),
    };
  } else if (type === 'CSV') {
    const rows = parseCsv(new TextDecoder('utf-8', { fatal: false }).decode(fileBytes));
    summary = {
      ...summary,
      rows: rows.length,
      columns: rows[0] ? Object.keys(rows[0]) : [],
    };
  } else if (type === 'XLSX') {
    const rows = await parseXlsx(fileBytes);
    summary = {
      ...summary,
      rows: rows.length,
      columns: rows[0] ? Object.keys(rows[0]) : [],
    };
  }

  const { error } = await supabase
    .schema('core')
    .from('document_facts')
    .upsert({
      document_id: doc.id,
      user_id: doc.user_id,
      ingestion_job_id: job.id,
      fact_key: `${doc.domain}_summary`,
      fact_value: summary,
      source: 'parser',
      confidence: 0.8,
    }, { onConflict: 'document_id,fact_key,source', ignoreDuplicates: false });

  if (error) {
    throw new Error(`Failed to upsert document facts: ${error.message}`);
  }

  return summary;
}

async function processOneJob(
  supabase: ReturnType<typeof createClient>,
  job: IngestionJob,
): Promise<IngestionResult> {
  const startedAtMs = Date.now();

  const { data: doc, error: docError } = await supabase
    .schema('core')
    .from('upload_documents')
    .select('*')
    .eq('id', job.document_id)
    .single<UploadDocument>();

  if (docError || !doc) {
    throw new Error(`Document not found for job ${job.id}`);
  }

  const { data: existingResult } = await supabase
    .schema('core')
    .from('ingestion_results')
    .select('id, output_metadata')
    .eq('job_id', job.id)
    .maybeSingle();

  if (existingResult?.output_metadata) {
    return existingResult.output_metadata as IngestionResult;
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(doc.bucket_id)
    .download(doc.storage_path);

  if (downloadError || !blob) {
    throw new Error(`Failed to download file ${doc.storage_path}: ${downloadError?.message}`);
  }

  const fileBytes = new Uint8Array(await blob.arrayBuffer());
  ensureFileSizeWithinLimit(doc, fileBytes.length);
  checkTimeBudget(startedAtMs, 'downloaded');

  // Route PDF/image files through Gemini Vision OCR Edge Function
  const fileType = doc.detected_file_type.toUpperCase();
  if (['PDF', 'PNG', 'JPEG', 'JPG'].includes(fileType)) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (supabaseUrl && serviceRoleKey) {
      try {
        const ocrResponse = await fetch(
          `${supabaseUrl}/functions/v1/document-ocr`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              document_id: doc.id,
              document_source: 'ingestion',
              storage_bucket: doc.bucket_id,
              storage_path: doc.storage_path,
              mime_type: doc.mime_type,
              user_id: doc.user_id,
            }),
          },
        );

        if (ocrResponse.ok) {
          const ocrResult = await ocrResponse.json();

          if (ocrResult.success && ocrResult.extracted_fields?.length > 0) {
            // Store extracted fields as document_facts
            for (const field of ocrResult.extracted_fields) {
              await supabase
                .schema('core')
                .from('document_facts')
                .upsert(
                  {
                    document_id: doc.id,
                    user_id: doc.user_id,
                    ingestion_job_id: job.id,
                    fact_key: field.field_key,
                    fact_value: {
                      value: field.field_value,
                      type: field.field_type,
                    },
                    confidence: field.confidence_score,
                    source: ocrResult.extraction_method,
                  },
                  {
                    onConflict: 'document_id,fact_key,source',
                    ignoreDuplicates: false,
                  },
                );
            }

            return {
              parser: `ocr-${ocrResult.extraction_method}`,
              detected_type: fileType,
              fields_extracted: ocrResult.extracted_fields.length,
              pages_processed: ocrResult.pages_processed,
              duration_ms: ocrResult.duration_ms,
            };
          }
        }
        // Fall through to existing domain-specific processing on failure
      } catch (ocrError) {
        console.error(
          `[process-ingestion] OCR Edge Function failed for doc ${doc.id}, falling back:`,
          safeError(ocrError),
        );
        // Fall through to existing domain-specific processing
      }
    }
  }

  if (doc.domain === 'financial') {
    return processFinancialDocument(supabase, job, doc, fileBytes, startedAtMs);
  }

  if (doc.domain === 'health') {
    return processHealthDocument(supabase, job, doc);
  }

  return processCareerOrEducationDocument(supabase, job, doc, fileBytes);
}

async function invokeInternalAgentWebhook(job: IngestionJob, doc: UploadDocument): Promise<void> {
  const webhookUrl = Deno.env.get('INTERNAL_AGENT_WEBHOOK_URL');
  const webhookSecret = Deno.env.get('INTERNAL_AGENT_WEBHOOK_SECRET');
  if (!webhookUrl || !webhookSecret) {
    return;
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-worker-secret': webhookSecret,
      'x-worker-id': 'process-ingestion',
      // Stable UUID to support replay detection on downstream endpoint.
      'x-request-id': job.id,
    },
    body: JSON.stringify({
      job_id: job.id,
      user_id: job.user_id,
      document_id: job.document_id,
      domain: doc.domain,
      task: 'extract_and_route',
      input: {
        bucket_id: doc.bucket_id,
        storage_path: doc.storage_path,
        detected_file_type: doc.detected_file_type?.toUpperCase(),
        checksum_sha256: doc.checksum_sha256 || null,
      },
      attempt: job.attempts,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(`Internal agent webhook failed (${response.status}): ${bodyText}`);
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const workerSecret = Deno.env.get('INGESTION_WORKER_SECRET');
    if (workerSecret) {
      const provided = req.headers.get('x-worker-secret');
      if (!provided || !constantTimeEqual(provided, workerSecret)) {
        return new Response(JSON.stringify({ error: 'Unauthorized worker secret' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const requestedLimit = Number(body?.limit ?? 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), MAX_CLAIM_LIMIT) : 10;
    const workerId = body?.worker_id || `edge-${crypto.randomUUID()}`;

    const { data: claimed, error: claimError } = await supabase.rpc('claim_ingestion_jobs', {
      p_limit: limit,
      p_worker_id: workerId,
      p_lease_seconds: 300,
    });

    if (claimError) {
      throw new Error(`Failed to claim jobs: ${claimError.message}`);
    }

    const jobs = (claimed || []) as IngestionJob[];
    const summary = {
      worker_id: workerId,
      claimed: jobs.length,
      completed: 0,
      failed: 0,
      details: [] as Array<Record<string, unknown>>,
    };

    for (const job of jobs) {
      try {
        const result = await processOneJob(supabase, job);
        const { data: doc } = await supabase
          .schema('core')
          .from('upload_documents')
          .select('domain,bucket_id,storage_path,detected_file_type,checksum_sha256')
          .eq('id', job.document_id)
          .single<Pick<UploadDocument, 'domain' | 'bucket_id' | 'storage_path' | 'detected_file_type' | 'checksum_sha256'>>();

        const { data: resultInsert, error: resultError } = await supabase
          .schema('core')
          .from('ingestion_results')
          .upsert({
            job_id: job.id,
            document_id: job.document_id,
            user_id: job.user_id,
            parser_version: job.parser_version || 'mvp-v1',
            status: 'completed',
            output_metadata: result,
          }, { onConflict: 'job_id', ignoreDuplicates: false })
          .select('output_metadata')
          .single();

        if (resultError) {
          throw new Error(`Failed to persist ingestion result for job ${job.id}: ${resultError.message}`);
        }

        const { error: completeError } = await supabase.rpc('complete_ingestion_job', {
          p_job_id: job.id,
          p_result: resultInsert?.output_metadata || result,
        });

        if (completeError) {
          throw new Error(`Failed to complete job ${job.id}: ${completeError.message}`);
        }

        if (doc) {
          try {
            await invokeInternalAgentWebhook(job, {
              id: job.document_id,
              user_id: job.user_id,
              domain: doc.domain,
              bucket_id: doc.bucket_id,
              storage_path: doc.storage_path,
              detected_file_type: doc.detected_file_type,
              checksum_sha256: doc.checksum_sha256,
              original_filename: '',
              mime_type: '',
              file_size_bytes: 0,
            });
          } catch (webhookError) {
            console.error(`Webhook notify failed for job ${job.id}:`, safeError(webhookError));
          }
        }

        summary.completed += 1;
        summary.details.push({ job_id: job.id, status: 'completed', result });
      } catch (jobError) {
        const errorText = safeError(jobError);

        await supabase.rpc('fail_ingestion_job', {
          p_job_id: job.id,
          p_error: errorText,
          p_max_backoff_minutes: 60,
        });

        await supabase
          .schema('core')
          .from('ingestion_results')
          .upsert({
            job_id: job.id,
            document_id: job.document_id,
            user_id: job.user_id,
            parser_version: job.parser_version || 'mvp-v1',
            status: 'failed',
            output_metadata: { error: errorText },
          }, { onConflict: 'job_id', ignoreDuplicates: false });

        summary.failed += 1;
        summary.details.push({ job_id: job.id, status: 'failed', error: errorText });
      }
    }

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    const message = safeError(error);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});
