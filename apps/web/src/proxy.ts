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
    // Rule 1: an authenticated user hitting the auth pages must NEVER silently resume into the app —
    // route to the explicit session interstitial (Continue / Switch Account / Sign Out). Don't trap the
    // interstitial itself or the auth-processing callbacks (callback/confirm complete the login first).
    if (
      isAuthenticated &&
      (path === '/auth' || path.startsWith('/auth/')) &&
      path !== '/auth/session' &&
      !path.startsWith('/auth/callback') &&
      !path.startsWith('/auth/confirm')
    ) {
      return NextResponse.redirect(new URL('/auth/session', request.url));
    }
    return response;
  }

  // ---- Protected routes: require auth ----
  if (isProtectedRoute(path) && !isAuthenticated) {
    // Rule 4: protected APIs return a clean 401 (don't redirect a fetch() to the HTML login page,
    // which would otherwise look like a 200 of /auth). Pages still redirect to the sign-in form.
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized', code: 'unauthenticated' }, { status: 401 });
    }
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
  // Legacy onboarding surfaces (superseded by /onboarding/financial-profile + the advisor). There is
  // ONE canonical flow: persona → advisor → dashboard. These pages must never be a parallel path, so
  // they are folded into the canonical flow by stage (no persona → persona; persona only → advisor;
  // complete → dashboard). /onboarding/financial-profile is the canonical entry and is NOT listed.
  const LEGACY_ONBOARDING = [
    '/onboarding/questionnaire',
    '/onboarding/interactive',
    '/onboarding/hub',
    '/onboarding/review',
    '/onboarding/sections',
    '/onboarding/converse',
  ];
  const isLegacyOnboarding = LEGACY_ONBOARDING.some((p) => path.startsWith(p));
  if (
    isAuthenticated &&
    (path.startsWith('/dashboard') || path.startsWith('/admin') || isLegacyOnboarding)
  ) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('setup_completed, onboarding_completed')
      .eq('id', user!.id)
      .single();

    let setupCompleted = !!profile?.setup_completed;
    let onboardingCompleted = !!profile?.onboarding_completed;

    // ONBOARDING_GATE_DECISION — structured log so any reported bypass is diagnosable from prod logs.
    const gate = (decision: string, redirect: string | null) =>
      console.log(
        'ONBOARDING_GATE_DECISION ' +
          JSON.stringify({
            user_id: user!.id,
            path,
            setup_completed: setupCompleted,
            onboarding_completed: onboardingCompleted,
            profile_error: profileError?.message ?? null,
            decision,
            redirect,
          })
      );

    // STALE-FLAG SAFETY NET (A2): a user who already has meaningful data — an activated finance persona
    // OR a saved goal — is effectively onboarded even if these booleans are stale, so do NOT trap them in
    // onboarding; repair the flags so the check isn't needed again. This runs ONLY on the would-redirect
    // path, so already-onboarded users pay nothing, and genuinely-new users (no data) still onboard fully.
    if (!profileError && profile && (!setupCompleted || !onboardingCompleted)) {
      let hasMeaningfulData = false;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as any;
        const [persona, goal] = await Promise.all([
          sb
            .from('analytics_user_events')
            .select('id')
            .eq('user_id', user!.id)
            .eq('subject_kind', 'plaid_persona')
            .limit(1),
          sb.from('goals').select('id').eq('user_id', user!.id).limit(1),
        ]);
        hasMeaningfulData = !!(persona?.data?.length || goal?.data?.length);
      } catch {
        hasMeaningfulData = false; // fail safe → fall through to the normal onboarding redirects
      }
      if (hasMeaningfulData) {
        setupCompleted = true;
        onboardingCompleted = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        void (supabase as any)
          .from('profiles')
          .update({ setup_completed: true, onboarding_completed: true })
          .eq('id', user!.id);
        gate('stale_flags_backfilled→served', null);
      }
    }

    if (profileError || !profile || !setupCompleted) {
      // No persona/setup yet → pick a sample financial profile first.
      gate('no_setup→financial_profile', '/onboarding/financial-profile');
      return NextResponse.redirect(new URL('/onboarding/financial-profile', request.url));
    }

    // Persona is set but the advisor onboarding hasn't run (or been skipped):
    // force the user into the advisor before the rest of the dashboard unlocks — except the
    // onboarding-support routes (advisor itself + the document upload page it links to).
    if (!onboardingCompleted && !ONBOARDING_ALLOWED.some((p) => path.startsWith(p))) {
      gate('setup_only→advisor', '/dashboard/advisor?onboarding=1');
      return NextResponse.redirect(new URL('/dashboard/advisor?onboarding=1', request.url));
    }

    // Onboarding is complete but the user landed on a legacy onboarding page → send them to the app.
    if (isLegacyOnboarding) {
      gate('complete_on_legacy→dashboard', '/dashboard');
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    gate('served', null);
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
