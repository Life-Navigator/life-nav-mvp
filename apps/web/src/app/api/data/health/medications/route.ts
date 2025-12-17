/**
 * Medications API Routes
 */
import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';

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

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const headers = await getAuthHeaders(request);
    const { searchParams } = new URL(request.url);

    const params = new URLSearchParams();
    ['condition_id', 'status', 'skip', 'limit'].forEach(key => {
      const value = searchParams.get(key);
      if (value) params.append(key, value);
    });

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${BACKEND_URL}/api/v1/health/medications${query}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Backend error' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Medications API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const headers = await getAuthHeaders(request);
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/v1/health/medications`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Backend error' }));
      return NextResponse.json(error, { status: response.status });
    }

    const result = await response.json();
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Medications API POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
