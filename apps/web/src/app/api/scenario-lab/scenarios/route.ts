/**
 * Scenario Lab - Scenarios Collection Endpoint
 *
 * GET /api/scenario-lab/scenarios - List user's scenarios
 * POST /api/scenario-lab/scenarios - Create new scenario
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { supabaseAdmin, createAuditLog } from '@/lib/scenario-lab/supabase-client';
import { createScenarioSchema } from '@/lib/scenario-lab/validation';

export const dynamic = 'force-dynamic';

/**
 * GET - List user's scenarios
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.FEATURE_SCENARIO_LAB_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // Filter by status
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query
    let query = supabaseAdmin
      .from('scenario_labs')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: scenarios, error } = await query;

    if (error) {
      console.error('[API] Error listing scenarios:', error);
      return NextResponse.json({ error: 'Failed to list scenarios' }, { status: 500 });
    }

    return NextResponse.json({ scenarios });
  } catch (error) {
    console.error('[API] Error in GET /scenarios:', error);
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
 * POST - Create new scenario
 */
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
    const validation = createScenarioSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { name, description, icon, color } = validation.data;

    // Create scenario
    const { data: scenario, error: createError } = await supabaseAdmin
      .from('scenario_labs')
      .insert({
        user_id: userId,
        name,
        description: description || null,
        icon: icon || 'flask',
        color: color || '#3B82F6',
        status: 'draft',
      })
      .select()
      .single();

    if (createError) {
      console.error('[API] Error creating scenario:', createError);
      return NextResponse.json({ error: 'Failed to create scenario' }, { status: 500 });
    }

    // Create initial version (v1)
    const { data: version, error: versionError } = await supabaseAdmin
      .from('scenario_versions')
      .insert({
        scenario_id: scenario.id,
        user_id: userId,
        version_number: 1,
        name: 'Initial version',
      })
      .select()
      .single();

    if (versionError) {
      console.error('[API] Error creating initial version:', versionError);
      // Rollback scenario creation
      await supabaseAdmin.from('scenario_labs').delete().eq('id', scenario.id);
      return NextResponse.json({ error: 'Failed to create initial version' }, { status: 500 });
    }

    // Update scenario with current_version_id
    const { error: updateError } = await supabaseAdmin
      .from('scenario_labs')
      .update({ current_version_id: version.id })
      .eq('id', scenario.id);

    if (updateError) {
      console.error('[API] Error updating scenario version:', updateError);
    }

    // Audit log
    await createAuditLog({
      user_id: userId,
      action: 'scenario.created',
      resource_type: 'scenario',
      resource_id: scenario.id,
      metadata: { name, version_id: version.id },
    });

    return NextResponse.json({
      scenario: {
        ...scenario,
        current_version_id: version.id,
      },
      version,
    }, { status: 201 });
  } catch (error) {
    console.error('[API] Error in POST /scenarios:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
