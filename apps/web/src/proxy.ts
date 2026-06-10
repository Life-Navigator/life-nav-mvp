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
  '/auth',
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

// Host that serves the application entry (vs. the marketing apex). Visiting its
// root should land on the app, not the marketing homepage.
const APP_HOST = process.env.APP_HOST || 'app.lifenavigator.tech';

function isProtectedRoute(path: string): boolean {
  return (
    path.startsWith('/dashboard') ||
    path.startsWith('/onboarding') ||
    path.startsWith('/admin') ||
    (path.startsWith('/api/') && !path.startsWith('/api/auth'))
  );
}

export async function proxy(request: NextRequest) {
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

  // ---- App subdomain: root goes to the app entry, not the marketing home ----
  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase();
  if (host === APP_HOST && path === '/') {
    return NextResponse.redirect(
      new URL(isAuthenticated ? '/dashboard' : '/auth?mode=signin', request.url)
    );
  }

  // ---- Public routes: allow through ----
  if (isPublicRoute(path)) {
    // If authenticated user visits any auth page, redirect to dashboard
    if (isAuthenticated && (path === '/auth' || path.startsWith('/auth/'))) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return response;
  }

  // ---- Protected routes: require auth ----
  if (isProtectedRoute(path) && !isAuthenticated) {
    const loginUrl = new URL('/auth', request.url);
    loginUrl.searchParams.set('mode', 'signin');
    loginUrl.searchParams.set('next', path);
    return NextResponse.redirect(loginUrl);
  }

  // ---- Onboarding gate (advisor-first) ----
  // Required sequence: pick persona (setup_completed) → advisor onboarding
  // (onboarding_completed) → dashboard. Two distinct flags so persona activation
  // can NEVER unlock the dashboard on its own (that was the trust bug).
  //   - !setup_completed            → pick a sample financial profile
  //   - setup_completed, !onboarding_completed → run the advisor onboarding
  //   - both true (or skipped)      → dashboard unlocked
  // The advisor route itself is exempt from the advisor redirect so it can render. The documents
  // route is ALSO exempt during onboarding: the advisor's action cards send the user there to upload
  // a requested document, then return to the advisor — blocking it would dead-end the upload loop.
  const ONBOARDING_ALLOWED = ['/dashboard/advisor', '/dashboard/documents'];
  if (isAuthenticated && (path.startsWith('/dashboard') || path.startsWith('/admin'))) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('setup_completed, onboarding_completed')
      .eq('id', user!.id)
      .single();

    if (profileError || !profile || !profile.setup_completed) {
      // No persona/setup yet → pick a sample financial profile first.
      return NextResponse.redirect(new URL('/onboarding/financial-profile', request.url));
    }

    // Persona is set but the advisor onboarding hasn't run (or been skipped):
    // force the user into the advisor before the rest of the dashboard unlocks — except the
    // onboarding-support routes (advisor itself + the document upload page it links to).
    if (!profile.onboarding_completed && !ONBOARDING_ALLOWED.some((p) => path.startsWith(p))) {
      return NextResponse.redirect(new URL('/dashboard/advisor?onboarding=1', request.url));
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
