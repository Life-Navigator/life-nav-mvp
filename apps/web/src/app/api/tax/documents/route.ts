/**
 * GET /api/tax/documents?year= — tax documents on file for the year.
 *
 * Tax documents are sourced from the Document Intelligence platform (`documents`
 * schema) when available. We do not fabricate documents; an empty list is the
 * honest state until the user uploads W-2/1099/etc. The summary reports counts so
 * the UI can prompt for what's outstanding.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const CURRENT_YEAR = 2026;

const TAX_DOC_KEYWORDS = ['w2', 'w-2', '1099', '1098', 'k1', 'k-1', 'tax'];

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const year = Number(new URL(req.url).searchParams.get('year')) || CURRENT_YEAR;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Best-effort: pull tax-related docs from the Document Intelligence platform.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let documents: any[] = [];
  try {
    const { data } = await sb
      .schema('documents')
      .from('documents')
      .select('*')
      .eq('user_id', user.id);
    documents = (data || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((d: any) => {
        const hay = `${d.doc_type || ''} ${d.title || d.file_name || ''}`.toLowerCase();
        return TAX_DOC_KEYWORDS.some((k) => hay.includes(k));
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((d: any) => ({
        id: d.id,
        type: d.doc_type || 'other',
        year,
        issuerName: d.issuer || d.title || d.file_name || 'Document',
        status: 'received',
        fileName: d.file_name,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      }));
  } catch {
    documents = [];
  }

  return NextResponse.json({
    documents,
    summary: {
      total: documents.length,
      pending: 0,
      received: documents.length,
      missingTypes: [],
    },
  });
}
