/**
 * Financial Data API Routes
 *
 * Proxies requests to the backend API for financial data operations.
 * Handles authentication, validation, and error responses.
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
    // Try to get from cookies
    const token = request.cookies.get('token')?.value;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
}

/**
 * GET /api/data/financial
 * Get financial summary
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const headers = await getAuthHeaders(request);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'summary';

    let endpoint = '/api/v1/finance';
    if (type === 'accounts') {
      endpoint = '/api/v1/finance/accounts';
    } else if (type === 'transactions') {
      endpoint = '/api/v1/finance/transactions';
      // Forward query params
      const queryParams = new URLSearchParams();
      ['account_id', 'start_date', 'end_date', 'category', 'skip', 'limit'].forEach(key => {
        const value = searchParams.get(key);
        if (value) queryParams.append(key, value);
      });
      if (queryParams.toString()) {
        endpoint += `?${queryParams.toString()}`;
      }
    } else if (type === 'budgets') {
      endpoint = '/api/v1/finance/budgets';
    }

    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
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
    console.error('Financial API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/data/financial
 * Create financial record (account, transaction, or budget)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const headers = await getAuthHeaders(request);
    const body = await request.json();
    const { type, ...data } = body;

    let endpoint = '/api/v1/finance';
    if (type === 'account') {
      endpoint = '/api/v1/finance/accounts';
    } else if (type === 'transaction') {
      endpoint = '/api/v1/finance/transactions';
    } else if (type === 'budget') {
      endpoint = '/api/v1/finance/budgets';
    } else {
      return NextResponse.json(
        { error: 'Invalid type. Must be account, transaction, or budget' },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Backend error' }));
      return NextResponse.json(error, { status: response.status });
    }

    const result = await response.json();
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Financial API POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
