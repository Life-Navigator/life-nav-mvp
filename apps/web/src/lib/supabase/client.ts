/**
 * Supabase Client Configuration
 *
 * This client handles NON-SENSITIVE data only:
 * - User preferences and settings
 * - Goal metadata (no financial amounts)
 * - Achievements and gamification
 * - Public blob storage (avatars, images)
 *
 * HIPAA/PCI data MUST go through the DGX PostgreSQL via the FastAPI backend.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

/**
 * Create a Supabase client for browser-side operations
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a mock client in development if Supabase is not configured
    console.warn('Supabase not configured. Some features may be unavailable.');
    return null;
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

/**
 * Singleton instance for client-side usage
 */
let clientInstance: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!clientInstance) {
    clientInstance = createClient();
  }
  return clientInstance;
}
