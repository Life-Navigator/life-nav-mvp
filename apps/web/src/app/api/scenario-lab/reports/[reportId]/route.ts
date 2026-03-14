/**
 * Scenario Lab - Get Report Endpoint
 *
 * GET /api/scenario-lab/reports/[reportId]
 * Retrieves report metadata and signed download URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/auth/jwt';
import { supabaseAdmin, createAuditLog } from '@/lib/scenario-lab/supabase-client';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.FEATURE_SCENARIO_LAB_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 });
    }

    const { reportId } = await params;

    // Fetch report (user-scoped)
    const { data: report, error: reportError } = await (supabaseAdmin as any)
      .from('scenario_reports')
      .select('*')
      .eq('id', reportId)
      .eq('user_id', userId)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // If report is completed and has storage_path, generate signed URL
    let signed_download_url = null;
    if (report.status === 'completed' && report.storage_path) {
      const { data: signedUrlData, error: signedUrlError } = await (supabaseAdmin as any).storage
        .from('scenario-reports')
        .createSignedUrl(report.storage_path, 3600); // 60 minutes

      if (signedUrlError) {
        console.error('[API] Error creating signed URL:', signedUrlError);
      } else {
        signed_download_url = signedUrlData?.signedUrl || null;

        // Audit download access
        await createAuditLog({
          user_id: userId,
          action: 'report.accessed',
          resource_type: 'scenario_report',
          resource_id: reportId,
          metadata: {
            storage_path: report.storage_path,
          },
        });
      }
    }

    return NextResponse.json({
      report: {
        id: report.id,
        scenario_id: report.scenario_id,
        version_id: report.version_id,
        status: report.status,
        report_type: report.report_type,
        file_size: report.file_size,
        page_count: report.page_count,
        error_text: report.error_text,
        created_at: report.created_at,
        updated_at: report.updated_at,
        signed_download_url,
      },
    });
  } catch (error) {
    console.error('[API] Error in GET /reports/[reportId]:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
