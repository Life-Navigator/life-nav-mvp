'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Breadcrumbs from '@/components/layout/Breadcrumbs';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const isChatPage = pathname === '/dashboard/roadmap/chat';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Sidebar component */}
      <Sidebar collapsed={isChatPage} />

      {/* Main content area */}
      {isChatPage ? (
        // Chat page takes full width with no padding/header
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      ) : (
        <div className="flex flex-col flex-1 w-full">
          {/* Header component */}
          <Header />

          {/* Breadcrumbs */}
          <div className="px-4 sm:px-6 lg:px-8 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <Breadcrumbs />
          </div>

          {/* Main content with scrolling */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      )}
    </div>
  );
}