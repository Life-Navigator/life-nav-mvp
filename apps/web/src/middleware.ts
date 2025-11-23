import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { apiGateways } from '@/lib/middleware/api-gateway';

/**
 * Pilot role types and access control
 * Note: Full pilot utilities are in @/lib/auth/pilot.ts
 * These are duplicated here to avoid Edge Runtime limitations
 */
type PilotRole = 'waitlist' | 'investor' | 'pilot' | 'admin';

interface PilotUser {
  pilotRole?: string;
  pilotEnabled?: boolean;
  pilotStartAt?: string | Date | null;
  pilotEndAt?: string | Date | null;
}

function isPilotWindowActive(user: PilotUser | null): boolean {
  if (!user) return false;
  if (user.pilotRole === 'admin') return true;

  const now = new Date();

  if (user.pilotStartAt) {
    const startDate = new Date(user.pilotStartAt);
    if (now < startDate) return false;
  }

  if (user.pilotEndAt) {
    const endDate = new Date(user.pilotEndAt);
    if (now > endDate) return false;
  }

  return true;
}

function canAccessPilotApp(user: PilotUser | null): boolean {
  if (!user) return false;
  const role = user.pilotRole || 'waitlist';
  if (!['pilot', 'admin'].includes(role)) return false;
  if (role === 'pilot' && !user.pilotEnabled) return false;
  return isPilotWindowActive(user);
}

function canAccessInvestorDashboard(user: PilotUser | null): boolean {
  if (!user) return false;
  const role = user.pilotRole || 'waitlist';
  return ['investor', 'admin'].includes(role);
}

function canAccessAdminRoutes(user: PilotUser | null): boolean {
  if (!user) return false;
  return user.pilotRole === 'admin';
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Apply rate limiting based on path pattern
  let rateLimitHandler;

  if (path.startsWith('/api/')) {
    // Determine which rate limiter to use based on the API path

    // Authentication and user operations
    if (path.startsWith('/api/auth/register')) {
      rateLimitHandler = apiGateways.register;
    } else if (path.startsWith('/api/auth/mfa') || path.includes('/password')) {
      rateLimitHandler = apiGateways.passwordOps;
    } else if (path.startsWith('/api/auth')) {
      rateLimitHandler = apiGateways.auth;
    } else if (path.includes('/user/delete') || path.includes('/user/export')) {
      rateLimitHandler = apiGateways.userAccountOps;
    }

    // Document operations
    else if (path.includes('/documents/upload') || path.includes('/documents/download') || path.includes('/documents/share')) {
      rateLimitHandler = apiGateways.documentOps;
    }

    // OAuth and token operations
    else if (path.includes('/oauth') || path.includes('/token')) {
      rateLimitHandler = apiGateways.oauth;
    }

    // Admin and internal operations
    else if (path.startsWith('/api/admin')) {
      rateLimitHandler = apiGateways.admin;
    } else if (path.startsWith('/api/internal')) {
      rateLimitHandler = apiGateways.internal;
    }

    // Default API rate limiter for other endpoints
    else {
      rateLimitHandler = apiGateways.standard;
    }

    // Apply rate limiting for API routes
    return rateLimitHandler(async () => handleNormalRequest(request))(request);
  }

  // For non-API routes, just use the normal request handler
  return handleNormalRequest(request);
}

/**
 * Handle normal request processing after rate limiting
 */
async function handleNormalRequest(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Root path handling - redirect based on auth and pilot status
  if (path === '/') {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // Define protected routes (routes that require authentication)
  const isProtectedRoute = path.startsWith('/dashboard') ||
                          path.startsWith('/app') ||
                          path.startsWith('/admin') ||
                          path.startsWith('/onboarding') ||
                          (path.startsWith('/api/') &&
                          !path.startsWith('/api/auth'));

  // Define public routes (routes that should be accessible without auth)
  const isPublicRoute = path.startsWith('/auth/') ||
                       path.startsWith('/api/auth') ||
                       path.includes('/_next') ||
                       path.includes('/static') ||
                       path.includes('/images') ||
                       path.includes('/favicon');

  // Get the user token - check both NextAuth and custom auth_token cookie
  const nextAuthToken = path === '/' ? null : await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  });

  // Check for custom auth_token cookie from FastAPI backend
  const authTokenCookie = request.cookies.get('auth_token')?.value;

  // User is authenticated if either token exists
  const isAuthenticated = !!nextAuthToken || !!authTokenCookie;
  const token = nextAuthToken || { authenticated: !!authTokenCookie };

  // Attach token to request for API gateway use in rate limiting
  (request as any).token = token;

  // If the path is a protected route and no token exists, redirect to login
  if (isProtectedRoute && !isAuthenticated && !isPublicRoute) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // Extract user info for pilot access control
  const user: PilotUser | null = token && typeof token === 'object' ? {
    pilotRole: (token as any).pilotRole || (token as any).user?.pilotRole || 'waitlist',
    pilotEnabled: (token as any).pilotEnabled || (token as any).user?.pilotEnabled || false,
    pilotStartAt: (token as any).pilotStartAt || (token as any).user?.pilotStartAt,
    pilotEndAt: (token as any).pilotEndAt || (token as any).user?.pilotEndAt,
  } : null;

  // ============================================
  // PILOT ACCESS CONTROL - Route-based gating
  // ============================================

  // /app/* routes - Only accessible to active pilot users and admins
  if (path.startsWith('/app')) {
    if (!canAccessPilotApp(user)) {
      // Redirect non-pilot users to their appropriate dashboard
      const redirectPath = canAccessInvestorDashboard(user)
        ? '/dashboard/investor'
        : '/dashboard';
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }
  }

  // /dashboard/investor/* routes - Only accessible to investors and admins
  if (path.startsWith('/dashboard/investor')) {
    if (!canAccessInvestorDashboard(user)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // /admin/* routes - Only accessible to admins
  if (path.startsWith('/admin')) {
    if (!canAccessAdminRoutes(user)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // ============================================
  // ONBOARDING CHECK
  // ============================================

  // Check if user needs to complete onboarding - applies to dashboard and app routes
  const requiresSetup = path.startsWith('/dashboard') || path.startsWith('/app');
  if (requiresSetup && token && (token as any).user && !(token as any).user.setupCompleted) {
    // Get the user ID from the token
    const userId = (token as any).sub || '';

    return NextResponse.redirect(
      new URL(`/onboarding/questionnaire?userId=${userId}`, request.url)
    );
  }

  // Continue normal request processing
  return NextResponse.next();
}

// Configure which paths this middleware is run for
export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/app/:path*',
    '/admin/:path*',
    '/api/:path*',
    '/onboarding/:path*'
  ],
};
