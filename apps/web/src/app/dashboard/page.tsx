'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardClient from '@/components/dashboard/DashboardClient';

export default function DashboardPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for JWT token in localStorage
    const token = localStorage.getItem('access_token');

    if (!token) {
      router.push('/auth/login');
    } else {
      setIsAuthenticated(true);
    }

    setIsLoading(false);
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return <DashboardClient />;
}
