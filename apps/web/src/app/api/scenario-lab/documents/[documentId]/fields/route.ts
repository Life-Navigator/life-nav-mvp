/**
 * Scenario Lab - Extracted Fields Endpoint
 *
 * GET /api/scenario-lab/documents/[documentId]/fields
 * Returns extracted fields grouped by category
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { supabaseAdmin } from '@/lib/scenario-lab/supabase-client';

export const dynamic = 'force-dynamic';

// Field categorization for better UX
const FIELD_CATEGORIES: Record<string, string[]> = {
  'Education': ['tuition', 'fees', 'scholarship', 'grant', 'student_loan', 'graduation_date', 'enrollment_date'],
  'Career': ['salary', 'hourly_wage', 'bonus', 'commission', 'start_date', 'annual_income'],
  'Housing': ['rent', 'mortgage', 'property_tax', 'hoa_fee', 'insurance_home', 'utilities'],
  'Debt': ['loan_principal', 'loan_balance', 'apr', 'interest_rate', 'monthly_payment', 'term_months', 'payoff_date'],
  'Insurance': ['premium', 'deductible', 'coverage_amount', 'policy_number'],
  'Budget': ['monthly_expense', 'annual_expense', 'emergency_fund', 'savings'],
};

function categorizeField(fieldKey: string): string {
  const lowerKey = fieldKey.toLowerCase();

  for (const [category, keywords] of Object.entries(FIELD_CATEGORIES)) {
    if (keywords.some(keyword => lowerKey.includes(keyword))) {
      return category;
    }
  }

  return 'Other';
}

export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.FEATURE_SCENARIO_LAB_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 });
    }

    const documentId = params.documentId;

    // Verify document ownership
    const { data: document, error: docError } = await supabaseAdmin
      .from('scenario_documents')
      .select('id, ocr_status')
      .eq('id', documentId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check OCR status
    if (document.ocr_status === 'pending' || document.ocr_status === 'queued' || document.ocr_status === 'processing') {
      return NextResponse.json({
        status: document.ocr_status,
        message: 'OCR is still processing. Please wait.',
        groups: [],
      });
    }

    if (document.ocr_status === 'failed') {
      return NextResponse.json({
        status: 'failed',
        message: 'OCR extraction failed. Please try again or upload a different document.',
        groups: [],
      });
    }

    // Fetch extracted fields
    const { data: fields, error: fieldsError } = await supabaseAdmin
      .from('scenario_extracted_fields')
      .select('*')
      .eq('document_id', documentId)
      .order('field_key', { ascending: true });

    if (fieldsError) {
      console.error('[API] Error fetching extracted fields:', fieldsError);
      return NextResponse.json({ error: 'Failed to fetch fields' }, { status: 500 });
    }

    if (!fields || fields.length === 0) {
      return NextResponse.json({
        status: 'completed',
        message: 'No fields were extracted from this document.',
        groups: [],
      });
    }

    // Group fields by category
    const groupedFields: Record<string, any[]> = {};

    for (const field of fields) {
      const category = categorizeField(field.field_key);

      if (!groupedFields[category]) {
        groupedFields[category] = [];
      }

      groupedFields[category].push({
        id: field.id,
        field_key: field.field_key,
        field_value: field.field_value,
        field_type: field.field_type,
        confidence_score: field.confidence_score,
        extraction_method: field.extraction_method,
        source_page: field.source_page,
        source_text: field.source_text,
        was_redacted: field.was_redacted,
        redaction_reason: field.redaction_reason,
        approval_status: field.approval_status,
        created_at: field.created_at,
      });
    }

    // Convert to array format
    const groups = Object.entries(groupedFields).map(([category, categoryFields]) => ({
      category,
      fields: categoryFields,
    }));

    // Sort categories (Education, Career, Housing, Debt, Insurance, Budget, Other)
    const categoryOrder = ['Education', 'Career', 'Housing', 'Debt', 'Insurance', 'Budget', 'Other'];
    groups.sort((a, b) => {
      const indexA = categoryOrder.indexOf(a.category);
      const indexB = categoryOrder.indexOf(b.category);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

    return NextResponse.json({
      status: 'completed',
      total_fields: fields.length,
      groups,
    });
  } catch (error) {
    console.error('[API] Error in GET /documents/[documentId]/fields:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
