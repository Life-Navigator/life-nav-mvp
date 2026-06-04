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
    console.error('Email confirmation error:', error.message);
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  // Successful verification — redirect based on type
  if (type === 'signup' || type === 'email') {
    // New signup: check if onboarding is complete
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Funnel anchor: every time-to-X metric measures from here. Best-effort.
    if (user) {
      await recordUserEvent(supabase, {
        user_id: user.id,
        event_type: 'user_signed_up',
        event_metadata: { method: 'email' },
        subject_kind: 'auth',
        subject_id: null,
      }).catch(() => {});
    }

    const isOnboarded = user?.user_metadata?.onboarding_completed;
    if (!isOnboarded) {
      // Beta fast-path: send new users straight to the sample-profile picker
      // (matches middleware), not the long questionnaire.
      return NextResponse.redirect(new URL('/onboarding/financial-profile', request.url));
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
