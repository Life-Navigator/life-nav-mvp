import { NextRequest, NextResponse } from 'next/server';

// Interface for login data
interface LoginRequestBody {
  email: string;
  password: string;
}

// Interface for the backend API token response
interface BackendTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body: LoginRequestBody = await request.json();

    // Validate required fields
    if (!body.email || !body.password) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required fields: email and password are required'
        },
        { status: 400 }
      );
    }

    // Get API base URL from environment
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1';

    console.log('[Login API Route] Calling backend:', `${apiBaseUrl}/auth/login`);

    // Call the backend API
    const response = await fetch(`${apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: body.email,
        password: body.password,
      }),
    });

    // Get the response text first
    const responseText = await response.text();
    console.log('[Login API Route] Backend response status:', response.status);
    console.log('[Login API Route] Backend response text:', responseText);

    // Try to parse as JSON
    let data: BackendTokenResponse | { detail: string | Array<{ msg: string }> };
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Login API Route] Failed to parse backend response as JSON:', parseError);
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid response from server. Please try again.'
        },
        { status: 500 }
      );
    }

    // Handle non-OK responses
    if (!response.ok) {
      // Extract error message from backend response
      let errorMessage = 'Login failed';

      if ('detail' in data) {
        if (typeof data.detail === 'string') {
          errorMessage = data.detail;
        } else if (Array.isArray(data.detail) && data.detail.length > 0) {
          errorMessage = data.detail.map(err => err.msg).join(', ');
        }
      }

      console.error('[Login API Route] Backend returned error:', errorMessage);

      return NextResponse.json(
        {
          success: false,
          message: errorMessage
        },
        { status: response.status }
      );
    }

    // Success - return the token data
    console.log('[Login API Route] Login successful');

    return NextResponse.json(
      {
        success: true,
        message: 'Login successful',
        access_token: (data as BackendTokenResponse).access_token,
        refresh_token: (data as BackendTokenResponse).refresh_token,
        token_type: (data as BackendTokenResponse).token_type,
        expires_in: (data as BackendTokenResponse).expires_in,
      },
      { status: 200 }
    );

  } catch (error) {
    // Handle network errors or other unexpected errors
    console.error('[Login API Route] Unexpected error:', error);

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

    return NextResponse.json(
      {
        success: false,
        message: `Server error: ${errorMessage}. Please check if the backend API is running.`
      },
      { status: 500 }
    );
  }
}
