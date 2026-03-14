/**
 * Scenario Lab - Versions Endpoint
 *
 * GET /api/scenario-lab/scenarios/[id]/versions - List versions
 * POST /api/scenario-lab/scenarios/[id]/versions - Create new version (save state)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/auth/jwt';
import { supabaseAdmin, createAuditLog } from '@/lib/scenario-lab/supabase-client';
import { createVersionSchema } from '@/lib/scenario-lab/validation';

export const dynamic = 'force-dynamic';

/**
 * GET - List all versions for a scenario
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

    // Fetch versions
    const { data: versions, error: versionsError } = await (supabaseAdmin as any)
      .from('scenario_versions')
      .select('*')
      .eq('scenario_id', scenarioId)
      .order('version_number', { ascending: false });

    if (versionsError) {
      console.error('[API] Error fetching versions:', versionsError);
      return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 });
    }

    return NextResponse.json({ versions });
  } catch (error) {
    console.error('[API] Error in GET /scenarios/[id]/versions:', error);
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
 * POST - Create new version (save current state)
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

    const { id: scenarioId } = await params;

    // Verify scenario ownership and get current version
    const { data: scenario, error: scenarioError } = await (supabaseAdmin as any)
      .from('scenario_labs')
      .select('id, status, current_version_id')
      .eq('id', scenarioId)
      .eq('user_id', userId)
      .single();

    if (scenarioError || !scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Prevent creating versions for committed scenarios
    if (scenario.status === 'committed') {
      return NextResponse.json(
        { error: 'Cannot create version for committed scenario' },
        { status: 400 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const validation = createVersionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { name, description } = validation.data;

    // Get next version number
    const { data: latestVersion } = await (supabaseAdmin as any)
      .from('scenario_versions')
      .select('version_number')
      .eq('scenario_id', scenarioId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    const nextVersionNumber = (latestVersion?.version_number || 0) + 1;

    // Create new version
    const { data: version, error: createError } = await (supabaseAdmin as any)
      .from('scenario_versions')
      .insert({
        scenario_id: scenarioId,
        user_id: userId,
        version_number: nextVersionNumber,
        name,
        description: description || null,
      })
      .select()
      .single();

    if (createError) {
      console.error('[API] Error creating version:', createError);
      return NextResponse.json({ error: 'Failed to create version' }, { status: 500 });
    }

    // Copy inputs from previous version if exists
    if (scenario.current_version_id) {
      const { data: previousInputs } = await (supabaseAdmin as any)
        .from('scenario_inputs')
        .select('*')
        .eq('version_id', scenario.current_version_id);

      if (previousInputs && previousInputs.length > 0) {
        const newInputs = previousInputs.map((input: any) => ({
          version_id: version.id,
          user_id: userId,
          goal_id: input.goal_id,
          field_name: input.field_name,
          field_value: input.field_value,
          field_type: input.field_type,
          source: input.source,
          confidence: input.confidence,
        }));

        await (supabaseAdmin as any).from('scenario_inputs').insert(newInputs);
      }
    }

    // Update scenario current_version_id
    await (supabaseAdmin as any)
      .from('scenario_labs')
      .update({ current_version_id: version.id })
      .eq('id', scenarioId);

    // Audit log
    await createAuditLog({
      user_id: userId,
      action: 'version.created',
      resource_type: 'scenario_version',
      resource_id: version.id,
      metadata: { scenario_id: scenarioId, version_number: nextVersionNumber },
    });

    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    console.error('[API] Error in POST /scenarios/[id]/versions:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
