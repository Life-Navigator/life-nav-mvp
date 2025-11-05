'use client';

import React from 'react';

export default function LogoTest() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-gray-900 p-4">
      <h1 className="text-2xl font-bold mb-8 text-gray-900 dark:text-white">Logo Test Page</h1>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Old Logo</h2>
        <img src="/logo.svg" alt="Old Logo" className="w-20 h-20" />
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">New Logo</h2>
        <img src="/LifeNavigator.png" alt="New Logo" className="w-20 h-20" />
      </div>
    </div>
  );
}