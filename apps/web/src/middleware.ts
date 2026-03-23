import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public routes that don't require authentication
const PUBLIC_ROUTES = new Set([
  '/',
  '/pricing',
  '/features',
  '/security',
  '/waitlist',
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify',
]);

function isPublicRoute(path: string): boolean {
  if (PUBLIC_ROUTES.has(path)) return true;
  if (path.startsWith('/auth/')) return true;
  if (path.startsWith('/api/auth')) return true;
  if (path.startsWith('/_next')) return true;
  if (path.startsWith('/static')) return true;
  if (path.includes('/favicon')) return true;
  if (path.includes('/images')) return true;
  return false;
}

function isProtectedRoute(path: string): boolean {
  return (
    path.startsWith('/dashboard') ||
    path.startsWith('/onboarding') ||
    path.startsWith('/admin') ||
    (path.startsWith('/api/') && !path.startsWith('/api/auth'))
  );
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Create response to pass through
  let response = NextResponse.next({ request });

  // Create Supabase client with cookie handling
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Supabase not configured — allow all requests through
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as Record<string, unknown>)
        );
      },
    },
  });

  // Refresh session (important for token rotation)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthenticated = !!user;

  // ---- Public routes: allow through ----
  if (isPublicRoute(path)) {
    // If authenticated user visits auth pages, redirect to dashboard
    if (isAuthenticated && path.startsWith('/auth/')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return response;
  }

  // ---- Protected routes: require auth ----
  if (isProtectedRoute(path) && !isAuthenticated) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', path);
    return NextResponse.redirect(loginUrl);
  }

  // ---- Onboarding check ----
  if (isAuthenticated && (path.startsWith('/dashboard') || path.startsWith('/admin'))) {
    // Check if user has completed onboarding.
    // Handle three cases:
    //   1. profile exists, setup_completed = true  → allow through
    //   2. profile exists, setup_completed = false → redirect to onboarding
    //   3. profile doesn't exist (trigger lag/failure) → redirect to onboarding
    //      The onboarding page will wait for the profile row to appear.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('setup_completed')
      .eq('id', user!.id)
      .single();

    if (profileError || !profile || !profile.setup_completed) {
      return NextResponse.redirect(new URL('/onboarding/questionnaire', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
