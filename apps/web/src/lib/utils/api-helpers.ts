/**
 * API helper utilities
 * 
 * Provides helper functions for API routes including response creation,
 * combining middleware, and structured error handling.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling } from './error-handling';
import { withLogging } from '@/lib/middleware/api-logging';
import { withCsrfProtection, withAuth } from '@/lib/auth/route-helpers';

/**
 * Create a success response with the given data
 */
export function createSuccessResponse(
  data: any,
  status = 200,
  headers?: Record<string, string>
): NextResponse {
  const responseHeaders = new Headers();
  
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });
  }
  
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: responseHeaders,
  });
}

/**
 * Combine multiple middleware functions
 */
export function combineMiddleware(
  handler: Function,
  middlewares: Function[]
): Function {
  return middlewares.reduceRight(
    (wrappedHandler, middleware) => middleware(wrappedHandler),
    handler
  );
}

/**
 * Create a secure API handler with authentication, CSRF protection, logging, and error handling
 */
export function createSecureHandler(handler: Function, options: {
  requireAuth?: boolean;
  requireCsrf?: boolean;
  enableLogging?: boolean;
} = {}) {
  const {
    requireAuth = true,
    requireCsrf = true,
    enableLogging = true,
  } = options;
  
  const middlewares: Function[] = [withErrorHandling];
  
  if (enableLogging) {
    middlewares.push(withLogging);
  }
  
  if (requireCsrf) {
    middlewares.push(withCsrfProtection);
  }
  
  if (requireAuth) {
    middlewares.push(withAuth);
  }
  
  return combineMiddleware(handler, middlewares);
}

/**
 * Create API handlers for different HTTP methods with appropriate middleware
 */
export function createApiHandlers(handlers: Record<string, Function>, options: {
  requireAuth?: boolean;
  requireCsrf?: boolean;
  enableLogging?: boolean;
} = {}) {
  const secureHandlers: Record<string, Function> = {};
  
  // Apply middleware based on HTTP method
  for (const [method, handler] of Object.entries(handlers)) {
    const upperMethod = method.toUpperCase();
    
    // For safe methods (GET, HEAD), skip CSRF but include other middleware
    if (['GET', 'HEAD', 'OPTIONS'].includes(upperMethod)) {
      secureHandlers[method.toLowerCase()] = createSecureHandler(handler, {
        ...options,
        requireCsrf: false, // Skip CSRF for safe methods
      });
    } else {
      // For methods that modify state, include all middleware
      secureHandlers[method.toLowerCase()] = createSecureHandler(handler, options);
    }
  }
  
  return secureHandlers;
}