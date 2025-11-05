/**
 * CORS Configuration
 * 
 * This module defines the Cross-Origin Resource Sharing (CORS) configuration
 * for the LifeNavigator application.
 */
import { NextRequest, NextResponse } from 'next/server';

// Define allowed origins based on environment
export function getAllowedOrigins(): string[] {
  const env = process.env.APP_ENV || 'local';
  
  const origins = {
    local: [
      'http://localhost:3000',
      'http://localhost:8000',
      'http://localhost:8001',
      'http://127.0.0.1:3000',
    ],
    dev: [
      'https://dev.lifenavigator.example',
      'https://api-dev.lifenavigator.example',
      'https://admin-dev.lifenavigator.example',
    ],
    staging: [
      'https://staging.lifenavigator.example',
      'https://api-staging.lifenavigator.example',
      'https://admin-staging.lifenavigator.example',
    ],
    prod: [
      'https://lifenavigator.example',
      'https://api.lifenavigator.example',
      'https://admin.lifenavigator.example',
      'https://dashboard.lifenavigator.example',
    ],
  };
  
  // Add custom origins from environment variable if defined
  const customOrigins = process.env.CORS_ALLOWED_ORIGINS;
  
  if (customOrigins) {
    return [...(origins[env as keyof typeof origins] || []), ...customOrigins.split(',')];
  }
  
  return origins[env as keyof typeof origins] || [];
}

// CORS configuration options
export interface CorsOptions {
  allowedOrigins?: string[] | '*';
  allowedMethods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
  credentials?: boolean;
  strictOriginCheck?: boolean;
}

// Default CORS options
export const defaultCorsOptions: CorsOptions = {
  allowedOrigins: getAllowedOrigins(),
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token',
    'X-Requested-With',
    'Accept',
    'X-Request-ID',
    'X-Service-Name',
    'X-Timestamp',
    'X-Signature',
    'X-API-Key',
  ],
  exposedHeaders: ['Content-Length', 'X-Request-ID'],
  maxAge: 86400, // 24 hours
  credentials: true,
  strictOriginCheck: true,
};

// CORS configuration for public API endpoints (less strict)
export const publicApiCorsOptions: CorsOptions = {
  ...defaultCorsOptions,
  allowedOrigins: '*', // Allow any origin
  credentials: false, // Don't allow credentials for public APIs
  strictOriginCheck: false, // Less strict for public APIs
};

// CORS configuration for admin endpoints (more strict)
export const adminCorsOptions: CorsOptions = {
  ...defaultCorsOptions,
  allowedOrigins: process.env.ADMIN_ALLOWED_ORIGINS?.split(',') || ['https://admin.lifenavigator.example'],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  maxAge: 3600, // 1 hour
  strictOriginCheck: true, // Strict checking for admin endpoints
};

/**
 * Apply CORS headers to a response
 * 
 * @param response The NextResponse object
 * @param request The original request
 * @param options CORS configuration options
 * @returns The modified response with CORS headers
 */
export function applyCorsHeaders(
  response: NextResponse,
  request: NextRequest,
  options: CorsOptions = defaultCorsOptions
): NextResponse {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = options.allowedOrigins || [];
  
  // Check if the origin is allowed
  const isAllowedOrigin = 
    allowedOrigins === '*' ||
    (Array.isArray(allowedOrigins) && (
      allowedOrigins.includes(origin) ||
      allowedOrigins.includes('*')
    ));
  
  // Set Access-Control-Allow-Origin
  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', 
      options.strictOriginCheck ? origin : (Array.isArray(allowedOrigins) ? '*' : allowedOrigins as string)
    );
  } else if (options.strictOriginCheck) {
    // For strict checking, don't set the header if origin is not allowed
  } else {
    response.headers.set('Access-Control-Allow-Origin', '*');
  }
  
  // Set other CORS headers
  if (options.credentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  // Only set these headers for OPTIONS requests (preflight)
  if (request.method === 'OPTIONS') {
    if (options.allowedMethods) {
      response.headers.set('Access-Control-Allow-Methods', options.allowedMethods.join(', '));
    }
    
    if (options.allowedHeaders) {
      response.headers.set('Access-Control-Allow-Headers', options.allowedHeaders.join(', '));
    }
    
    if (options.maxAge) {
      response.headers.set('Access-Control-Max-Age', options.maxAge.toString());
    }
  }
  
  // Always set exposed headers
  if (options.exposedHeaders) {
    response.headers.set('Access-Control-Expose-Headers', options.exposedHeaders.join(', '));
  }
  
  return response;
}

/**
 * Create a CORS middleware function
 * 
 * @param options CORS configuration options
 * @returns A middleware function
 */
export function withCors(options: CorsOptions = defaultCorsOptions) {
  return function corsMiddleware(
    handler: (request: NextRequest) => Promise<NextResponse> | NextResponse
  ) {
    return async function(request: NextRequest) {
      // Handle preflight requests
      if (request.method === 'OPTIONS') {
        const response = new NextResponse(null, { status: 204 });
        return applyCorsHeaders(response, request, options);
      }
      
      // Process the request
      const response = await handler(request);
      
      // Apply CORS headers to the response
      return applyCorsHeaders(response, request, options);
    };
  };
}