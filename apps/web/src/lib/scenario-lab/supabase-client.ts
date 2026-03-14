/**
 * Scenario Lab - Supabase Client Utilities
 */

import { createClient } from '@supabase/supabase-js';

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing Supabase environment variables');
  }
  return { url, anonKey, serviceKey: serviceKey || anonKey };
}

let _admin: ReturnType<typeof createClient> | null = null;
let _client: ReturnType<typeof createClient> | null = null;

/**
 * Service role client - bypasses RLS, use with caution
 */
export function getSupabaseAdmin() {
  if (!_admin) {
    const { url, serviceKey } = getEnv();
    _admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _admin;
}

// Lazy getter for backward compatibility
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient>, {
  get(_, prop) {
    return (getSupabaseAdmin() as any)[prop];
  },
});

/**
 * Standard client - enforces RLS
 */
export const supabaseClient = new Proxy({} as ReturnType<typeof createClient>, {
  get(_, prop) {
    if (!_client) {
      const { url, anonKey } = getEnv();
      _client = createClient(url, anonKey);
    }
    return (_client as any)[prop];
  },
});

/**
 * Get Supabase client for server-side operations with user context
 * This enforces RLS based on the user's auth token
 */
export function getSupabaseServerClient() {
  // In a real implementation, this would extract the user's session
  // from Next.js cookies and create a client with that session
  // For now, return standard client
  return supabaseClient;
}

/**
 * Audit log helper - records all user actions
 */
export async function createAuditLog(params: {
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  changes?: any;
  metadata?: any;
}) {
  const { user_id, action, resource_type, resource_id, changes, metadata } = params;

  await (supabaseAdmin as any).from('scenario_audit_log').insert({
    user_id,
    action,
    resource_type,
    resource_id,
    changes,
    metadata,
  });
}

/**
 * Get signed upload URL for documents
 */
export async function getUploadUrl(params: {
  bucket: 'scenario-docs' | 'scenario-reports';
  path: string;
  expiresIn?: number;
}): Promise<string> {
  const { bucket, path, expiresIn = 3600 } = params;

  const { data, error } = await (supabaseAdmin as any).storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error) throw error;
  return data.signedUrl;
}

/**
 * Get signed download URL for documents/reports
 */
export async function getDownloadUrl(params: {
  bucket: 'scenario-docs' | 'scenario-reports';
  path: string;
  expiresIn?: number;
}): Promise<string> {
  const { bucket, path, expiresIn = 3600 } = params;

  const { data, error } = await (supabaseAdmin as any).storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}

/**
 * Upload file to storage
 */
export async function uploadFile(params: {
  bucket: 'scenario-docs' | 'scenario-reports';
  path: string;
  file: Buffer;
  contentType: string;
}): Promise<void> {
  const { bucket, path, file, contentType } = params;

  const { error } = await (supabaseAdmin as any).storage.from(bucket).upload(path, file, {
    contentType,
    upsert: false,
  });

  if (error) throw error;
}

/**
 * Delete file from storage
 */
export async function deleteFile(params: {
  bucket: 'scenario-docs' | 'scenario-reports';
  path: string;
}): Promise<void> {
  const { bucket, path } = params;

  const { error } = await (supabaseAdmin as any).storage.from(bucket).remove([path]);

  if (error) throw error;
}
