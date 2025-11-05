/**
 * API Gateway Security Middleware
 * 
 * This middleware provides API gateway functionality, including:
 * - Rate limiting
 * - IP filtering
 * - Request validation
 * - API key validation
 * - Request logging
 */
import { NextRequest, NextResponse } from 'next/server';
import { withCors, defaultCorsOptions, CorsOptions } from './cors-config';

// IP filtering
interface IpFilterOptions {
  allowlist?: string[];
  blocklist?: string[];
  allowPrivateIps?: boolean;
  behavior?: 'allow' | 'block';
}

// Rate limiting
interface RateLimitOptions {
  limit: number;
  windowMs: number;
  keyGenerator?: (req: NextRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  headers?: boolean;
}

// API key validation
interface ApiKeyOptions {
  header?: string;
  query?: string;
  keys: string[] | Record<string, string>;
  keyRoles?: Record<string, string[]>;
}

// Gateway options
interface ApiGatewayOptions {
  cors?: CorsOptions;
  rateLimit?: RateLimitOptions;
  ipFilter?: IpFilterOptions;
  apiKey?: ApiKeyOptions;
  enableLogging?: boolean;
  validateRequestSchema?: boolean;
}

/**
 * Memory-based rate limiter implementation
 */
class MemoryRateLimiter {
  private readonly store: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly options: RateLimitOptions;
  
  constructor(options: RateLimitOptions) {
    this.options = {
      limit: 100,
      windowMs: 60 * 1000, // 1 minute default
      keyGenerator: (req) => {
        // Default key is IP + path
        const ip = req.ip || '127.0.0.1';
        const path = new URL(req.url).pathname;
        return `${ip}:${path}`;
      },
      headers: true,
      ...options,
    };
  }
  
  /**
   * Check if a request is rate limited
   */
  isRateLimited(req: NextRequest): {
    limited: boolean;
    remaining: number;
    resetTime: number;
  } {
    const key = this.options.keyGenerator!(req);
    const now = Date.now();
    
    // Clean up old entries
    if (Math.random() < 0.01) { // 1% chance to run cleanup
      this.cleanup(now);
    }
    
    let entry = this.store.get(key);
    
    // Create new entry if none exists or window has passed
    if (!entry || entry.resetTime <= now) {
      entry = {
        count: 0,
        resetTime: now + this.options.windowMs,
      };
      this.store.set(key, entry);
    }
    
    // Increment counter
    entry.count += 1;
    
    // Check if over limit
    const limited = entry.count > this.options.limit;
    const remaining = Math.max(0, this.options.limit - entry.count);
    
    return {
      limited,
      remaining,
      resetTime: entry.resetTime,
    };
  }
  
