'use client';

import React, { useState } from 'react';
import { ArrowUpTrayIcon, QrCodeIcon } from '@heroicons/react/24/outline';

export default function TestModalPage() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);

  return (
    <div className="py-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Test Document Upload Modal</h1>
        
        <div className="flex space-x-4 mb-8">
          <button 
            onClick={() => setShowScanModal(true)}
            className="flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <QrCodeIcon className="h-5 w-5 mr-2" />
            Open Scan Modal
          </button>
          <button 
            onClick={() => setShowUploadModal(true)}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 shadow-sm transition-colors"
          >
            <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
            Open Upload Modal
          </button>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <p>
            Click the buttons above to test if the modals appear correctly. This helps us diagnose if there's any issue with the modal functionality.
          </p>
          <pre className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-md overflow-auto">
            {`Current State:
- showUploadModal: ${showUploadModal}
- showScanModal: ${showScanModal}`}
          </pre>
        </div>
      </div>
      
      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Test Upload Modal</h3>
              <button 
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 border rounded">
              <p>If you can see this, the upload modal is working correctly!</p>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Close Modal
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Scan Modal */}
      {showScanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Test Scan Modal</h3>
              <button 
                onClick={() => setShowScanModal(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 border rounded">
              <p>If you can see this, the scan modal is working correctly!</p>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowScanModal(false)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Close Modal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}