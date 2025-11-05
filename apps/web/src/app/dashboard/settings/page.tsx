'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataExportButton } from '@/components/settings/DataExportButton';
import { DeleteAccountModal } from '@/components/settings/DeleteAccountModal';

export default function SettingsPage() {
  const router = useRouter();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const settingsSections = [
    {
      id: 'profile',
      name: 'Profile',
      description: 'Manage your personal information',
      url: '/dashboard/profile',
      icon: '👤',
    },
    {
      id: 'preferences',
      name: 'Preferences',
      description: 'Customize your dashboard experience',
      url: '/dashboard/settings/preferences',
      icon: '⚙️',
    },
    {
      id: 'notifications',
      name: 'Notifications',
      description: 'Configure your notification settings',
      url: '/dashboard/settings/notifications',
      icon: '🔔',
    },
    {
      id: 'security',
      name: 'Security',
      description: 'Manage your account security',
      url: '/dashboard/settings/security',
      icon: '🔒',
    },
  ];

  // Handle sections that might not be implemented yet
  const handleCardClick = (url) => {
    router.push(url);
  };

  // Handle delete account
  const handleOpenDeleteModal = () => {
    setIsDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsSections.map((section) => (
          <div
            key={section.id}
            onClick={() => handleCardClick(section.url)}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-start">
              <div className="bg-blue-100 dark:bg-blue-900/20 rounded-lg p-3 mr-4">
                <span className="text-xl">{section.icon}</span>
              </div>
              <div>
                <h3 className="font-medium text-lg">{section.name}</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1">{section.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Advanced Settings</h2>

        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium">Data Export</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Download all your data in a portable format</p>
              </div>
              <DataExportButton
                className="bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:hover:bg-blue-800/30 text-blue-800 dark:text-blue-200 py-2 px-4 rounded-md transition-colors"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium">Delete Account</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Permanently delete your account and all data</p>
              </div>
              <button
                className="bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-800/30 text-red-800 dark:text-red-200 py-2 px-4 rounded-md transition-colors"
                onClick={handleOpenDeleteModal}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Account Modal */}
      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
      />
    </div>
  );
}