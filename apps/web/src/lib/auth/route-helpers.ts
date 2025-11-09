/**
 * Route helpers for API routes
 * Includes middleware for CSRF validation and authentication
 */
import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { validateCsrfToken } from '@/lib/auth/csrf';

/**
 * Middleware to validate CSRF tokens for API routes
 * This should be used on all API routes that accept POST, PUT, DELETE methods
 */
export function withCsrfProtection(handler: Function) {
  return async (request: NextRequest) => {
    // Only check non-GET requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      // Validate CSRF token
      if (!validateCsrfToken(request)) {
        return NextResponse.json(
          { error: 'Invalid CSRF token' },
          { status: 403 }
        );
      }
    }
    
    // Call the handler function
    return handler(request);
  };
}

/**
 * Middleware to require authentication for API routes
 */
export function withAuth(handler: Function) {
  return async (request: NextRequest) => {
    // Get user ID from JWT
    const userId = await getUserIdFromJWT(request);

    // Check if user is authenticated
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Call the handler function with userId
    return handler(request, userId);
  };
}

/**
 * Combined middleware for both authentication and CSRF protection
 */
export function withAuthAndCsrf(handler: Function) {
  return withAuth(withCsrfProtection(handler));
}

/**
 * Helper to create secure API route handlers with appropriate middleware
 */
export function createSecureHandlers(handlers: Record<string, Function>) {
  const secureHandlers: Record<string, Function> = {};
  
  // Apply middleware based on HTTP method
  for (const [method, handler] of Object.entries(handlers)) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
      // For safe methods, just require authentication
      secureHandlers[method.toLowerCase()] = withAuth(handler);
    } else {
      // For methods that modify state, require both auth and CSRF
      secureHandlers[method.toLowerCase()] = withAuthAndCsrf(handler);
    }
  }
  
  return secureHandlers;
}