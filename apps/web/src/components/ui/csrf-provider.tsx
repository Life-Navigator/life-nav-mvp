'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface CsrfContextType {
  csrfToken: string | null;
  refreshCsrfToken: () => Promise<string>;
}

const CsrfContext = createContext<CsrfContextType>({
  csrfToken: null,
  refreshCsrfToken: async () => '',
});

export const useCsrf = () => useContext(CsrfContext);

/**
 * Provider component for CSRF protection
 * Makes CSRF tokens available to all child components
 */
export function CsrfProvider({ children }: { children: React.ReactNode }) {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  /**
   * Fetch a new CSRF token from the server
   */
  const refreshCsrfToken = async (): Promise<string> => {
    try {
      const response = await fetch('/api/auth/csrf', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch CSRF token');
      }

      const data = await response.json();
      const token = data.csrfToken;
      setCsrfToken(token);
      return token;
    } catch (error) {
      console.error('Error fetching CSRF token:', error);
      return '';
    }
  };

  // Fetch CSRF token on component mount
  useEffect(() => {
    refreshCsrfToken();

    // Token rotation - refresh every 30 minutes
    const interval = setInterval(() => {
      refreshCsrfToken();
    }, 30 * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <CsrfContext.Provider value={{ csrfToken, refreshCsrfToken }}>
      {children}
    </CsrfContext.Provider>
  );
}

/**
 * Hook to create CSRF-protected fetch function
 */
export function useCsrfFetch() {
  const { csrfToken, refreshCsrfToken } = useCsrf();

  /**
   * Fetch function that automatically includes CSRF token
   */
  const fetchWithCsrf = async (url: string, options: RequestInit = {}) => {
    // Ensure we have a valid CSRF token
    let token = csrfToken;
    if (!token) {
      token = await refreshCsrfToken();
    }

    // Create headers with CSRF token
    const headers = new Headers(options.headers);
    headers.set('x-csrf-token', token);

    // If we're making a mutation request, add the token to the body as well
    if (
      ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || '') &&
      options.body &&
      typeof options.body === 'string' &&
      headers.get('content-type')?.includes('application/json')
    ) {
      try {
        const bodyData = JSON.parse(options.body);
        bodyData._csrf = token;
        options.body = JSON.stringify(bodyData);
      } catch (error) {
        console.error('Error adding CSRF token to request body:', error);
      }
    }

    // Return fetch with CSRF token included
    return fetch(url, {
      ...options,
      headers,
    });
  };

  return fetchWithCsrf;
}