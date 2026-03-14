/**
 * Scenario Lab - OCR Trigger Endpoint
 *
 * POST /api/scenario-lab/documents/[documentId]/ocr
 * Enqueues OCR extraction job for a document
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/auth/jwt';
import { supabaseAdmin, createAuditLog } from '@/lib/scenario-lab/supabase-client';
import { enqueueJob } from '@/lib/scenario-lab/job-queue';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.FEATURE_SCENARIO_LAB_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 });
    }

    const { documentId } = await params;

    // Fetch document and verify ownership
    const { data: document, error: docError } = await (supabaseAdmin as any)
      .from('scenario_documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check if OCR is already in progress
    if (document.ocr_status === 'processing' || document.ocr_status === 'queued') {
      return NextResponse.json(
        { error: 'OCR already in progress for this document' },
        { status: 409 }
      );
    }

    // Enqueue OCR job
    const job = await enqueueJob({
      userId,
      scenarioId: document.scenario_id,
      jobType: 'OCR',
      inputJson: {
        document_id: documentId,
        storage_bucket: document.storage_bucket,
        storage_path: document.storage_path,
        mime_type: document.mime_type,
        filename: document.filename,
      },
      idempotencyKey: `ocr-${documentId}-${Date.now()}`,
    });

    // Update document status
    await (supabaseAdmin as any)
      .from('scenario_documents')
      .update({
        ocr_status: 'queued',
        ocr_job_id: job.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    // Audit log
    await createAuditLog({
      user_id: userId,
      action: 'document.ocr_enqueued',
      resource_type: 'scenario_document',
      resource_id: documentId,
      metadata: { job_id: job.id },
    });

    return NextResponse.json(
      {
        job_id: job.id,
        status: job.status,
        message: 'OCR job enqueued. Poll /api/scenario-lab/jobs/{job_id} for status.',
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('[API] Error in POST /documents/[documentId]/ocr:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