  /**
   * Clean up old entries
   */
  private cleanup(now: number) {
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime <= now) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Check if an IP is in a list (with CIDR support)
 */
function isIpInList(ip: string, list: string[]): boolean {
  // Simple exact match for now
  // In production, this should support CIDR notation
  return list.includes(ip);
}

/**
 * Check if a request's IP is allowed
 */
function isIpAllowed(req: NextRequest, options: IpFilterOptions): boolean {
  const ip = req.ip || '127.0.0.1';
  
  // Check blocklist first
  if (options.blocklist && isIpInList(ip, options.blocklist)) {
    return false;
  }
  
  // If allowlist is provided, IP must be in it
  if (options.allowlist && options.allowlist.length > 0) {
    return isIpInList(ip, options.allowlist);
  }
  
  // If no allowlist, default to allowing all non-blocked IPs
  return true;
}

/**
 * Validate an API key
 */
function validateApiKey(
  req: NextRequest,
  options: ApiKeyOptions
): { valid: boolean; role?: string } {
  // Get API key from header or query
  let apiKey: string | null = null;
  
  if (options.header) {
    apiKey = req.headers.get(options.header);
  }
  
  if (!apiKey && options.query) {
    const url = new URL(req.url);
    apiKey = url.searchParams.get(options.query);
  }
  
  if (!apiKey) {
    return { valid: false };
  }
  
  // Check if key is valid
  if (Array.isArray(options.keys)) {
    // Simple array of valid keys
    return { valid: options.keys.includes(apiKey) };
  } else {
    // Object with key -> role mapping
    const role = options.keys[apiKey];
    return { valid: !!role, role };
  }
}

/**
 * Log request details
 */
function logRequest(req: NextRequest, res: NextResponse, startTime: number) {
  const url = new URL(req.url);
  const duration = Date.now() - startTime;
  const ip = req.ip || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  const status = res.status;
  
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${url.pathname} - ${status} - ${duration}ms - ${ip} - ${userAgent}`
  );
}

/**
 * Create an API gateway middleware
 */
export function createApiGateway(options: ApiGatewayOptions = {}) {
  // Initialize rate limiter if enabled
  const rateLimiter = options.rateLimit ? new MemoryRateLimiter(options.rateLimit) : null;
  
  // Create middleware function
  const middleware = async (
    req: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse> | NextResponse
  ) => {
    const startTime = Date.now();
    
    try {
      // IP filtering
      if (options.ipFilter) {
        const allowed = isIpAllowed(req, options.ipFilter);
        if (!allowed) {
          return NextResponse.json(
            { error: 'IP address not allowed' },
            { status: 403 }
          );
        }
      }
      
      // Rate limiting
      if (rateLimiter) {
        const { limited, remaining, resetTime } = rateLimiter.isRateLimited(req);
        
        if (limited) {
          const res = NextResponse.json(
            { error: 'Rate limit exceeded' },
            { status: 429 }
          );
          
          // Add rate limit headers
          if (options.rateLimit?.headers) {
            res.headers.set('X-RateLimit-Limit', options.rateLimit.limit.toString());
            res.headers.set('X-RateLimit-Remaining', '0');
            res.headers.set('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());
            res.headers.set('Retry-After', Math.ceil((resetTime - Date.now()) / 1000).toString());
          }
          
          return res;
        }
      }
      
      // API key validation
      if (options.apiKey) {
        const { valid, role } = validateApiKey(req, options.apiKey);
        
        if (!valid) {
          return NextResponse.json(
            { error: 'Invalid API key' },
            { status: 401 }
          );
        }
        
        // Add role to request for later use
        if (role) {
          (req as any).apiKeyRole = role;
        }
      }
      
      // Process the request
      const response = await handler(req);
      
      // Add rate limit headers to response
      if (rateLimiter && options.rateLimit?.headers) {
        const { remaining, resetTime } = rateLimiter.isRateLimited(req);
        response.headers.set('X-RateLimit-Limit', options.rateLimit.limit.toString());
        response.headers.set('X-RateLimit-Remaining', remaining.toString());
        response.headers.set('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());
      }
      
      // Log request
      if (options.enableLogging) {
        logRequest(req, response, startTime);
      }
      
      return response;
    } catch (error) {
      console.error('API Gateway error:', error);
      
      // Log failed request
      if (options.enableLogging) {
        const errorResponse = NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
        logRequest(req, errorResponse, startTime);
      }
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
  
  // Combine with CORS middleware if enabled
  const corsOptions = options.cors || defaultCorsOptions;
  const corsMiddleware = withCors(corsOptions);
  
  // Return the combined middleware
  return (handler: (req: NextRequest) => Promise<NextResponse> | NextResponse) => {
    const gatewayHandler = async (req: NextRequest) => middleware(req, handler);
    return corsMiddleware(gatewayHandler);
  };
}

/**
 * Common API gateway configurations
 */
export const apiGateways = {
  // Standard API gateway with default settings
  standard: createApiGateway({
    cors: defaultCorsOptions,
    rateLimit: {
      limit: parseInt(process.env.RATE_LIMIT_STANDARD?.split(':')[0] || '100'),
      windowMs: parseInt(process.env.RATE_LIMIT_STANDARD?.split(':')[1] || '60000'),
      headers: true,
    },
    enableLogging: process.env.API_LOGGING === 'true',
  }),
  
  // Public API gateway with higher limits
  public: createApiGateway({
    cors: {
      ...defaultCorsOptions,
      allowedOrigins: '*',
      credentials: false,
    },
    rateLimit: {
      limit: parseInt(process.env.RATE_LIMIT_PUBLIC?.split(':')[0] || '50'),
      windowMs: parseInt(process.env.RATE_LIMIT_PUBLIC?.split(':')[1] || '60000'),
      headers: true,
    },
    enableLogging: process.env.API_LOGGING === 'true',
  }),
  
  // Auth API gateway with stricter limits to prevent brute force attacks
  auth: createApiGateway({
    cors: defaultCorsOptions,
    rateLimit: {
      limit: parseInt(process.env.RATE_LIMIT_AUTH?.split(':')[0] || '20'),
      windowMs: parseInt(process.env.RATE_LIMIT_AUTH?.split(':')[1] || '60000'),
      headers: true,
      keyGenerator: (req) => {
        // Use IP address as the key for auth endpoints to prevent brute force
        const ip = req.ip || '127.0.0.1';
        return `auth:${ip}`;
      },
    },
    enableLogging: true,
  }),
  
  // Registration-specific rate limiting (very strict)
  register: createApiGateway({
    cors: defaultCorsOptions,
    rateLimit: {
      limit: parseInt(process.env.RATE_LIMIT_REGISTER?.split(':')[0] || '5'),
      windowMs: parseInt(process.env.RATE_LIMIT_REGISTER?.split(':')[1] || '1800000'), // 30 minutes
      headers: true,
      keyGenerator: (req) => {
        const ip = req.ip || '127.0.0.1';
        return `register:${ip}`;
      },
    },
    enableLogging: true,
  }),
  
  // Password and MFA operations rate limiting
  passwordOps: createApiGateway({
    cors: defaultCorsOptions,
    rateLimit: {
      limit: parseInt(process.env.RATE_LIMIT_PASSWORD_OPS?.split(':')[0] || '5'),
      windowMs: parseInt(process.env.RATE_LIMIT_PASSWORD_OPS?.split(':')[1] || '900000'), // 15 minutes
      headers: true,
      keyGenerator: (req) => {
        const ip = req.ip || '127.0.0.1';
        const token = (req as any).token;
        // Include user ID if authenticated for more accurate limiting
        return token?.sub ? `password:${token.sub}` : `password:${ip}`;
      },
    },
    enableLogging: true,
  }),
  
  // User account operations (deletion, export) rate limiting
  userAccountOps: createApiGateway({
    cors: defaultCorsOptions,
    rateLimit: {
      limit: parseInt(process.env.RATE_LIMIT_USER_ACCOUNT_OPS?.split(':')[0] || '10'),
      windowMs: parseInt(process.env.RATE_LIMIT_USER_ACCOUNT_OPS?.split(':')[1] || '3600000'), // 1 hour
      headers: true,
      keyGenerator: (req) => {
        const token = (req as any).token;
        const ip = req.ip || '127.0.0.1';
        // Use user ID for authenticated requests
        return token?.sub ? `account:${token.sub}` : `account:${ip}`;
      },
    },
    enableLogging: true,
  }),
  
  // Document upload/download rate limiting
  documentOps: createApiGateway({
    cors: defaultCorsOptions,
    rateLimit: {
      limit: parseInt(process.env.RATE_LIMIT_DOCUMENT_OPS?.split(':')[0] || '20'),
      windowMs: parseInt(process.env.RATE_LIMIT_DOCUMENT_OPS?.split(':')[1] || '600000'), // 10 minutes
      headers: true,
      keyGenerator: (req) => {
        const token = (req as any).token;
        const ip = req.ip || '127.0.0.1';
        return token?.sub ? `document:${token.sub}` : `document:${ip}`;
      },
    },
    enableLogging: true,
  }),
  
  // OAuth and token operations rate limiting
  oauth: createApiGateway({
    cors: defaultCorsOptions,
    rateLimit: {
      limit: parseInt(process.env.RATE_LIMIT_OAUTH?.split(':')[0] || '10'),
      windowMs: parseInt(process.env.RATE_LIMIT_OAUTH?.split(':')[1] || '300000'), // 5 minutes
      headers: true,
      keyGenerator: (req) => {
        const ip = req.ip || '127.0.0.1';
        const token = (req as any).token;
        return token?.sub ? `oauth:${token.sub}` : `oauth:${ip}`;
      },
    },
    enableLogging: true,
  }),
  
  // Admin API gateway with strict security
  admin: createApiGateway({
    cors: {
      ...defaultCorsOptions,
      allowedOrigins: process.env.ADMIN_ALLOWED_ORIGINS?.split(',') || [
        'https://admin.lifenavigator.example',
      ],
      credentials: true,
      strictOriginCheck: true,
    },
    rateLimit: {
      limit: parseInt(process.env.RATE_LIMIT_ADMIN?.split(':')[0] || '300'),
      windowMs: parseInt(process.env.RATE_LIMIT_ADMIN?.split(':')[1] || '60000'),
      headers: true,
    },
    apiKey: {
      header: 'X-Admin-API-Key',
      keys: process.env.ADMIN_API_KEYS?.split(',') || [],
    },
    ipFilter: {
      allowlist: process.env.ADMIN_ALLOWED_IPS?.split(',') || [],
      allowPrivateIps: process.env.NODE_ENV !== 'production',
    },
    enableLogging: true,
  }),
  
  // Internal API gateway for service-to-service communication
  internal: createApiGateway({
    cors: {
      ...defaultCorsOptions,
      allowedOrigins: process.env.INTERNAL_ALLOWED_ORIGINS?.split(',') || [
        'https://api.lifenavigator.example',
        'http://localhost:8000',
      ],
      credentials: true,
      strictOriginCheck: true,
    },
    rateLimit: {
      limit: parseInt(process.env.RATE_LIMIT_INTERNAL?.split(':')[0] || '500'),
      windowMs: parseInt(process.env.RATE_LIMIT_INTERNAL?.split(':')[1] || '60000'),
      headers: true,
    },
    apiKey: {
      header: 'X-API-Key',
      keys: { [process.env.INTERNAL_API_KEY || 'default-key']: 'internal' },
    },
    enableLogging: process.env.API_LOGGING === 'true',
  }),
};