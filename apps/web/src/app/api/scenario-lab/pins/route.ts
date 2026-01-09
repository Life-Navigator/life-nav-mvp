/**
 * Scenario Lab - Pins API
 *
 * GET /api/scenario-lab/pins - Get current user's pin
 * POST /api/scenario-lab/pins - Create/update pin
 * DELETE /api/scenario-lab/pins - Remove pin
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { supabaseAdmin, createAuditLog } from '@/lib/scenario-lab/supabase-client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET - Retrieve current user's pin
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.FEATURE_SCENARIO_LAB_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 });
    }

    // Fetch user's pin (only one per user)
    const { data: pin, error: pinError } = await supabaseAdmin
      .from('scenario_pins')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (pinError || !pin) {
      return NextResponse.json({ pin: null });
    }

    // Fetch scenario metadata
    const { data: scenario } = await supabaseAdmin
      .from('scenario_labs')
      .select('name')
      .eq('id', pin.scenario_id)
      .single();

    // Fetch latest simulation run for this version
    const { data: latestSim } = await supabaseAdmin
      .from('scenario_sim_runs')
      .select('id, created_at')
      .eq('version_id', pin.version_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!latestSim) {
      return NextResponse.json({
        pin: {
          id: pin.id,
          scenarioId: pin.scenario_id,
          versionId: pin.version_id,
          goalId: pin.goal_id,
          createdAt: pin.created_at,
          updatedAt: pin.updated_at,
          snapshot: null,
          trend: [],
        },
      });
    }

    // Fetch goal snapshot
    const { data: snapshot } = await supabaseAdmin
      .from('scenario_goal_snapshots')
      .select('*')
      .eq('sim_run_id', latestSim.id)
      .eq('goal_id', pin.goal_id)
      .single();

    if (!snapshot) {
      return NextResponse.json({
        pin: {
          id: pin.id,
          scenarioId: pin.scenario_id,
          versionId: pin.version_id,
          goalId: pin.goal_id,
          scenarioName: scenario?.name || 'Unknown',
          createdAt: pin.created_at,
          updatedAt: pin.updated_at,
          snapshot: null,
          trend: [],
        },
      });
    }

    // Fetch trend data (last 20 p50 values from recent sim runs)
    const { data: recentSims } = await supabaseAdmin
      .from('scenario_sim_runs')
      .select('id, created_at')
      .eq('version_id', pin.version_id)
      .order('created_at', { ascending: false })
      .limit(20);

    const trend: number[] = [];
    if (recentSims && recentSims.length > 0) {
      for (const sim of recentSims) {
        const { data: goalSnapshot } = await supabaseAdmin
          .from('scenario_goal_snapshots')
          .select('p50')
          .eq('sim_run_id', sim.id)
          .eq('goal_id', pin.goal_id)
          .single();

        if (goalSnapshot && goalSnapshot.p50 !== null) {
          trend.push(goalSnapshot.p50);
        }
      }
    }

    // Reverse trend so oldest is first
    trend.reverse();

    // If trend is empty or single value, use p50
    if (trend.length === 0 && snapshot.p50 !== null) {
      trend.push(snapshot.p50);
    }

    return NextResponse.json({
      pin: {
        id: pin.id,
        scenarioId: pin.scenario_id,
        versionId: pin.version_id,
        goalId: pin.goal_id,
        scenarioName: scenario?.name || 'Unknown',
        createdAt: pin.created_at,
        updatedAt: pin.updated_at,
        snapshot: {
          status: snapshot.status || 'unknown',
          p10: snapshot.p10 || 0,
          p50: snapshot.p50 || 0,
          p90: snapshot.p90 || 0,
          drivers: (snapshot.top_drivers || []).slice(0, 3).map((d: any) => d.field || ''),
          risks: (snapshot.top_risks || []).slice(0, 3).map((r: any) => r.field || ''),
          updatedAt: latestSim.created_at,
        },
        trend,
      },
    });
  } catch (error) {
    console.error('[API] Error in GET /pins:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create or update pin
// ============================================================================

const createPinSchema = z.object({
  scenarioId: z.string().uuid(),
  versionId: z.string().uuid(),
  goalId: z.string().min(1),
});

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
    const validation = createPinSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { scenarioId, versionId, goalId } = validation.data;

    // Verify scenario ownership
    const { data: scenario, error: scenarioError } = await supabaseAdmin
      .from('scenario_labs')
      .select('id, status, committed_version_id')
      .eq('id', scenarioId)
      .eq('user_id', userId)
      .single();

    if (scenarioError || !scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Verify version ownership and belongs to scenario
    const { data: version, error: versionError } = await supabaseAdmin
      .from('scenario_versions')
      .select('id')
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
          message: 'Only committed scenario versions can be pinned.',
        },
        { status: 409 }
      );
    }

    // Verify goal exists in simulation results
    const { data: latestSim } = await supabaseAdmin
      .from('scenario_sim_runs')
      .select('id')
      .eq('version_id', versionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestSim) {
      const { data: goalSnapshot } = await supabaseAdmin
        .from('scenario_goal_snapshots')
        .select('id')
        .eq('sim_run_id', latestSim.id)
        .eq('goal_id', goalId)
        .single();

      if (!goalSnapshot) {
        return NextResponse.json(
          { error: 'Goal not found in simulation results' },
          { status: 404 }
        );
      }
    }

    // Delete any existing pins for this user (only one pin allowed)
    await supabaseAdmin.from('scenario_pins').delete().eq('user_id', userId);

    // Create new pin
    const { data: pin, error: pinError } = await supabaseAdmin
      .from('scenario_pins')
      .insert({
        user_id: userId,
        scenario_id: scenarioId,
        version_id: versionId,
        goal_id: goalId,
      })
      .select()
      .single();

    if (pinError || !pin) {
      console.error('[API] Error creating pin:', pinError);
      return NextResponse.json({ error: 'Failed to create pin' }, { status: 500 });
    }

    // Audit log
    await createAuditLog({
      user_id: userId,
      action: 'scenario.pinned',
      resource_type: 'scenario_pin',
      resource_id: pin.id,
      metadata: {
        scenario_id: scenarioId,
        version_id: versionId,
        goal_id: goalId,
      },
    });

    return NextResponse.json(
      {
        message: 'Goal pinned successfully',
        pin: {
          id: pin.id,
          scenarioId: pin.scenario_id,
          versionId: pin.version_id,
          goalId: pin.goal_id,
          createdAt: pin.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] Error in POST /pins:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Remove pin
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.FEATURE_SCENARIO_LAB_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 });
    }

    // Fetch current pin
    const { data: pin } = await supabaseAdmin
      .from('scenario_pins')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!pin) {
      return NextResponse.json({ message: 'No pin to remove' });
    }

    // Delete pin
    const { error: deleteError } = await supabaseAdmin
      .from('scenario_pins')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('[API] Error deleting pin:', deleteError);
      return NextResponse.json({ error: 'Failed to delete pin' }, { status: 500 });
    }

    // Audit log
    await createAuditLog({
      user_id: userId,
      action: 'scenario.unpinned',
      resource_type: 'scenario_pin',
      resource_id: pin.id,
      metadata: {},
    });

    return NextResponse.json({ message: 'Pin removed successfully' });
  } catch (error) {
    console.error('[API] Error in DELETE /pins:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
