'use client';

import React, { ReactNode } from 'react';
import { EducationSidebar } from '@/components/domain/education/EducationSidebar';

interface EducationLayoutProps {
  children: ReactNode;
}

export default function EducationLayout({ children }: EducationLayoutProps) {
  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900">
      {/* Education Sidebar */}
      <EducationSidebar />
      
      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}