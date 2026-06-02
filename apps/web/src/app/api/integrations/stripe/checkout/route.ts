/**
 * Stripe Checkout API Route
 *
 * Creates a Stripe checkout session for subscription purchases and one-time purchases.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireEnvUrl, MissingEnvError } from '@/lib/security/env';
import { safeApiError } from '@/lib/security/safe-error';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return safeApiError({ code: 'upstream_unavailable' });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return safeApiError({ code: 'unauthorized' });

  const body = await request.json().catch(() => ({}));
  const {
    priceId,
    successUrl,
    cancelUrl,
    mode = 'subscription',
    productType,
    quantity = 1,
  } = body as {
    priceId?: string;
    successUrl?: string;
    cancelUrl?: string;
    mode?: string;
    productType?: string;
    quantity?: number;
  };

  if (!priceId || !successUrl || !cancelUrl) {
    return safeApiError({
      code: 'bad_request',
      publicMessage: 'priceId, successUrl, and cancelUrl are required.',
    });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const sessionToken = session?.access_token;
  if (!sessionToken) return safeApiError({ code: 'unauthorized' });

  let backendUrl: string;
  try {
    backendUrl = requireEnvUrl('NEXT_PUBLIC_API_URL');
  } catch (err) {
    if (err instanceof MissingEnvError) {
      return safeApiError({ code: 'upstream_unavailable', internal: err });
    }
    throw err;
  }

  try {
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
        mode,
        product_type: productType,
        quantity,
      }),
    });
    if (!response.ok) {
      return safeApiError({
        code: response.status === 401 ? 'unauthorized' : 'upstream_unavailable',
        internal: `upstream_${response.status}`,
        context: { upstream: 'stripe-checkout' },
      });
    }
    const data = await response.json();
    return NextResponse.json({
      sessionId: data.session_id,
      checkoutUrl: data.checkout_url,
    });
  } catch (err) {
    return safeApiError({
      code: 'internal_error',
      internal: err,
      context: { route: 'stripe/checkout' },
    });
  }
}
