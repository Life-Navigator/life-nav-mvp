import { NextRequest, NextResponse } from 'next/server';

// Interface for registration data
interface RegisterRequestBody {
  name: string;
  email: string;
  password: string;
}

// Interface for the backend API response
interface BackendUser {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  tenant_id: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body: RegisterRequestBody = await request.json();

    // Validate required fields
    if (!body.name || !body.email || !body.password) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required fields: name, email, and password are required'
        },
        { status: 400 }
      );
    }

    // Get API base URL from environment
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1';

    console.log('[Register API Route] Calling backend:', `${apiBaseUrl}/auth/register`);

    // Call the backend API
    const response = await fetch(`${apiBaseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: body.email,
        password: body.password,
        username: body.name.toLowerCase().replace(/\s+/g, ''), // Create username from name
        full_name: body.name,
        first_name: body.name.split(' ')[0] || '',
        last_name: body.name.split(' ').slice(1).join(' ') || '',
      }),
    });

    // Get the response text first
    const responseText = await response.text();
    console.log('[Register API Route] Backend response status:', response.status);
    console.log('[Register API Route] Backend response text:', responseText);

    // Try to parse as JSON
    let data: BackendUser | { detail: string | Array<{ msg: string }> };
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Register API Route] Failed to parse backend response as JSON:', parseError);
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
      let errorMessage = 'Registration failed';

      if ('detail' in data) {
        if (typeof data.detail === 'string') {
          errorMessage = data.detail;
        } else if (Array.isArray(data.detail) && data.detail.length > 0) {
          errorMessage = data.detail.map(err => err.msg).join(', ');
        }
      }

      console.error('[Register API Route] Backend returned error:', errorMessage);

      return NextResponse.json(
        {
          success: false,
          message: errorMessage
        },
        { status: response.status }
      );
    }

    // Success - return the user data
    console.log('[Register API Route] Registration successful for user:', (data as BackendUser).email);

    return NextResponse.json(
      {
        success: true,
        message: 'Registration successful',
        user: {
          id: (data as BackendUser).id,
          email: (data as BackendUser).email,
          name: (data as BackendUser).full_name || (data as BackendUser).username,
        },
      },
      { status: 201 }
    );

  } catch (error) {
    // Handle network errors or other unexpected errors
    console.error('[Register API Route] Unexpected error:', error);

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
