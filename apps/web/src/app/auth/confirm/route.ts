/**
 * Email confirmation handler for Supabase Auth.
 *
 * When a user clicks the confirmation link in their email, Supabase redirects
 * them here with `token_hash` and `type` query params. We exchange the token
 * for a session and redirect to the appropriate page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { recordUserEvent } from '@/lib/analytics/events';
import type { EmailOtpType } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/dashboard';

  if (!token_hash || !type) {
    return NextResponse.redirect(
      new URL('/auth/login?error=invalid_confirmation_link', request.url)
    );
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.redirect(new URL('/auth/login?error=auth_not_configured', request.url));
  }

  const { error } = await supabase.auth.verifyOtp({ token_hash, type });

  if (error) {
    // Friendly, classified error so the login page can show the right message
    // and offer "resend". Expired/used links are the common case.
    const msg = error.message.toLowerCase();
    const code =
      msg.includes('expired') || msg.includes('invalid') || msg.includes('not found')
        ? 'link_expired'
        : 'confirmation_failed';
    console.error('Auth link verification error:', error.message);
    return NextResponse.redirect(new URL(`/auth/login?error=${code}`, request.url));
  }

  // Session is now established (cookies set on this response). Magic-link,
  // invite, and signup links all create a fresh session for a (usually new)
  // beta user, so they all flow into the onboarding gate.
  const isNewSessionType =
    type === 'signup' || type === 'email' || type === 'magiclink' || type === 'invite';

  if (isNewSessionType) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Funnel anchor: every time-to-X metric measures from here. Best-effort.
    if (user) {
      await recordUserEvent(supabase, {
        user_id: user.id,
        event_type: 'user_signed_up',
        event_metadata: { method: type },
        subject_kind: 'auth',
        subject_id: null,
      }).catch(() => {});
    }

    // Onboarding gate — use the authoritative `profiles.setup_completed` (same
    // signal the middleware uses), not user_metadata, so they never disagree.
    // Missing profile (trigger lag) counts as not-onboarded → onboarding page
    // waits for the profile. New invited users land directly in onboarding.
    let onboarded = false;
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('setup_completed')
        .eq('id', user.id)
        .maybeSingle();
      onboarded = (profile as { setup_completed?: boolean } | null)?.setup_completed === true;
    }
    if (!onboarded) {
      return NextResponse.redirect(new URL('/onboarding/financial-profile', request.url));
    }
    // Already-onboarded returning user: never drop them back on the onboarding
    // picker even if the link carried next=/onboarding. Send them to the app.
    if (next.startsWith('/onboarding')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
