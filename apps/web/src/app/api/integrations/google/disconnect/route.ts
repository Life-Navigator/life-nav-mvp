/**
 * Google Disconnect API Route
 *
 * Disconnects the user's Google account integration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireEnvUrl, MissingEnvError } from '@/lib/security/env';
import { safeApiError } from '@/lib/security/safe-error';

export async function POST(_request: NextRequest) {
  // Verify authenticated user
  const supabase = await createServerSupabaseClient();
  if (!supabase) return safeApiError({ code: 'upstream_unavailable' });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return safeApiError({ code: 'unauthorized' });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const sessionToken = session?.access_token;

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
    const response = await fetch(`${backendUrl}/api/v1/integrations/google`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) {
      return safeApiError({
        code: response.status === 401 ? 'unauthorized' : 'upstream_unavailable',
        internal: `upstream_${response.status}`,
        context: { upstream: 'google-disconnect' },
      });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return safeApiError({
      code: 'internal_error',
      internal: err,
      context: { route: 'google/disconnect' },
    });
  }
}
