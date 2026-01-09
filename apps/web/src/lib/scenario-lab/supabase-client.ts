/**
 * Scenario Lab - Supabase Client Utilities
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * Service role client - bypasses RLS, use with caution
 * Only use for server-side operations that require admin access
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Standard client - enforces RLS
 * Use for user-scoped operations
 */
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

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

  await supabaseAdmin
    .from('scenario_audit_log')
    .insert({
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

  const { data, error } = await supabaseAdmin
    .storage
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

  const { data, error } = await supabaseAdmin
    .storage
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

  const { error } = await supabaseAdmin
    .storage
    .from(bucket)
    .upload(path, file, {
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

  const { error } = await supabaseAdmin
    .storage
    .from(bucket)
    .remove([path]);

  if (error) throw error;
}
