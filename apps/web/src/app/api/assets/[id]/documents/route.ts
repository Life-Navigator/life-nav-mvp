/**
 * GET  /api/assets/[id]/documents — list documents attached to an asset (signed URLs).
 * POST /api/assets/[id]/documents — attach a document (deed, title, statement…).
 *
 * Files are stored in the private `documents` bucket; rows in finance.asset_documents
 * (migration 161) link them to the asset. RLS-scoped (auth.uid() = user_id).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .schema('finance')
    .from('asset_documents')
    .select('*')
    .eq('user_id', user.id)
    .eq('asset_id', id)
    .order('created_at', { ascending: false });
  if (error) return safeApiError({ code: 'db_persistence_error', internal: error });

  const documents = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data || []).map(async (d: any) => {
      let url: string | null = null;
      if (d.file_path) {
        const { data: signed } = await supabase.storage
          .from('documents')
          .createSignedUrl(d.file_path, 60 * 60);
        url = signed?.signedUrl ?? null;
      }
      return {
        id: d.id,
        assetId: d.asset_id,
        fileName: d.file_name,
        docType: d.doc_type,
        documentId: d.document_id,
        url,
        createdAt: d.created_at,
      };
    })
  );
  return NextResponse.json({ documents });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `assets/${user.id}/${id}/docs/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(path, file, { upsert: false });
    if (uploadError) return safeApiError({ code: 'validation_failed', internal: uploadError });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data, error } = await sb
      .schema('finance')
      .from('asset_documents')
      .insert({
        asset_id: id,
        user_id: user.id,
        file_path: path,
        file_name: file.name,
        doc_type: file.type || null,
      })
      .select('*')
      .single();
    if (error) return safeApiError({ code: 'db_persistence_error', internal: error });

    return NextResponse.json({
      document: { id: data.id, assetId: data.asset_id, fileName: data.file_name },
    });
  } catch (err) {
    return safeApiError({ code: 'internal_error', internal: err });
  }
}
