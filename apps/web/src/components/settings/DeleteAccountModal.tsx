'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/buttons/Button';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeleteAccountModal({ isOpen, onClose }: DeleteAccountModalProps) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  if (!isOpen) return null;
  
  const handleDelete = async () => {
    // Reset error state
    setError(null);
    
    // Validate inputs
    if (!password) {
      setError('Please enter your password');
      return;
    }
    
    if (confirmText !== 'DELETE') {
      setError('Please type DELETE to confirm');
      return;
    }
    
    setIsDeleting(true);
    
    try {
      const response = await fetch('/api/user/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password,
          confirmText,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete account');
      }
      
      // Sign out the user
      await signOut({ redirect: false });
      
      // Redirect to login page with a message
      router.push('/auth/login?accountDeleted=true');
    } catch (err) {
      console.error('Error deleting account:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsDeleting(false);
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          disabled={isDeleting}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">Delete Account</h2>
        
        <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-4 mb-4 rounded-md">
          <h3 className="font-semibold">Warning: This action cannot be undone</h3>
          <p className="mt-1 text-sm">
            Deleting your account will:
          </p>
          <ul className="text-sm mt-2 list-disc list-inside">
            <li>Permanently delete all your personal data</li>
            <li>Remove all your settings and preferences</li>
            <li>Delete all your roadmaps, goals, and progress</li>
            <li>Remove all your connected accounts and integrations</li>
            <li>Cancel any active subscriptions</li>
          </ul>
        </div>
        
        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-3 rounded-md mb-4 text-sm">
            {error}
          </div>
        )}
        
        <div className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Enter your password to confirm
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isDeleting}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm 
              focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500
              bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="Your current password"
            />
          </div>
          
          <div>
            <label htmlFor="confirmText" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type DELETE to confirm
            </label>
            <input
              type="text"
              id="confirmText"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={isDeleting}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm 
              focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500
              bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="DELETE"
            />
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting || confirmText !== 'DELETE' || !password}
            >
              {isDeleting ? 'Deleting...' : 'Delete My Account'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}