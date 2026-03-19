import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  uploadToStorage,
  createDocumentRecord,
  extractAndMapFields,
  validateUpload,
} from '@/lib/services/documentService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
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

    const validation = validateUpload({ size: file.size, type: file.type, name: file.name });
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join('. ') }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const { path } = await uploadToStorage(
      supabase,
      user.id,
      buffer,
      file.name,
      file.type,
      'career'
    );

    const docCategory = file.name.toLowerCase().includes('cert')
      ? ('certificate' as const)
      : ('resume' as const);
    const doc = await createDocumentRecord(supabase, user.id, {
      document_type: docCategory,
      storage_path: path,
      name: file.name,
      file_size_bytes: file.size,
      mime_type: file.type,
      tags: ['career'],
    });

    let processedData: Record<string, unknown> | null = null;
    if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
      processedData = await extractAndMapFields(buffer, file.type);
    }

    return NextResponse.json({
      success: true,
      fileId: doc.id,
      fileUrl: path,
      processedData,
      message: processedData
        ? 'File uploaded and fields extracted for review'
        : 'File uploaded successfully',
    });
  } catch (err) {
    console.error('Career upload error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
