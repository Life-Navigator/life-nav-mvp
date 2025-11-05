'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsProfileRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the main profile page
    router.replace('/dashboard/profile');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-gray-600 dark:text-gray-400">Redirecting to profile...</div>
    </div>
  );
}
