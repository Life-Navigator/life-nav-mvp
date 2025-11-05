'use client';

import React, { ReactNode } from 'react';
import { CareerSidebar } from '@/components/domain/career/CareerSidebar';

interface CareerLayoutProps {
  children: ReactNode;
}

export default function CareerLayout({ children }: CareerLayoutProps) {
  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900">
      {/* Career Sidebar */}
      <CareerSidebar />
      
      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}