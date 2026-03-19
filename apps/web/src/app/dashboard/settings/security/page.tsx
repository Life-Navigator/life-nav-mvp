'use client';
import React, { useState } from 'react';
import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';
import { toast } from '@/components/ui/toaster';
import { DeleteAccountModal } from '@/components/settings/DeleteAccountModal';

export default function SecuritySettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword) {
      toast({ title: 'Error', description: 'New password is required', type: 'error' });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: 'Error', description: 'New passwords do not match', type: 'error' });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: 'Error',
        description: 'Password must be at least 8 characters',
        type: 'error',
      });
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to change password');
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      toast({
        title: 'Success',
        description: 'Your password has been changed successfully.',
        type: 'success',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to change password',
        type: 'error',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Security Settings</h1>

      <DeleteAccountModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} />

      <div className="space-y-6">
        {/* Password Change */}
        <Card>
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Change Password</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Choose a strong, unique password that you don&apos;t use for other websites.
            </p>

            <form onSubmit={handleChangePassword} className="space-y-4 mt-4">
              <div>
                <label
                  htmlFor="currentPassword"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Current Password
                </label>
                <input
                  type="password"
                  id="currentPassword"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  New Password
                </label>
                <input
                  type="password"
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  required
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Must be at least 8 characters.
                </p>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Confirm New Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  required
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isChangingPassword}>
                  {isChangingPassword ? 'Changing Password...' : 'Change Password'}
                </Button>
              </div>
            </form>
          </div>
        </Card>

        {/* Two-Factor Authentication — Coming Soon */}
        <Card>
          <div className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-semibold">Two-Factor Authentication</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  Add an extra layer of security to your account by requiring a verification code in
                  addition to your password.
                </p>
              </div>
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm rounded-full">
                Coming Soon
              </span>
            </div>
          </div>
        </Card>

        {/* Danger Zone */}
        <Card>
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4 text-red-600 dark:text-red-400">
              Danger Zone
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Actions in this section can&apos;t be undone. Be careful when making changes here.
            </p>

            <div className="border border-red-300 dark:border-red-700 rounded-md p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium text-red-600 dark:text-red-400">
                    Delete Account
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                    Permanently delete your account and all associated data. This action cannot be
                    undone.
                  </p>
                </div>
                <Button variant="destructive" onClick={() => setIsDeleteModalOpen(true)}>
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
