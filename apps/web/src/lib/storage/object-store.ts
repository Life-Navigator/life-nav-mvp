/**
 * Cloud storage adapter — Sprint N.1 Phase 6.
 *
 * Backed by Supabase Storage. The bucket is configurable via env;
 * versioning is achieved by writing to a per-version path
 * (`<user>/<file_id>/<version_number>/<sha256>`) so two uploads of
 * the same file produce distinct objects.
 *
 * Public methods:
 *   uploadObject(...)        → ObjectRef
 *   getSignedDownloadUrl()   → URL with TTL
 *   deleteObject()           → soft-delete via storage delete
 *
 * The adapter writes the bucket + path back to ingestion.files /
 * file_versions; callers pass the columns through their own DB
 * mutator. The adapter does NOT write to DB on its own — separation
 * of concerns.
 */

export interface ObjectRef {
  bucket: string;
  path: string;
  size_bytes: number;
  sha256: string;
}

export interface StorageAdapter {
  uploadObject(args: {
    user_id: string;
    file_id: string;
    version_number: number;
    sha256: string;
    bytes: Uint8Array;
    content_type?: string;
  }): Promise<ObjectRef>;

  getSignedDownloadUrl(args: {
    bucket: string;
    path: string;
    ttl_seconds: number;
  }): Promise<string>;

  deleteObject(args: { bucket: string; path: string }): Promise<{ ok: boolean; error?: string }>;
}

// ---------------------------------------------------------------------------
// Supabase implementation
// ---------------------------------------------------------------------------

export interface SupabaseStorageOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any; // Supabase JS client (service role for upload)
  bucket?: string;
}

export class SupabaseStorageAdapter implements StorageAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly client: any;
  private readonly bucket: string;

  constructor(opts: SupabaseStorageOptions) {
    this.client = opts.client;
    this.bucket = opts.bucket ?? process.env.SUPABASE_STORAGE_BUCKET ?? 'ingestion';
  }

  async uploadObject(args: {
    user_id: string;
    file_id: string;
    version_number: number;
    sha256: string;
    bytes: Uint8Array;
    content_type?: string;
  }): Promise<ObjectRef> {
    const path = this.objectPath(args.user_id, args.file_id, args.version_number, args.sha256);
    const r = await this.client.storage.from(this.bucket).upload(path, args.bytes, {
      contentType: args.content_type ?? 'application/octet-stream',
      upsert: false,
    });
    if (r.error) throw new Error(`storage_upload_failed: ${r.error.message}`);
    return { bucket: this.bucket, path, size_bytes: args.bytes.length, sha256: args.sha256 };
  }

  async getSignedDownloadUrl(args: {
    bucket: string;
    path: string;
    ttl_seconds: number;
  }): Promise<string> {
    const r = await this.client.storage
      .from(args.bucket)
      .createSignedUrl(args.path, args.ttl_seconds);
    if (r.error) throw new Error(`signed_url_failed: ${r.error.message}`);
    return r.data?.signedUrl as string;
  }

  async deleteObject(args: {
    bucket: string;
    path: string;
  }): Promise<{ ok: boolean; error?: string }> {
    const r = await this.client.storage.from(args.bucket).remove([args.path]);
    if (r.error) return { ok: false, error: r.error.message };
    return { ok: true };
  }

  private objectPath(user_id: string, file_id: string, version: number, sha256: string): string {
    return `${user_id}/${file_id}/${version}/${sha256}`;
  }
}

export const __test = { SupabaseStorageAdapter };
