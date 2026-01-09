/**
 * User Synchronization Service
 *
 * Orchestrates user creation and synchronization across:
 * - Supabase (auth + profiles)
 * - Prisma (frontend database)
 * - Backend Cloud SQL (API database)
 *
 * Ensures seamless UX by maintaining consistent user records across all databases.
 */

import { createBrowserClient } from '@supabase/ssr';
import { db as prisma } from '@/lib/db';
import { hashPassword } from '@/lib/utils/password';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
  displayName?: string;
  userType?: 'civilian' | 'military' | 'veteran';
  timezone?: string;
  locale?: string;
}

export interface SyncedUser {
  supabaseId: string;
  prismaId: string;
  backendId: string;
  tenantId: string;
  organizationId: string;
  email: string;
  displayName?: string;
}

export interface BackendSyncResponse {
  success: boolean;
  backend_user_id: string;
  tenant_id: string;
  organization_id: string;
  message: string;
}

export interface BackendLookupResponse {
  exists: boolean;
  backend_user_id?: string;
  tenant_id?: string;
  organization_id?: string;
  email?: string;
  display_name?: string;
  pilot_role?: string;
  pilot_enabled?: boolean;
}

/**
 * Sync a user to the backend database.
 * Called after Supabase auth signup.
 */
async function syncToBackend(
  supabaseUserId: string,
  email: string,
  options?: {
    displayName?: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    authProvider?: string;
    userType?: string;
    timezone?: string;
    locale?: string;
    accessToken?: string;
  }
): Promise<BackendSyncResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options?.accessToken) {
    headers['Authorization'] = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(`${BACKEND_URL}/api/v1/user-sync/sync`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      supabase_user_id: supabaseUserId,
      email,
      display_name: options?.displayName,
      first_name: options?.firstName,
      last_name: options?.lastName,
      avatar_url: options?.avatarUrl,
      auth_provider: options?.authProvider || 'EMAIL',
      user_type: options?.userType || 'CIVILIAN',
      timezone: options?.timezone || 'America/New_York',
      locale: options?.locale || 'en-US',
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Backend sync failed' }));
    throw new Error(error.detail || error.error || 'Failed to sync user to backend');
  }

  return response.json();
}

/**
 * Look up a user in the backend by Supabase ID.
 */
export async function lookupBackendUser(
  supabaseUserId: string,
  accessToken?: string
): Promise<BackendLookupResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(
    `${BACKEND_URL}/api/v1/user-sync/lookup/${supabaseUserId}`,
    { headers }
  );

  if (!response.ok) {
    return { exists: false };
  }

  return response.json();
}

/**
 * Look up a user in the backend by email.
 */
export async function lookupBackendUserByEmail(
  email: string,
  accessToken?: string
): Promise<BackendLookupResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(
    `${BACKEND_URL}/api/v1/user-sync/lookup/email/${encodeURIComponent(email)}`,
    { headers }
  );

  if (!response.ok) {
    return { exists: false };
  }

  return response.json();
}

/**
 * Create a user in the Prisma database.
 */
async function createPrismaUser(
  email: string,
  password: string,
  options?: {
    name?: string;
    pilotRole?: string;
    userType?: string;
  }
): Promise<string> {
  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: options?.name,
      pilotRole: options?.pilotRole || 'waitlist',
      userType: options?.userType || 'civilian',
    },
  });

  // Create default settings
  await prisma.userSettings.create({
    data: {
      userId: user.id,
    },
  });

  return user.id;
}

/**
 * Full user registration with cross-database synchronization.
 *
 * This creates users in all three databases:
 * 1. Supabase (auth + profile via trigger)
 * 2. Prisma (frontend database)
 * 3. Backend Cloud SQL (API database)
 */
