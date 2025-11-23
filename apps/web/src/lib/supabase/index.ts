/**
 * Supabase Client Exports
 *
 * Usage:
 * - Browser: import { getSupabaseClient } from '@/lib/supabase'
 * - Server: import { createServerSupabaseClient } from '@/lib/supabase/server'
 */

export { createClient, getSupabaseClient } from './client';
export type {
  Database,
  Profile,
  Goal,
  Achievement,
  UserAchievement,
  UserProgress,
  UserPreferences,
  UserNotification,
  Feedback,
} from './types';
