/**
 * Scenario Lab - Field Approval Endpoint
 *
 * POST /api/scenario-lab/versions/[versionId]/fields/approve
 * Approves extracted fields and writes them to scenario_inputs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { supabaseAdmin, createAuditLog } from '@/lib/scenario-lab/supabase-client';
import { approveFieldsSchema } from '@/lib/scenario-lab/validation';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { versionId: string } }
) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.FEATURE_SCENARIO_LAB_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 });
    }

    const versionId = params.versionId;

    // Verify version ownership and scenario status
    const { data: version, error: versionError } = await supabaseAdmin
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
        { error: 'Cannot approve fields for committed scenario. Fork the scenario first.' },
        { status: 400 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const validation = approveFieldsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { fields } = validation.data;

    // Fetch all extracted fields to verify
    const extractedFieldIds = fields.map(f => f.extracted_field_id);
    const { data: extractedFields, error: fetchError } = await supabaseAdmin
      .from('scenario_extracted_fields')
      .select('*')
      .in('id', extractedFieldIds);

    if (fetchError || !extractedFields) {
      console.error('[API] Error fetching extracted fields:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch extracted fields' }, { status: 500 });
    }

    // Verify all fields belong to user
    const invalidFields = extractedFields.filter(f => f.user_id !== userId);
    if (invalidFields.length > 0) {
      return NextResponse.json({ error: 'Unauthorized field access' }, { status: 403 });
    }

    // Prepare inputs to upsert
    const inputsToCreate = fields.map(approval => {
      const extractedField = extractedFields.find(f => f.id === approval.extracted_field_id);
      if (!extractedField) {
        throw new Error(`Extracted field ${approval.extracted_field_id} not found`);
      }

      // Use approved_value if edited, otherwise use original field_value
      const finalValue = approval.approved_value || extractedField.field_value;

      return {
        version_id: versionId,
        user_id: userId,
        goal_id: approval.goal_id,
        field_name: approval.field_name,
        field_value: finalValue,
        field_type: extractedField.field_type,
        source: 'extracted' as const,
        confidence: extractedField.confidence_score,
      };
    });

    // Delete existing inputs for these goal_id + field_name combinations (upsert pattern)
    for (const input of inputsToCreate) {
      await supabaseAdmin
        .from('scenario_inputs')
        .delete()
        .eq('version_id', versionId)
        .eq('goal_id', input.goal_id)
        .eq('field_name', input.field_name);
    }

    // Insert new inputs
    const { data: createdInputs, error: insertError } = await supabaseAdmin
      .from('scenario_inputs')
      .insert(inputsToCreate)
      .select();

    if (insertError) {
      console.error('[API] Error inserting inputs:', insertError);
      return NextResponse.json({ error: 'Failed to approve fields' }, { status: 500 });
    }

    // Update extracted fields approval status
    const { error: updateError } = await supabaseAdmin
      .from('scenario_extracted_fields')
      .update({
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .in('id', extractedFieldIds);

    if (updateError) {
      console.error('[API] Error updating field statuses:', updateError);
      // Non-fatal, continue
    }

    // Audit log
    await createAuditLog({
      user_id: userId,
      action: 'fields.approved',
      resource_type: 'scenario_version',
      resource_id: versionId,
      metadata: {
        fields_count: fields.length,
        field_ids: extractedFieldIds,
      },
    });

    return NextResponse.json({
      success: true,
      inputs_created: createdInputs?.length || 0,
      message: `${createdInputs?.length || 0} fields approved and added to scenario inputs.`,
    }, { status: 201 });
  } catch (error) {
    console.error('[API] Error in POST /versions/[versionId]/fields/approve:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
