/**
 * POST /api/ingest/upload — Sprint N.2 hardened.
 *
 * Flow: classify → SCAN (mandatory) → STORE (object store) → EXTRACT
 *       (telemetry + cost meter) → PROMOTE.
 *
 * Real malware scanning is enforced by `defaultScanner()`. No bypass
 * exists — even `none` requires the explicit MALWARE_SCAN_DISABLED=1
 * flag for development workflows.
 *
 * Storage uses `SupabaseStorageAdapter` against the configured bucket.
 * Database carries `(storage_bucket, storage_path)` — large binary
 * payloads are NOT persisted into the relational store except as the
 * extractor-emitted text/structured payloads.
 *
 * Telemetry is written per-extractor and per-provider call.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { defaultScanner } from '@/lib/malware/scanner';
import { SupabaseStorageAdapter } from '@/lib/storage/object-store';
import { processUpload } from '@/lib/ingestion/upload-pipeline';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json(
      { error: 'bad_request', message: 'file required (multipart field "file")' },
      { status: 400 }
    );
  }
  const filename = (file as { name?: string }).name ?? 'unnamed';
  const declared_mime = (file as { type?: string }).type ?? undefined;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const scanner = await defaultScanner();
  const storage = new SupabaseStorageAdapter({ client: supabase });

  const result = await processUpload({
    user_id: user.id,
    filename,
    declared_mime,
    bytes,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: supabase as any,
    scanner,
    storage,
  });

  if (result.ok === false) {
    const rejected = result;
    const httpStatus =
      rejected.status === 'invalid'
        ? 400
        : rejected.status === 'infected'
          ? 422
          : rejected.status === 'scan_error'
            ? 503
            : rejected.status === 'storage_error'
              ? 503
              : rejected.status === 'persistence_error'
                ? 500
                : 500;
    return NextResponse.json(
      {
        error: rejected.reason_code,
        message: rejected.client_message,
        scan: rejected.scan
          ? {
              scanner: rejected.scan.scanner,
              status: rejected.scan.status,
              signature: rejected.scan.signature,
            }
          : undefined,
      },
      { status: httpStatus }
    );
  }

  return NextResponse.json({
    file_id: result.file_id,
    job_id: result.job_id,
    classification: result.classification,
    extractors_run: result.extractors_run,
    deferred: result.status === 'deferred',
    ok: result.status === 'accepted',
    entity_count: result.entity_count,
    fact_count: result.fact_count,
    scan: {
      scanner: result.scan.scanner,
      status: result.scan.status,
    },
    storage: result.storage,
    warnings: result.warnings,
    errors: result.errors,
  });
}
