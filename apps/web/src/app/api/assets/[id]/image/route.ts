/**
 * POST /api/assets/[id]/image — attach/replace a picture of an asset.
 *
 * Stores the file in the private `documents` bucket and saves the storage PATH in
 * finance.assets.image_url. Returns a short-lived signed URL for immediate display.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `assets/${user.id}/${id}/photo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(path, file, { upsert: true });
    if (uploadError) return safeApiError({ code: 'validation_failed', internal: uploadError });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { error: updErr } = await sb
      .schema('finance')
      .from('assets')
      .update({ image_url: path })
      .eq('id', id)
      .eq('user_id', user.id);
    if (updErr) return safeApiError({ code: 'db_persistence_error', internal: updErr });

    const { data: signed } = await supabase.storage
      .from('documents')
      .createSignedUrl(path, 60 * 60);
    return NextResponse.json({ imageUrl: signed?.signedUrl ?? null, path });
  } catch (err) {
    return safeApiError({ code: 'internal_error', internal: err });
  }
}
