/**
 * Scenario Lab - Get Scenario Reports Endpoint
 *
 * GET /api/scenario-lab/scenarios/[id]/reports
 * Retrieves all reports for a scenario
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { supabaseAdmin } from '@/lib/scenario-lab/supabase-client';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.FEATURE_SCENARIO_LAB_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 });
    }

    const scenarioId = params.id;

    // Verify scenario ownership
    const { data: scenario, error: scenarioError } = await supabaseAdmin
      .from('scenario_labs')
      .select('id')
      .eq('id', scenarioId)
      .eq('user_id', userId)
      .single();

    if (scenarioError || !scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Fetch reports for this scenario
    const { data: reports, error: reportsError } = await supabaseAdmin
      .from('scenario_reports')
      .select('*')
      .eq('scenario_id', scenarioId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (reportsError) {
      console.error('[API] Error fetching reports:', reportsError);
      return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
    }

    return NextResponse.json({
      reports: reports || [],
    });
  } catch (error) {
    console.error('[API] Error in GET /scenarios/[id]/reports:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