export async function registerUserWithSync(
  input: CreateUserInput
): Promise<SyncedUser> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Step 1: Create user in Supabase
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        display_name: input.displayName || input.name || input.email.split('@')[0],
        user_type: input.userType || 'civilian',
      },
    },
  });

  if (authError || !authData.user) {
    throw new Error(authError?.message || 'Failed to create Supabase user');
  }

  const supabaseUserId = authData.user.id;
  const accessToken = authData.session?.access_token;

  try {
    // Step 2: Create user in Prisma (in parallel with backend sync)
    const [prismaUserId, backendResponse] = await Promise.all([
      createPrismaUser(input.email, input.password, {
        name: input.name,
        userType: input.userType,
      }),
      syncToBackend(supabaseUserId, input.email, {
        displayName: input.displayName || input.name,
        authProvider: 'EMAIL',
        userType: input.userType?.toUpperCase(),
        timezone: input.timezone,
        locale: input.locale,
        accessToken,
      }),
    ]);

    // Step 3: Update Supabase profile with backend IDs
    await supabase
      .from('profiles')
      .update({
        dgx_user_id: backendResponse.backend_user_id,
      })
      .eq('id', supabaseUserId);

    return {
      supabaseId: supabaseUserId,
      prismaId: prismaUserId,
      backendId: backendResponse.backend_user_id,
      tenantId: backendResponse.tenant_id,
      organizationId: backendResponse.organization_id,
      email: input.email,
      displayName: input.displayName || input.name,
    };
  } catch (error) {
    // Rollback: Delete Supabase user if other creations fail
    // Note: This requires admin privileges, may need to be handled differently
    console.error('User sync failed, rollback may be needed:', error);
    throw error;
  }
}

/**
 * Ensure a user is synced across all databases.
 * Call this during login to ensure consistency.
 */
export async function ensureUserSync(
  supabaseUserId: string,
  email: string,
  accessToken?: string
): Promise<{
  synced: boolean;
  backendId?: string;
  tenantId?: string;
}> {
  // Check if user exists in backend
  const lookup = await lookupBackendUser(supabaseUserId, accessToken);

  if (lookup.exists && lookup.backend_user_id) {
    return {
      synced: true,
      backendId: lookup.backend_user_id,
      tenantId: lookup.tenant_id,
    };
  }

  // User doesn't exist in backend, sync them
  try {
    const syncResponse = await syncToBackend(supabaseUserId, email, {
      accessToken,
    });

    return {
      synced: true,
      backendId: syncResponse.backend_user_id,
      tenantId: syncResponse.tenant_id,
    };
  } catch (error) {
    console.error('Failed to sync user during login:', error);
    return { synced: false };
  }
}

/**
 * Get the backend user ID for making API calls.
 * Caches the result in session storage for performance.
 */
export async function getBackendUserId(
  supabaseUserId: string,
  accessToken?: string
): Promise<string | null> {
  // Check cache first
  if (typeof window !== 'undefined') {
    const cached = sessionStorage.getItem(`backend_user_id_${supabaseUserId}`);
    if (cached) {
      return cached;
    }
  }

  const lookup = await lookupBackendUser(supabaseUserId, accessToken);

  if (lookup.exists && lookup.backend_user_id) {
    // Cache the result
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(
        `backend_user_id_${supabaseUserId}`,
        lookup.backend_user_id
      );
    }
    return lookup.backend_user_id;
  }

  return null;
}

/**
 * Get the tenant ID for the current user.
 */
export async function getTenantId(
  supabaseUserId: string,
  accessToken?: string
): Promise<string | null> {
  // Check cache first
  if (typeof window !== 'undefined') {
    const cached = sessionStorage.getItem(`tenant_id_${supabaseUserId}`);
    if (cached) {
      return cached;
    }
  }

  const lookup = await lookupBackendUser(supabaseUserId, accessToken);

  if (lookup.exists && lookup.tenant_id) {
    // Cache the result
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`tenant_id_${supabaseUserId}`, lookup.tenant_id);
    }
    return lookup.tenant_id;
  }

  return null;
}

export const userSyncService = {
  registerUserWithSync,
  ensureUserSync,
  lookupBackendUser,
  lookupBackendUserByEmail,
  getBackendUserId,
  getTenantId,
};
