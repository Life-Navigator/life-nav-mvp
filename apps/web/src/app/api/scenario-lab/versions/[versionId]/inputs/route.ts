/**
 * Scenario Lab - Manual Inputs Endpoint
 *
 * GET /api/scenario-lab/versions/[versionId]/inputs - Get inputs for version
 * POST /api/scenario-lab/versions/[versionId]/inputs - Add/update inputs
 * DELETE /api/scenario-lab/versions/[versionId]/inputs - Delete input
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/auth/jwt';
import { supabaseAdmin, createAuditLog } from '@/lib/scenario-lab/supabase-client';
import { createInputSchema } from '@/lib/scenario-lab/validation';

export const dynamic = 'force-dynamic';

/**
 * GET - Get all inputs for a version
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.FEATURE_SCENARIO_LAB_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 });
    }

    const { versionId } = await params;

    // Verify version ownership
    const { data: version, error: versionError } = await (supabaseAdmin as any)
      .from('scenario_versions')
      .select('id, scenario_id')
      .eq('id', versionId)
      .eq('user_id', userId)
      .single();

    if (versionError || !version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    // Fetch inputs
    const { data: inputs, error: inputsError } = await (supabaseAdmin as any)
      .from('scenario_inputs')
      .select('*')
      .eq('version_id', versionId)
      .order('created_at', { ascending: true });

    if (inputsError) {
      console.error('[API] Error fetching inputs:', inputsError);
      return NextResponse.json({ error: 'Failed to fetch inputs' }, { status: 500 });
    }

    return NextResponse.json({ inputs });
  } catch (error) {
    console.error('[API] Error in GET /versions/[versionId]/inputs:', error);
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
 * POST - Add or update inputs (batch upsert)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.FEATURE_SCENARIO_LAB_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 });
    }

    const { versionId } = await params;

    // Verify version ownership and scenario status
    const { data: version, error: versionError } = await (supabaseAdmin as any)
      .from('scenario_versions')
      .select('id, scenario_id, scenario_labs!inner(status)')
      .eq('id', versionId)
      .eq('user_id', userId)
      .single();

    if (versionError || !version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    // @ts-ignore - Supabase join typing
    if (version.scenario_labs?.status === 'committed') {
      return NextResponse.json(
        { error: 'Cannot edit inputs for committed scenario' },
        { status: 400 }
      );
    }

    // Parse and validate body
    const body = await request.json();

    // Expect array of inputs
    if (!Array.isArray(body.inputs)) {
      return NextResponse.json(
        { error: 'Expected "inputs" array in request body' },
        { status: 400 }
      );
    }

    const validatedInputs = [];
    for (const input of body.inputs) {
      const validation = createInputSchema.safeParse(input);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.errors },
          { status: 400 }
        );
      }
      validatedInputs.push(validation.data);
    }

    // Delete existing inputs for these goal_id + field_name combinations
    const deleteConditions = validatedInputs.map((input) => ({
      goal_id: input.goal_id,
      field_name: input.field_name,
    }));

    for (const condition of deleteConditions) {
      await (supabaseAdmin as any)
        .from('scenario_inputs')
        .delete()
        .eq('version_id', versionId)
        .eq('goal_id', condition.goal_id)
        .eq('field_name', condition.field_name);
    }

    // Insert new inputs
    const inputsToInsert = validatedInputs.map((input) => ({
      version_id: versionId,
      user_id: userId,
      goal_id: input.goal_id,
      field_name: input.field_name,
      field_value: input.field_value,
      field_type: input.field_type || 'text',
      source: input.source || 'manual',
      confidence: input.confidence || 1.0,
    }));

    const { data: insertedInputs, error: insertError } = await (supabaseAdmin as any)
      .from('scenario_inputs')
      .insert(inputsToInsert)
      .select();

    if (insertError) {
      console.error('[API] Error inserting inputs:', insertError);
      return NextResponse.json({ error: 'Failed to save inputs' }, { status: 500 });
    }

    // Audit log
    await createAuditLog({
      user_id: userId,
      action: 'inputs.updated',
      resource_type: 'scenario_version',
      resource_id: versionId,
      metadata: { inputs_count: insertedInputs.length },
    });

    return NextResponse.json({ inputs: insertedInputs }, { status: 201 });
  } catch (error) {
    console.error('[API] Error in POST /versions/[versionId]/inputs:', error);
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
 * DELETE - Delete specific input
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.FEATURE_SCENARIO_LAB_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 });
    }

    const { versionId } = await params;
    const { searchParams } = new URL(request.url);
    const inputId = searchParams.get('id');

    if (!inputId) {
      return NextResponse.json({ error: 'Missing input id' }, { status: 400 });
    }

    // Verify version ownership
    const { data: version, error: versionError } = await (supabaseAdmin as any)
      .from('scenario_versions')
      .select('id, scenario_labs!inner(status)')
      .eq('id', versionId)
      .eq('user_id', userId)
      .single();

    if (versionError || !version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    // @ts-ignore - Supabase join typing
    if (version.scenario_labs?.status === 'committed') {
      return NextResponse.json(
        { error: 'Cannot delete inputs for committed scenario' },
        { status: 400 }
      );
    }

    // Delete input
    const { error: deleteError } = await (supabaseAdmin as any)
      .from('scenario_inputs')
      .delete()
      .eq('id', inputId)
      .eq('version_id', versionId);

    if (deleteError) {
      console.error('[API] Error deleting input:', deleteError);
      return NextResponse.json({ error: 'Failed to delete input' }, { status: 500 });
    }

    // Audit log
    await createAuditLog({
      user_id: userId,
      action: 'input.deleted',
      resource_type: 'scenario_input',
      resource_id: inputId,
      metadata: { version_id: versionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error in DELETE /versions/[versionId]/inputs:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
