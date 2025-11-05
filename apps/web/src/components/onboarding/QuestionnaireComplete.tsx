'use client';

import React from 'react';

interface QuestionnaireCompleteProps {
  onContinue: () => void;
}

export default function QuestionnaireComplete({ onContinue }: QuestionnaireCompleteProps) {
  return (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-600 dark:text-green-300" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </div>
      
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Setup Complete!</h2>
      
      <p className="text-xl text-gray-600 dark:text-gray-300">
        Thank you for sharing your goals and preferences
      </p>
      
      <div className="bg-blue-50 dark:bg-blue-900/30 p-6 rounded-lg text-left">
        <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-300 mb-3">
          What happens next:
        </h3>
        
        <ul className="space-y-3 text-gray-600 dark:text-gray-300">
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">1.</span>
            <span>We've generated your personalized roadmaps based on your risk profile</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">2.</span>
            <span>You'll find domain-specific insights on your dashboard</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">3.</span>
            <span>You can always update your goals and preferences in settings</span>
          </li>
        </ul>
      </div>
      
      <div className="pt-6">
        <button
          onClick={onContinue}
          className="w-full sm:w-auto inline-flex justify-center items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          Go to Dashboard
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}