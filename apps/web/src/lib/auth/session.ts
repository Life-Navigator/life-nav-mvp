/**
 * Session validation utilities
 */
import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT, verifyJWT } from '@/lib/jwt';
import { jwtVerify } from 'jose';

// Types for session and user data
interface SessionUser {
  id: string;
  name?: string;
  email?: string;
  image?: string;
  setupCompleted?: boolean;
  role?: string;
  permissions?: string[];
}

interface Session {
  user: SessionUser;
  connectedProviders?: string[];
  expires: string;
}

// Last activity tracking to detect session hijacking
const userActivityMap = new Map<string, number>();

/**
 * Middleware to validate user session and extract user information
 * @param handler - The API route handler
 * @param options - Options for validation
 */
export function withAuth(
  handler: Function,
  options: {
    requiredRole?: string;
    requiredPermissions?: string[];
    requireSetupComplete?: boolean;
    allowedMethods?: string[];
  } = {}
) {
  return async (request: NextRequest, ...args: any[]) => {
    try {
      // Optional method check
      if (options.allowedMethods && options.allowedMethods.length > 0) {
        if (!options.allowedMethods.includes(request.method)) {
          return NextResponse.json(
            { error: `Method ${request.method} not allowed` },
            { status: 405 }
          );
        }
      }

      // Get user ID from JWT
      const userId = await getUserIdFromJWT(request);

      // Check if user is authenticated
      if (!userId) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      // Create a user object for compatibility
      const user = { id: userId };
      
      // JWT validation is already handled in getUserIdFromJWT
      
      // Check for session hijacking by validating last activity time
      const now = Date.now();
      const lastActivity = userActivityMap.get(user.id);
      
      if (lastActivity && now - lastActivity > 2 * 60 * 60 * 1000) { // 2 hours
        // If there's a large gap between activity, require re-authentication
        console.warn(`Suspicious activity gap for user ${user.id}`);
        return NextResponse.json(
          { error: 'Session expired, please re-authenticate', reauthRequired: true },
          { status: 401 }
        );
      }
      
      // Update last activity time
      userActivityMap.set(user.id, now);
      
      // Check if user has completed setup if needed
      if (options.requireSetupComplete !== false && 
          request.nextUrl.pathname.startsWith('/api/') && 
          !request.nextUrl.pathname.startsWith('/api/auth') && 
          !request.nextUrl.pathname.startsWith('/api/onboarding') &&
          !user.setupCompleted) {
        return NextResponse.json(
          { error: 'Account setup not completed', setupRequired: true },
          { status: 403 }
        );
      }
      
      // Check role if required
      if (options.requiredRole && user.role !== options.requiredRole) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }
      
      // Check permissions if required
      if (options.requiredPermissions && options.requiredPermissions.length > 0) {
        const hasPermissions = options.requiredPermissions.every(
          permission => user.permissions?.includes(permission)
        );
        
        if (!hasPermissions) {
          return NextResponse.json(
            { error: 'Insufficient permissions' },
            { status: 403 }
          );
        }
      }
      
      // Attach user to request
      (request as any).user = user;
      
      // Pass to the handler
      return handler(request, ...args);
    } catch (error) {
      console.error('Error validating session:', error);
      return NextResponse.json(
        { error: 'An error occurred while validating your session' },
        { status: 500 }
      );
    }
  };
}

/**
 * Get the authenticated user from a session
 * @returns User object or null if not authenticated
 */
export async function getAuthenticatedUser() {
  try {
    const userId = await getUserIdFromJWT();
    return userId ? { id: userId } : null;
  } catch (error) {
    console.error('Error getting authenticated user:', error);
    return null;
  }
}

/**
 * Check if a user is authenticated
 * @returns Boolean indicating if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const userId = await getUserIdFromJWT();
  return userId !== null;
}

/**
 * Check if a user has completed the onboarding process
 * @returns Boolean indicating if user has completed onboarding
 */
export async function hasCompletedSetup(): Promise<boolean> {
  const user = await getAuthenticatedUser();
  return user?.setupCompleted === true;
}

/**
 * Check if a user has a specific role
 * @param role The role to check for
 * @returns Boolean indicating if user has the specified role
 */
export async function hasRole(role: string): Promise<boolean> {
  const user = await getAuthenticatedUser();
  return user?.role === role;
}

/**
 * Check if a user has specific permissions
 * @param permissions Array of permissions to check
 * @returns Boolean indicating if user has all specified permissions
 */
export async function hasPermissions(permissions: string[]): Promise<boolean> {
  const user = await getAuthenticatedUser();
  
  if (!user || !user.permissions) {
    return false;
  }
  
  return permissions.every(permission => user.permissions?.includes(permission));
}

/**
 * Validate a CSRF token for the current request
 * @param request The Next.js request object
 * @returns Boolean indicating if the CSRF token is valid
 */
export async function validateCsrf(request: NextRequest): Promise<boolean> {
  try {
    const { validateCsrfToken } = await import('./csrf');
    return validateCsrfToken(request);
  } catch (error) {
    console.error('Error validating CSRF token:', error);
    return false;
  }
}