'use client';

import React, { ReactNode } from 'react';
import { HealthSidebar } from '@/components/domain/health/HealthSidebar';

interface HealthcareLayoutProps {
  children: ReactNode;
}

export default function HealthcareLayout({ children }: HealthcareLayoutProps) {
  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900">
      {/* Healthcare Sidebar */}
      <HealthSidebar />
      
      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}