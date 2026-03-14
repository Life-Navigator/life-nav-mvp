/**
 * Scenario Lab - Document Upload & List Endpoints
 *
 * POST /api/scenario-lab/scenarios/[id]/documents - Get signed upload URL
 * GET /api/scenario-lab/scenarios/[id]/documents - List documents
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/auth/jwt';
import { supabaseAdmin, createAuditLog } from '@/lib/scenario-lab/supabase-client';
import {
  uploadDocumentSchema,
  validateFileType,
  validateFileSize,
} from '@/lib/scenario-lab/validation';
import { enforceRateLimit } from '@/lib/scenario-lab/rate-limiter';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * POST - Get signed upload URL for document
 * Returns document_id and upload_url for client-side upload
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.FEATURE_SCENARIO_LAB_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 });
    }

    // Rate limit check (uploads: 5/hour)
    try {
      await enforceRateLimit(userId, 'upload');
    } catch (rateLimitError: any) {
      return NextResponse.json({ error: rateLimitError.message }, { status: 429 });
    }

    const { id: scenarioId } = await params;

    // Verify scenario ownership
    const { data: scenario, error: scenarioError } = await (supabaseAdmin as any)
      .from('scenario_labs')
      .select('id, status')
      .eq('id', scenarioId)
      .eq('user_id', userId)
      .single();

    if (scenarioError || !scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Parse and validate body
    const body = await request.json();
    const validation = uploadDocumentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { filename, mime_type, file_size_bytes, document_type } = validation.data;

    // Additional validation
    const allowedMimeTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
    ];

    if (!allowedMimeTypes.includes(mime_type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${allowedMimeTypes.join(', ')}` },
        { status: 400 }
      );
    }

    if (!validateFileSize(file_size_bytes)) {
      return NextResponse.json(
        { error: 'File size must be between 1 byte and 10MB' },
        { status: 400 }
      );
    }

    // Generate storage path
    const timestamp = Date.now();
    const fileExt = filename.split('.').pop();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${userId}/${scenarioId}/${timestamp}_${sanitizedFilename}`;

    // Create document record
    const { data: document, error: createError } = await (supabaseAdmin as any)
      .from('scenario_documents')
      .insert({
        scenario_id: scenarioId,
        user_id: userId,
        filename: sanitizedFilename,
        file_type: fileExt || 'unknown',
        file_size_bytes,
        mime_type,
        storage_bucket: 'scenario-docs',
        storage_path: storagePath,
        content_hash: '', // Will be set after upload if needed
        document_type: document_type || 'other',
        ocr_status: 'pending',
      })
      .select()
      .single();

    if (createError || !document) {
      console.error('[API] Error creating document record:', createError);
      return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
    }

    // Generate signed upload URL (60 minutes expiry)
    const { data: signedData, error: signedError } = await (supabaseAdmin as any).storage
      .from('scenario-docs')
      .createSignedUploadUrl(storagePath);

    if (signedError || !signedData) {
      console.error('[API] Error generating signed URL:', signedError);
      // Rollback document creation
      await (supabaseAdmin as any).from('scenario_documents').delete().eq('id', document.id);
      return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
    }

    // Audit log
    await createAuditLog({
      user_id: userId,
      action: 'document.upload_initiated',
      resource_type: 'scenario_document',
      resource_id: document.id,
      metadata: { scenario_id: scenarioId, filename: sanitizedFilename, file_size_bytes },
    });

    return NextResponse.json(
      {
        document_id: document.id,
        upload_url: signedData.signedUrl,
        upload_token: signedData.token,
        storage_path: storagePath,
        expires_in: 3600, // 60 minutes
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] Error in POST /scenarios/[id]/documents:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET - List documents for scenario
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.FEATURE_SCENARIO_LAB_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 });
    }

    const { id: scenarioId } = await params;

    // Verify scenario ownership
    const { data: scenario, error: scenarioError } = await (supabaseAdmin as any)
      .from('scenario_labs')
      .select('id')
      .eq('id', scenarioId)
      .eq('user_id', userId)
      .single();

    if (scenarioError || !scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Fetch documents (exclude soft-deleted)
    const { data: documents, error: docsError } = await (supabaseAdmin as any)
      .from('scenario_documents')
      .select('*')
      .eq('scenario_id', scenarioId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (docsError) {
      console.error('[API] Error fetching documents:', docsError);
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    return NextResponse.json({ documents: documents || [] });
  } catch (error) {
    console.error('[API] Error in GET /scenarios/[id]/documents:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
