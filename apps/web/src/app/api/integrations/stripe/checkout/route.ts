/**
 * Stripe Checkout API Route
 *
 * Creates a Stripe checkout session for subscription purchases and one-time purchases.
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
    const {
      priceId,
      successUrl,
      cancelUrl,
      mode = 'subscription',
      productType,
      quantity = 1,
    } = body;

    if (!priceId || !successUrl || !cancelUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
    const response = await fetch(`${backendUrl}/api/v1/integrations/stripe/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        price_id: priceId,
        success_url: successUrl,
        cancel_url: cancelUrl,
        mode, // 'subscription' or 'payment' for one-time purchases
        product_type: productType, // 'chat_queries', 'scenario_runs', 'subscription'
        quantity,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || 'Failed to create checkout session' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      sessionId: data.session_id,
      checkoutUrl: data.checkout_url,
    });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
