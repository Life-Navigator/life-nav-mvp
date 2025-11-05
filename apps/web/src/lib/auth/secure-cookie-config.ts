import { CookieOption, CookieOptions } from 'next-auth/core/types';
import type { RequestCookies } from 'next/dist/compiled/@edge-runtime/cookies';
import { CookieSerializeOptions } from 'cookie';

// Type for NextAuth.js cookie options
export type SessionCookieOptions = Partial<CookieSerializeOptions> & { name?: string };

/**
 * Creates secure cookie configuration based on environment
 * @param env Development or production environment
 * @returns Secure cookie configuration
 */
export function createSecureCookieConfig(env: 'development' | 'production' = process.env.NODE_ENV as 'development' | 'production'): CookieOptions {
  // Common cookie options
  const common: Partial<CookieOption> = {
    // 8 hours in seconds
    maxAge: 8 * 60 * 60,
  };

  // Production cookie options
  if (env === 'production') {
    return {
      sessionToken: {
        ...common,
        name: 'next-auth.session-token',
        options: {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          path: '/',
          domain: process.env.COOKIE_DOMAIN, // e.g., .yourdomain.com
        },
      },
      callbackUrl: {
        ...common,
        name: 'next-auth.callback-url',
        options: {
          httpOnly: true, 
          secure: true,
          sameSite: 'lax',
          path: '/',
        },
      },
      csrfToken: {
        ...common,
        name: 'next-auth.csrf-token',
        options: {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          path: '/',
        },
      },
    };
  }

  // Development cookie options
  return {
    sessionToken: {
      ...common,
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      },
    },
    callbackUrl: {
      ...common,
      name: 'next-auth.callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      },
    },
    csrfToken: {
      ...common,
      name: 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      },
    },
  };
}

/**
 * Parses authorization header or session cookie
 * @param cookies Request cookies
 * @param authHeader Authorization header value
 * @returns Session token if valid
 */
export function parseAuthHeader(cookies: RequestCookies, authHeader?: string | null): string | null {
  // If authorization header exists and starts with Bearer, use it
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Otherwise get from cookie
  return cookies.get('next-auth.session-token')?.value || null;
}

/**
 * Sets secure cookie options on a cookie string
 * @param cookieString Cookie header string
 * @returns Modified cookie with secure options
 */
export function setSecureCookieOptions(cookieString: string): string {
  // Add secure attributes if not already present
  if (!cookieString.includes('SameSite=')) {
    cookieString += '; SameSite=Lax';
  }
  
  if (!cookieString.includes('Secure') && process.env.NODE_ENV === 'production') {
    cookieString += '; Secure';
  }
  
  if (!cookieString.includes('HttpOnly')) {
    cookieString += '; HttpOnly';
  }
  
  // Add path if not present
  if (!cookieString.includes('Path=')) {
    cookieString += '; Path=/';
  }
  
  return cookieString;
}