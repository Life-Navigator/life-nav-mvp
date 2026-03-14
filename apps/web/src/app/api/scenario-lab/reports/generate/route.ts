/**
 * Scenario Lab - Generate PDF Report Endpoint
 *
 * POST /api/scenario-lab/reports/generate
 * Enqueues a PDF generation job for a committed scenario
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { supabaseAdmin, createAuditLog } from '@/lib/scenario-lab/supabase-client';
import { enqueueJob } from '@/lib/scenario-lab/job-queue';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const generateReportSchema = z.object({
  scenarioId: z.string().uuid(),
  versionId: z.string().uuid(),
});

// Rate limit: 10 reports per day per user
const RATE_LIMIT_PER_DAY = 10;

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.FEATURE_SCENARIO_LAB_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 });
    }

    // Parse and validate body
    const body = await request.json();
    const validation = generateReportSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { scenarioId, versionId } = validation.data;

    // Verify scenario ownership
    const { data: scenario, error: scenarioError } = await (supabaseAdmin as any)
      .from('scenario_labs')
      .select('id, name, status, committed_version_id, user_id')
      .eq('id', scenarioId)
      .eq('user_id', userId)
      .single();

    if (scenarioError || !scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Verify version ownership and belongs to scenario
    const { data: version, error: versionError } = await (supabaseAdmin as any)
      .from('scenario_versions')
      .select('id, version_number, name, scenario_id')
      .eq('id', versionId)
      .eq('user_id', userId)
      .eq('scenario_id', scenarioId)
      .single();

    if (versionError || !version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    // Verify version is committed
    if (scenario.committed_version_id !== versionId || scenario.status !== 'committed') {
      return NextResponse.json(
        {
          error: 'Version not committed',
          message: 'PDF reports can only be generated for committed scenario versions.',
        },
        { status: 409 }
      );
    }

    // Check rate limit (10 reports per day)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentReports, error: countError } = await (supabaseAdmin as any)
      .from('scenario_reports')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', oneDayAgo);

    if (countError) {
      console.error('[API] Error checking rate limit:', countError);
    }

    if (recentReports && recentReports.length >= RATE_LIMIT_PER_DAY) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `You can generate up to ${RATE_LIMIT_PER_DAY} reports per day. Please try again later.`,
        },
        { status: 429 }
      );
    }

    // Create scenario_reports record
    const { data: report, error: reportError } = await (supabaseAdmin as any)
      .from('scenario_reports')
      .insert({
        scenario_id: scenarioId,
        version_id: versionId,
        user_id: userId,
        status: 'queued',
        report_type: 'full',
      })
      .select()
      .single();

    if (reportError || !report) {
      console.error('[API] Error creating report record:', reportError);
      return NextResponse.json({ error: 'Failed to create report record' }, { status: 500 });
    }

    // Enqueue PDF generation job
    const job = await enqueueJob({
      userId,
      scenarioId,
      jobType: 'PDF',
      inputJson: {
        scenario_id: scenarioId,
        version_id: versionId,
        report_id: report.id,
      },
    });

    if (!job) {
      // Rollback report record
      await (supabaseAdmin as any).from('scenario_reports').delete().eq('id', report.id);
      return NextResponse.json({ error: 'Failed to enqueue job' }, { status: 500 });
    }

    // Audit log
    await createAuditLog({
      user_id: userId,
      action: 'report.generate_requested',
      resource_type: 'scenario_report',
      resource_id: report.id,
      metadata: {
        scenario_id: scenarioId,
        version_id: versionId,
        job_id: job.id,
      },
    });

    return NextResponse.json(
      {
        message: 'Report generation queued',
        reportId: report.id,
        jobId: job.id,
        status: 'queued',
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('[API] Error in POST /reports/generate:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
