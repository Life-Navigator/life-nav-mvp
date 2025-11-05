"use client";

import React from 'react';
import Link from 'next/link';

// Inline ComingSoon component to avoid import issues
function ComingSoon() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
      <div className="w-20 h-20 mb-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-600">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </div>
      
      <h1 className="text-3xl font-bold mb-4">Coming Soon</h1>
      <p className="mb-8 text-lg text-gray-600 dark:text-gray-400 max-w-md">
        We're working hard to bring you this feature. Please check back soon!
      </p>
      
      <Link 
        href="/dashboard"
        className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}

export default function EducationCertificationsPage() {
  return <ComingSoon />;
}