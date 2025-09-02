/**
 * CSRF protection utilities
 */
import { randomBytes, createHash } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

// Constants
const CSRF_SECRET_COOKIE = '__Host-csrf-secret';
const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_TOKEN_FORM_FIELD = '_csrf';
const CSRF_COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  path: '/',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 // 1 hour
};

/**
 * Generate a CSRF token
 * Uses a double submit cookie pattern with a secret
 */
export async function generateCsrfToken(): Promise<string> {
  // Generate a random secret
  const secret = randomBytes(32).toString('hex');
  
  // Get the cookies instance - await it in Next.js 15
  const cookieStore = await cookies();
  
  // Set the secret in a secure cookie
  cookieStore.set(CSRF_SECRET_COOKIE, secret, CSRF_COOKIE_OPTS);
  
  // Generate a token based on the secret
  return createCsrfToken(secret);
}

/**
 * Create a CSRF token using the provided secret
 */
function createCsrfToken(secret: string): string {
  // Current timestamp to prevent reuse
  const timestamp = Date.now().toString();
  
  // Create token by hashing the secret with the timestamp
  const token = createHash('sha256')
    .update(`${secret}${timestamp}`)
    .digest('hex');
  
  // Return token:timestamp
  return `${token}:${timestamp}`;
}

/**
 * Validate a CSRF token from a request
 */
export function validateCsrfToken(request: NextRequest): boolean {
  try {
    // Get the CSRF secret from cookies
    const csrfCookie = request.cookies.get(CSRF_SECRET_COOKIE);
    if (!csrfCookie?.value) {
      return false;
    }
    
    // Get the CSRF token from the header or body
    let csrfToken: string | undefined;
    
    // Check header first
    csrfToken = request.headers.get(CSRF_TOKEN_HEADER) || undefined;
    
    // If header is not present, check request body if it's a form submission
    if (!csrfToken && request.headers.get('content-type')?.includes('application/json')) {
      try {
        // Clone the request so we can read the body
        const clonedRequest = request.clone();
        const body = clonedRequest.json();
        csrfToken = (body as any)[CSRF_TOKEN_FORM_FIELD];
      } catch (error) {
        console.error('Error parsing request body for CSRF token:', error);
      }
    }
    
    if (!csrfToken) {
      return false;
    }
    
    // Split token:timestamp
    const [token, timestampStr] = csrfToken.split(':');
    if (!token || !timestampStr) {
      return false;
    }
    
    // Parse timestamp
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      return false;
    }
    
    // Check token age (max 1 hour)
    const now = Date.now();
    if (now - timestamp > 60 * 60 * 1000) {
      return false;
    }
    
    // Re-create the token with the secret and check if it matches
    const expectedToken = createHash('sha256')
      .update(`${csrfCookie.value}${timestampStr}`)
      .digest('hex');
    
    return token === expectedToken;
  } catch (error) {
    console.error('Error validating CSRF token:', error);
    return false;
  }
}

/**
 * Middleware to validate CSRF tokens
 */
export function csrfMiddleware(handler: Function) {
  return async (request: NextRequest) => {
    // Only check POST, PUT, DELETE requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      // Validate CSRF token
      if (!validateCsrfToken(request)) {
        return new Response(JSON.stringify({ error: 'Invalid CSRF token' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    return handler(request);
  };
}