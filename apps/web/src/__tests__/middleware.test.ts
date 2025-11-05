import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '../middleware';
import { getToken } from 'next-auth/jwt';

// Mock next-auth/jwt
jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
}));

// Mock NextResponse
jest.mock('next/server', () => {
  const originalModule = jest.requireActual('next/server');
  return {
    ...originalModule,
    NextResponse: {
      next: jest.fn(() => 'next_response'),
      redirect: jest.fn((url) => ({ url, type: 'redirect' })),
    },
  };
});

describe('Middleware', () => {
  let mockRequest: NextRequest;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up a mock request
    mockRequest = {
      nextUrl: {
        pathname: '/',
        href: 'http://localhost:3000/',
        clone: jest.fn().mockReturnThis(),
      },
      url: 'http://localhost:3000/',
    } as unknown as NextRequest;
    
    // Reset the mock for getToken to avoid test interference
    (getToken as jest.Mock).mockReset();
  });
  
  it('redirects unauthenticated users to login page', async () => {
    // Mock unauthenticated user
    (getToken as jest.Mock).mockResolvedValue(null);
    
    await middleware(mockRequest);
    
    expect(NextResponse.redirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'http://localhost:3000/auth/login' })
    );
  });
  
  it('redirects authenticated users with completed setup to dashboard', async () => {
    // Mock authenticated user with completed setup
    (getToken as jest.Mock).mockResolvedValue({
      user: { setupCompleted: true },
      sub: 'user-id',
    });
    
    mockRequest.nextUrl.pathname = '/';
    
    await middleware(mockRequest);
    
    expect(NextResponse.redirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'http://localhost:3000/dashboard' })
    );
  });
  
  it('redirects authenticated users without completed setup to onboarding', async () => {
    // Mock authenticated user without completed setup
    (getToken as jest.Mock).mockResolvedValue({
      user: { setupCompleted: false },
      sub: 'user-id',
    });
    
    mockRequest.nextUrl.pathname = '/';
    
    await middleware(mockRequest);
    
    expect(NextResponse.redirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: expect.stringContaining('/onboarding/questionnaire?userId=user-id') })
    );
  });
  
  it('redirects from dashboard to onboarding if setup not completed', async () => {
    // Mock authenticated user without completed setup
    (getToken as jest.Mock).mockResolvedValue({
      user: { setupCompleted: false },
      sub: 'user-id',
    });
    
    mockRequest.nextUrl.pathname = '/dashboard';
    
    await middleware(mockRequest);
    
    expect(NextResponse.redirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: expect.stringContaining('/onboarding/questionnaire?userId=user-id') })
    );
  });
  
  it('redirects from protected route to login if not authenticated', async () => {
    // Mock unauthenticated user
    (getToken as jest.Mock).mockResolvedValue(null);
    
    mockRequest.nextUrl.pathname = '/dashboard';
    
    await middleware(mockRequest);
    
    expect(NextResponse.redirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'http://localhost:3000/auth/login' })
    );
  });
  
  it('allows authenticated users to access protected routes if setup completed', async () => {
    // Mock authenticated user with completed setup
    (getToken as jest.Mock).mockResolvedValue({
      user: { setupCompleted: true },
      sub: 'user-id',
    });
    
    mockRequest.nextUrl.pathname = '/dashboard';
    
    await middleware(mockRequest);
    
    expect(NextResponse.next).toHaveBeenCalled();
  });
  
  it('allows public routes without authentication', async () => {
    // Mock unauthenticated user
    (getToken as jest.Mock).mockResolvedValue(null);
    
    mockRequest.nextUrl.pathname = '/auth/login';
    
    await middleware(mockRequest);
    
    expect(NextResponse.next).toHaveBeenCalled();
  });
});