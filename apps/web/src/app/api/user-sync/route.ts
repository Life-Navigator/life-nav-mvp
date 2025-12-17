/**
 * User Sync API Route
 * Proxies user synchronization requests to the backend
 */
import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

async function getAuthHeaders(request: NextRequest): Promise<Record<string, string>> {
  const authHeader = request.headers.get('authorization');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authHeader) {
    headers['Authorization'] = authHeader;
  } else {
    const token = request.cookies.get('token')?.value;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
}

/**
 * POST /api/user-sync
 * Sync a user from Supabase to the backend database
 */
export async function POST(request: NextRequest) {
  try {
    const headers = await getAuthHeaders(request);
    const body = await request.json();

    // Validate required fields
    if (!body.supabase_user_id || !body.email) {
      return NextResponse.json(
        { error: 'Missing required fields: supabase_user_id and email' },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/v1/user-sync/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Backend sync error' }));
      return NextResponse.json(error, { status: response.status });
    }

    const result = await response.json();
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('User sync API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/user-sync
 * Get current user's sync status
 */
export async function GET(request: NextRequest) {
  try {
    // Get current Supabase user
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const headers = await getAuthHeaders(request);

    // Look up user in backend
    const response = await fetch(
      `${BACKEND_URL}/api/v1/user-sync/lookup/${user.id}`,
      { headers }
    );

    if (!response.ok) {
      return NextResponse.json({ exists: false });
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('User sync lookup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
