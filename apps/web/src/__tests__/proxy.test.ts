import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { proxy } from '../proxy';

// Mock next/server without requireActual (avoids needing Web Request/Response globals)
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    next: jest.fn((_opts?: unknown) => ({ type: 'next' })),
    redirect: jest.fn((url: unknown) => ({ url, type: 'redirect' })),
  },
}));

// Mock Supabase SSR client
const mockGetUser = jest.fn();
const mockFrom = jest.fn();

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}));

// Set env vars for Supabase
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

function createMockRequest(pathname: string, host = 'localhost'): NextRequest {
  return {
    nextUrl: {
      pathname,
      href: `http://${host}${pathname}`,
      clone: jest.fn().mockReturnThis(),
    },
    url: `http://${host}${pathname}`,
    headers: {
      get: (key: string) => (key.toLowerCase() === 'host' ? host : null),
    },
    cookies: {
      get: jest.fn(),
      getAll: jest.fn().mockReturnValue([]),
      set: jest.fn(),
    },
  } as unknown as NextRequest;
}

describe('Proxy (auth gating)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows public routes without authentication', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = createMockRequest('/auth/login');
    await proxy(req);

    expect(NextResponse.redirect).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated users from protected routes to login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = createMockRequest('/dashboard');
    await proxy(req);

    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectUrl = (NextResponse.redirect as jest.Mock).mock.calls[0][0];
    expect(redirectUrl.pathname).toBe('/auth/login');
  });

  it('allows authenticated users with completed setup to access dashboard', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    });
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { setup_completed: true },
      }),
    });

    const req = createMockRequest('/dashboard');
    await proxy(req);

    // Should not redirect away from dashboard
    const redirectCalls = (NextResponse.redirect as jest.Mock).mock.calls;
    const dashboardRedirect = redirectCalls.find(
      (call: unknown[]) => (call[0] as URL)?.pathname === '/onboarding/financial-profile'
    );
    expect(dashboardRedirect).toBeUndefined();
  });

  it('redirects authenticated users without completed setup to onboarding', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    });
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { setup_completed: false },
      }),
    });

    const req = createMockRequest('/dashboard');
    await proxy(req);

    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectUrl = (NextResponse.redirect as jest.Mock).mock.calls.find(
      (call: unknown[]) => (call[0] as URL)?.pathname === '/onboarding/financial-profile'
    );
    expect(redirectUrl).toBeDefined();
  });

  it('redirects authenticated users from auth pages to dashboard', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    });

    const req = createMockRequest('/auth/login');
    await proxy(req);

    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectUrl = (NextResponse.redirect as jest.Mock).mock.calls[0][0];
    expect(redirectUrl.pathname).toBe('/dashboard');
  });

  it('redirects the app-subdomain root to sign-in for anonymous users', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = createMockRequest('/', 'app.lifenavigator.tech');
    await proxy(req);

    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectUrl = (NextResponse.redirect as jest.Mock).mock.calls[0][0];
    expect(redirectUrl.pathname).toBe('/auth/login');
  });

  it('redirects the app-subdomain root to dashboard for authenticated users', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-id' } } });

    const req = createMockRequest('/', 'app.lifenavigator.tech');
    await proxy(req);

    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectUrl = (NextResponse.redirect as jest.Mock).mock.calls[0][0];
    expect(redirectUrl.pathname).toBe('/dashboard');
  });

  it('serves the marketing apex root without redirecting', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = createMockRequest('/', 'lifenavigator.tech');
    await proxy(req);

    const rootRedirect = (NextResponse.redirect as jest.Mock).mock.calls.find(
      (call: unknown[]) => (call[0] as URL)?.pathname === '/auth/login'
    );
    expect(rootRedirect).toBeUndefined();
  });
});
