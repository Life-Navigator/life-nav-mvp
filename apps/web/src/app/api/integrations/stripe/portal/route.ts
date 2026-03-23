/**
 * Stripe Customer Portal API Route
 *
 * Creates a Stripe customer portal session for subscription management.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Verify authenticated user
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { returnUrl } = body;

    if (!returnUrl) {
      return NextResponse.json({ error: 'Missing returnUrl' }, { status: 400 });
    }

    // Use Supabase session for backend authentication
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const sessionToken = session?.access_token;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Forward request to backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const response = await fetch(`${backendUrl}/api/v1/integrations/stripe/portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        return_url: returnUrl,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || 'Failed to create portal session' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      portalUrl: data.portal_url,
    });
  } catch (err) {
    console.error('Stripe portal error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
