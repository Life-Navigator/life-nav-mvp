'use client';

import React from 'react';

interface AddAccountButtonProps {
  onClick: () => void;
}

export default function AddAccountButton({ onClick }: AddAccountButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center w-full p-4 bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
    >
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-blue-600 dark:text-blue-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h3 className="text-base font-medium text-gray-900 dark:text-white">Connect Account</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">
          Add a new financial account
        </p>
      </div>
    </button>
  );
}