import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface UseAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
}

/**
 * Custom hook for JWT authentication
 * Replaces useSession from next-auth for apps using custom JWT tokens
 */
export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Check for JWT token in localStorage
    const accessToken = localStorage.getItem('access_token');

    if (!accessToken) {
      router.push('/auth/login');
      setIsLoading(false);
      return;
    }

    setToken(accessToken);
    setIsAuthenticated(true);
    setIsLoading(false);
  }, [router]);

  return {
    isAuthenticated,
    isLoading,
    token,
  };
}

/**
 * Helper to get auth headers for API requests
 */
export function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token');

  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
}
