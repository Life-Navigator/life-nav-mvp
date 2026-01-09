/**
 * Scenario Lab - Task Update Endpoint
 *
 * PATCH /api/scenario-lab/plans/[planId]/tasks/[taskId]
 * Updates task properties (status, due_date, notes, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { supabaseAdmin, createAuditLog } from '@/lib/scenario-lab/supabase-client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateTaskSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'done', 'blocked']).optional(),
  due_date: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  actual_hours: z.number().min(0).optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { planId: string; taskId: string } }
) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.FEATURE_SCENARIO_LAB_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 });
    }

    const { planId, taskId } = params;

    // Verify plan ownership
    const { data: plan, error: planError } = await supabaseAdmin
      .from('plans')
      .select('id, user_id, scenario_version_id')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    if (plan.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify task belongs to plan
    const { data: task, error: taskError } = await supabaseAdmin
      .from('plan_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('plan_id', planId)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Parse and validate body
    const body = await request.json();
    const validation = updateTaskSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const updates = validation.data;

    // Track changes for audit log
    const changes: Record<string, any> = {};
    if (updates.status !== undefined && updates.status !== task.status) {
      changes.status = { from: task.status, to: updates.status };
    }
    if (updates.due_date !== undefined && updates.due_date !== task.due_date) {
      changes.due_date = { from: task.due_date, to: updates.due_date };
    }
    if (updates.notes !== undefined && updates.notes !== task.notes) {
      changes.notes = { from: task.notes ? 'updated' : 'added', to: 'new' };
    }

    // Update task
    const { data: updatedTask, error: updateError } = await supabaseAdmin
      .from('plan_tasks')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select()
      .single();

    if (updateError) {
      console.error('[API] Error updating task:', updateError);
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }

    // Audit log
    if (Object.keys(changes).length > 0) {
      await createAuditLog({
        user_id: userId,
        action: 'task.updated',
        resource_type: 'plan_task',
        resource_id: taskId,
        changes,
        metadata: { plan_id: planId, task_title: task.title },
      });
    }

    return NextResponse.json({
      task: updatedTask,
    });
  } catch (error) {
    console.error('[API] Error in PATCH /plans/[planId]/tasks/[taskId]:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
