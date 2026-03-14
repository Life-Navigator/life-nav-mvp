type SB = any;

export type DocumentCategory =
  | 'resume'
  | 'certificate'
  | 'transcript'
  | 'statement'
  | 'tax_form'
  | 'other';

export interface UploadResult {
  success: boolean;
  fileId?: string;
  fileUrl?: string;
  processedData?: Record<string, unknown>;
  message?: string;
}

export async function uploadToStorage(
  supabase: SB,
  userId: string,
  file: Buffer,
  fileName: string,
  mimeType: string,
  domain: string
): Promise<{ path: string }> {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${userId}/${domain}/${Date.now()}_${safeName}`;

  const { error } = await supabase.storage.from('documents').upload(storagePath, file, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) throw error;
  return { path: storagePath };
}

export async function createDocumentRecord(
  supabase: SB,
  userId: string,
  doc: {
    category: DocumentCategory;
    storage_path: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }
) {
  const { data, error } = await supabase
    .from('documents')
    .insert({
      user_id: userId,
      category: doc.category,
      storage_path: doc.storage_path,
      file_name: doc.file_name,
      file_size: doc.file_size,
      mime_type: doc.mime_type,
      tags: doc.tags || [],
      metadata: doc.metadata || {},
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function extractAndMapFields(
  fileBuffer: Buffer,
  mimeType: string
): Promise<Record<string, unknown> | null> {
  try {
    const { extractDocumentFields } = await import('@/lib/scenario-lab/ocr/extractor');
    const result = await extractDocumentFields(fileBuffer, mimeType);

    if (!result.success || result.extracted_fields.length === 0) {
      return null;
    }

    const mapped: Record<string, unknown> = {};
    for (const field of result.extracted_fields) {
      mapped[field.field_key] = field.field_value;
    }
    return mapped;
  } catch {
    return null;
  }
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB — matches Supabase bucket config

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
]);

export function validateUpload(file: { size: number; type: string; name: string }) {
  const errors: string[] = [];

  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    errors.push(`Unsupported file type: ${file.type}`);
  }

  return { valid: errors.length === 0, errors };
}
