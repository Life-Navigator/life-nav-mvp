'use client';

import { useSession } from '@/hooks/useSession';
import DashboardClient from '@/components/dashboard/DashboardClient';

export default function DashboardPage() {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Middleware handles redirect for unauthenticated users,
  // but guard here too for client-side navigation edge cases
  if (status === 'unauthenticated') {
    return null;
  }

  return <DashboardClient />;
}
