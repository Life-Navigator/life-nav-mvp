'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { apiClient } from '@/lib/api/client';

// Types for user data
interface UserGoals {
  financialGoals?: any;
  careerGoals?: any;
  educationGoals?: any;
  healthGoals?: any;
}

interface RiskProfile {
  riskTheta: number;
  financialRiskTolerance?: number;
  careerRiskTolerance?: number;
  healthRiskTolerance?: number;
  educationRiskTolerance?: number;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  setupCompleted: boolean;
  goals?: UserGoals;
  riskProfile?: RiskProfile;
  // Add other user-specific data as needed
}

export function useUserData() {
  const { data: session, status } = useSession();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchUserData() {
      if (status !== 'authenticated' || !session?.user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Fetch user data from the API
        const data = await apiClient.get<UserData>('/user/profile');
        setUserData(data);
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch user data'));
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [session, status]);

  return { userData, loading, error };
}

// Function to fetch domain-specific data
export function useDomainData<T>(domain: 'financial' | 'career' | 'education' | 'health', endpoint: string) {
  const { data: session, status } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchDomainData() {
      if (status !== 'authenticated' || !session?.user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Fetch domain-specific data from the API
        const responseData = await apiClient.get<T>(`/${domain}${endpoint}`);
        setData(responseData);
      } catch (err) {
        console.error(`Error fetching ${domain} data:`, err);
        setError(err instanceof Error ? err : new Error(`Failed to fetch ${domain} data`));
      } finally {
        setLoading(false);
      }
    }

    fetchDomainData();
  }, [session, status, domain, endpoint]);

  return { data, loading, error };
}