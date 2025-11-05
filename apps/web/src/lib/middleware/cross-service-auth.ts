/**
 * Cross-Service Authentication Middleware
 * 
 * This middleware verifies requests coming from other internal services
 * by validating signatures and checking API keys.
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface CrossServiceAuthOptions {
  requiredServices?: string[];
  apiKeyMap?: Record<string, string>;
  strict?: boolean;
}

/**
 * Verify the signature of a cross-service request
 */
function verifySignature(
  method: string,
  path: string,
  timestamp: string,
  signature: string,
  apiKey: string,
  body?: string,
): boolean {
  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${body || ''}`;
  const expectedSignature = crypto
    .createHmac('sha256', apiKey)
    .update(payload)
    .digest('hex');
  
  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Check if the request timestamp is within the allowed window
 * Default window is 5 minutes (300 seconds)
 */
function isTimestampValid(timestamp: string, maxAge = 300): boolean {
  const requestTime = parseInt(timestamp, 10);
  const currentTime = Math.floor(Date.now() / 1000);
  
  return !isNaN(requestTime) && 
    requestTime <= currentTime && 
    (currentTime - requestTime) <= maxAge;
}

/**
 * Validate internal service request
 */
async function validateServiceRequest(
  request: NextRequest,
  options: CrossServiceAuthOptions = {}
): Promise<{
  valid: boolean;
  serviceName?: string;
  error?: string;
}> {
  // Get headers
  const serviceName = request.headers.get('X-Service-Name');
  const requestId = request.headers.get('X-Request-ID');
  const timestamp = request.headers.get('X-Timestamp');
  const signature = request.headers.get('X-Signature');
  
  // Check required headers
  if (!serviceName) {
    return { valid: false, error: 'Missing service name header' };
  }
  
  if (!requestId) {
    return { valid: false, error: 'Missing request ID header', serviceName };
  }
  
  if (!timestamp) {
    return { valid: false, error: 'Missing timestamp header', serviceName };
  }
  
  // Check if the service is allowed
  if (options.requiredServices && !options.requiredServices.includes(serviceName)) {
    return { 
      valid: false, 
      error: `Service "${serviceName}" is not authorized for this endpoint`,
      serviceName 
    };
  }
  
  // Check timestamp to prevent replay attacks
  if (!isTimestampValid(timestamp)) {
    return { 
      valid: false, 
      error: 'Request timestamp is too old or invalid',
      serviceName
    };
  }
  
  // Strict mode requires signature verification with API keys
  if (options.strict) {
    // Signature is required in strict mode
    if (!signature) {
      return { 
        valid: false, 
        error: 'Missing signature header',
        serviceName
      };
    }
    
    // Get API key for the service
    const apiKey = options.apiKeyMap?.[serviceName] || 
      process.env[`${serviceName.toUpperCase().replace(/-/g, '_')}_API_KEY`];
    
    if (!apiKey) {
      return { 
        valid: false, 
        error: `No API key found for service "${serviceName}"`,
        serviceName 
      };
    }
    
    // Get request body for signature verification
    let body: string | undefined;
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      try {
        const clone = request.clone();
        const json = await clone.json();
        body = JSON.stringify(json);
      } catch (e) {
        // No body or not JSON
      }
    }
    
    // Verify signature
    const url = new URL(request.url);
    const path = url.pathname;
    
    try {
      const isValid = verifySignature(
        request.method,
        path,
        timestamp,
        signature,
        apiKey,
        body
      );
      
      if (!isValid) {
        return { 
          valid: false, 
          error: 'Invalid signature',
          serviceName 
        };
      }
    } catch (error) {
      return { 
        valid: false, 
        error: 'Signature verification failed',
        serviceName 
      };
    }
  }
  
  return { valid: true, serviceName };
}

/**
 * Middleware for authenticating cross-service requests
 * 
 * @param handler The route handler
 * @param options Configuration options
 * @returns A middleware-wrapped handler
 */
export function withCrossServiceAuth(
  handler: Function,
  options: CrossServiceAuthOptions = {}
) {
  return async (request: NextRequest, ...args: any[]) => {
    // Skip validation for OPTIONS requests (CORS preflight)
    if (request.method === 'OPTIONS') {
      return handler(request, ...args);
    }
    
    // Check internal API key header first (simplified auth for trusted environments)
    const apiKey = request.headers.get('X-API-Key');
    const internalApiKey = process.env.INTERNAL_API_KEY;
    
    if (internalApiKey && apiKey === internalApiKey) {
      // Add service info to the request
      (request as any).service = {
        name: request.headers.get('X-Service-Name') || 'unknown',
        internal: true
      };
      
      return handler(request, ...args);
    }
    
    // Validate service request
    const result = await validateServiceRequest(request, options);
    
    if (!result.valid) {
      console.warn(`Cross-service authentication failed: ${result.error}`, {
        serviceName: result.serviceName,
        path: request.nextUrl.pathname,
        method: request.method,
      });
      
      return NextResponse.json(
        { error: result.error || 'Unauthorized service request' },
        { status: 401 }
      );
    }
    
    // Add service info to the request
    (request as any).service = {
      name: result.serviceName,
      internal: false
    };
    
    // Call the handler with the authenticated request
    return handler(request, ...args);
  };
}