/**
 * Scenario Lab - Commit Endpoint
 *
 * POST /api/scenario-lab/scenarios/[id]/commit
 * Commits a scenario version and generates roadmap (plan + phases + tasks)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/auth/jwt';
import { supabaseAdmin, createAuditLog } from '@/lib/scenario-lab/supabase-client';
import { z } from 'zod';
import { generateRoadmap } from '@/lib/scenario-lab/roadmap/generator';

export const dynamic = 'force-dynamic';

const commitSchema = z.object({
  versionId: z.string().uuid(),
  commitMessage: z.string().max(500).optional(),
  supersede: z.boolean().optional().default(false),
});

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

    // Parse and validate body
    const body = await request.json();
    const validation = commitSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { versionId, commitMessage, supersede } = validation.data;

    // Verify scenario ownership
    const { data: scenario, error: scenarioError } = await (supabaseAdmin as any)
      .from('scenario_labs')
      .select('id, name, status, committed_version_id')
      .eq('id', scenarioId)
      .eq('user_id', userId)
      .single();

    if (scenarioError || !scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Check if already committed to a different version
    if (scenario.committed_version_id && scenario.committed_version_id !== versionId) {
      // If supersede flag is not set, return 409 error
      if (!supersede) {
        return NextResponse.json(
          {
            error: 'SCENARIO_ALREADY_COMMITTED',
            committedVersionId: scenario.committed_version_id,
            message:
              'This scenario already has a committed version. Fork to change assumptions, or explicitly supersede.',
          },
          { status: 409 }
        );
      }

      // Supersede flow: mark previous version as 'superseded'
      const previousVersionId = scenario.committed_version_id;

      // Update previous committed version status
      await (supabaseAdmin as any)
        .from('scenario_versions')
        .update({
          status: 'superseded',
          updated_at: new Date().toISOString(),
        })
        .eq('id', previousVersionId);

      // Mark previous plan as 'superseded' (keep for history)
      await (supabaseAdmin as any)
        .from('plans')
        .update({
          status: 'superseded',
          updated_at: new Date().toISOString(),
        })
        .eq('scenario_version_id', previousVersionId);

      // Log supersede action
      await createAuditLog({
        user_id: userId,
        action: 'SCENARIO_COMMIT_SUPERSEDE',
        resource_type: 'scenario',
        resource_id: scenarioId,
        metadata: {
          from_version_id: previousVersionId,
          to_version_id: versionId,
          commit_message: commitMessage,
        },
      });
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

    // Check if already committed (idempotent)
    if (scenario.committed_version_id === versionId && scenario.status === 'committed') {
      // Already committed, fetch existing plan
      const { data: existingPlan } = await (supabaseAdmin as any)
        .from('plans')
        .select('id')
        .eq('scenario_version_id', versionId)
        .single();

      if (existingPlan) {
        const { data: phases } = await (supabaseAdmin as any)
          .from('plan_phases')
          .select('id')
          .eq('plan_id', existingPlan.id);

        const { data: tasks } = await (supabaseAdmin as any)
          .from('plan_tasks')
          .select('id')
          .eq('plan_id', existingPlan.id);

        return NextResponse.json({
          message: 'Scenario already committed',
          planId: existingPlan.id,
          phaseCount: phases?.length || 0,
          taskCount: tasks?.length || 0,
        });
      }
    }

    // Fetch inputs for roadmap generation
    const { data: inputs, error: inputsError } = await (supabaseAdmin as any)
      .from('scenario_inputs')
      .select('*')
      .eq('version_id', versionId);

    if (inputsError) {
      console.error('[API] Error fetching inputs:', inputsError);
      return NextResponse.json({ error: 'Failed to fetch inputs' }, { status: 500 });
    }

    if (!inputs || inputs.length === 0) {
      return NextResponse.json(
        { error: 'Cannot commit scenario with no inputs. Add inputs first.' },
        { status: 400 }
      );
    }

    // Fetch latest simulation results (optional)
    const { data: latestSim } = await (supabaseAdmin as any)
      .from('scenario_sim_runs')
      .select('id')
      .eq('version_id', versionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let simulationResults;
    if (latestSim) {
      const { data: goalSnapshots } = await (supabaseAdmin as any)
        .from('scenario_goal_snapshots')
        .select('goal_id, top_drivers, top_risks')
        .eq('sim_run_id', latestSim.id);

      if (goalSnapshots) {
        simulationResults = {
          goals: goalSnapshots.map((g) => ({
            goal_id: g.goal_id,
            top_drivers: g.top_drivers || [],
            top_risks: g.top_risks || [],
          })),
        };
      }
    }

    // Generate roadmap
    const roadmap = generateRoadmap({
      scenarioName: scenario.name,
      inputs,
      simulationResults,
    });

    // Create plan
    const { data: plan, error: planError } = await (supabaseAdmin as any)
      .from('plans')
      .insert({
        scenario_version_id: versionId,
        user_id: userId,
        name: `${scenario.name} - Roadmap`,
        description: commitMessage || 'Generated roadmap from committed scenario',
        status: 'active',
      })
      .select()
      .single();

    if (planError || !plan) {
      console.error('[API] Error creating plan:', planError);
      return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 });
    }

    // Insert phases
    const phasesToInsert = roadmap.phases.map((phase) => ({
      plan_id: plan.id,
      phase_number: phase.phase_number,
      name: phase.name,
      description: phase.description,
      start_date: phase.start_date,
      end_date: phase.end_date,
      status: phase.status,
    }));

    const { error: phasesError } = await (supabaseAdmin as any)
      .from('plan_phases')
      .insert(phasesToInsert);

    if (phasesError) {
      console.error('[API] Error creating phases:', phasesError);
      // Rollback plan
      await (supabaseAdmin as any).from('plans').delete().eq('id', plan.id);
      return NextResponse.json({ error: 'Failed to create phases' }, { status: 500 });
    }

    // Insert tasks
    const tasksToInsert = roadmap.tasks.map((task) => ({
      plan_id: plan.id,
      phase_number: task.phase_number,
      task_number: task.task_number,
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      status: task.status,
      due_date: task.due_date,
      estimated_hours: task.estimated_hours,
      blocking_dependencies: task.blocking_dependencies,
      confidence: task.confidence,
      rationale: task.rationale,
    }));

    const { error: tasksError } = await (supabaseAdmin as any)
      .from('plan_tasks')
      .insert(tasksToInsert);

    if (tasksError) {
      console.error('[API] Error creating tasks:', tasksError);
      // Rollback plan and phases
      await (supabaseAdmin as any).from('plans').delete().eq('id', plan.id);
      return NextResponse.json({ error: 'Failed to create tasks' }, { status: 500 });
    }

    // Update scenario status
    await (supabaseAdmin as any)
      .from('scenario_labs')
      .update({
        status: 'committed',
        committed_at: new Date().toISOString(),
        committed_version_id: versionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', scenarioId);

    // Audit log
    await createAuditLog({
      user_id: userId,
      action: 'scenario.committed',
      resource_type: 'scenario',
      resource_id: scenarioId,
      metadata: {
        version_id: versionId,
        plan_id: plan.id,
        phase_count: roadmap.phases.length,
        task_count: roadmap.tasks.length,
        commit_message: commitMessage,
        superseded: supersede || false,
      },
    });

    // Fetch superseded versions if any
    const { data: supersededVersions } = await (supabaseAdmin as any)
      .from('scenario_versions')
      .select('id, version_number, name, created_at')
      .eq('scenario_id', scenarioId)
      .eq('status', 'superseded')
      .order('created_at', { ascending: false });

    return NextResponse.json(
      {
        message: supersede
          ? 'Scenario committed (superseded previous)'
          : 'Scenario committed successfully',
        planId: plan.id,
        phaseCount: roadmap.phases.length,
        taskCount: roadmap.tasks.length,
        supersededVersions: supersededVersions || [],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] Error in POST /scenarios/[id]/commit:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
