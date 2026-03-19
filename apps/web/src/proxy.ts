import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ── Route classification ────────────────────────────────────────────
// Four explicit categories. Every path should fall into exactly one.
//
// 1. MARKETING    — public, fast-pathed (no Supabase call at all)
// 2. Auth pages   — /auth/* browser pages; need getUser() to redirect
//                   already-authenticated users → /dashboard
// 3. Auth API     — /api/auth/* JSON endpoints; always pass through
//                   (no redirect, no auth gate)
// 4. Protected    — /dashboard, /onboarding, /admin, /api/* (non-auth)

/** Marketing / landing pages — fully public, skip Supabase entirely. */
const MARKETING_ROUTES = new Set(['/', '/pricing', '/features', '/security', '/waitlist']);

/** Returns true for pages that never require authentication. */
function isMarketingRoute(path: string): boolean {
  return MARKETING_ROUTES.has(path);
}

/** Auth **pages** (/auth/login, /auth/register, etc.).
 *  These get a redirect-to-dashboard when the user is already signed in. */
function isAuthPageRoute(path: string): boolean {
  return path.startsWith('/auth/');
}

/** Auth **API** routes (/api/auth/register, /api/auth/session, etc.).
 *  These always pass through — no redirect logic, no auth gate. */
function isAuthApiRoute(path: string): boolean {
  return path.startsWith('/api/auth');
}

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

  // ── Fast path: marketing pages + auth API routes skip Supabase ──
  // Marketing: no auth needed at all.
  // Auth API: JSON endpoints that handle their own auth internally;
  //   redirecting them would break fetch() callers.
  if (isMarketingRoute(path) || isAuthApiRoute(path)) {
    return response;
  }

  // ── Supabase client ────────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
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

  // ── Auth pages: redirect to dashboard if already signed in ─────
  // Only browser pages (/auth/*), never API routes (/api/auth/*).
  if (isAuthPageRoute(path)) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return response;
  }

  // ── Protected routes: require auth ─────────────────────────────
  if (isProtectedRoute(path) && !isAuthenticated) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', path);
    return NextResponse.redirect(loginUrl);
  }

  // ── Onboarding check ──────────────────────────────────────────
  if (isAuthenticated && (path.startsWith('/dashboard') || path.startsWith('/admin'))) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('setup_completed')
      .eq('id', user!.id)
      .single();

    if (profile && !profile.setup_completed) {
      return NextResponse.redirect(new URL('/onboarding/questionnaire', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and metadata files.
     * Adding these exclusions prevents the proxy (and its Supabase calls)
     * from running on requests that can never need auth.
     *
     * Excluded:
     * - _next/static, _next/image  (Next.js build output)
     * - favicon.ico, sitemap.xml, robots.txt (metadata)
     * - monitoring (Sentry tunnel)
     * - images/, static/ (public asset dirs)
     * - *.svg, *.png, *.jpg, *.jpeg, *.gif, *.webp, *.ico (image files)
     * - *.woff, *.woff2, *.ttf, *.eot (font files)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|monitoring|images/|static/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot)$).*)',
  ],
};
