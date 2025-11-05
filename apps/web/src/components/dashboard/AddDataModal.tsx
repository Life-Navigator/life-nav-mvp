'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import Link from 'next/link';

interface AddDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: 'financial' | 'health' | 'career' | 'education';
}

const domainConfig = {
  financial: {
    title: 'Add Financial Data',
    color: 'green',
    integrations: [
      { name: 'Plaid', description: 'Connect your bank accounts', icon: '🏦' },
      { name: 'QuickBooks', description: 'Sync with QuickBooks', icon: '📊' },
      { name: 'YNAB', description: 'Import from You Need A Budget', icon: '💰' },
    ],
    uploadFormats: ['CSV', 'Excel', 'QFX', 'OFX'],
    manualInputPath: '/dashboard/finance/add',
  },
  health: {
    title: 'Add Health Data',
    color: 'red',
    integrations: [
      { name: 'Apple Health', description: 'Sync with Apple Health', icon: '🍎' },
      { name: 'Google Fit', description: 'Connect Google Fit', icon: '💪' },
      { name: 'MyChart', description: 'Import medical records', icon: '🏥' },
    ],
    uploadFormats: ['CSV', 'PDF', 'HL7', 'FHIR'],
    manualInputPath: '/dashboard/healthcare/add',
  },
  career: {
    title: 'Add Career Data',
    color: 'blue',
    integrations: [
      { name: 'LinkedIn', description: 'Import LinkedIn profile', icon: '💼' },
      { name: 'Indeed', description: 'Sync job applications', icon: '📝' },
      { name: 'Glassdoor', description: 'Connect Glassdoor', icon: '🔍' },
    ],
    uploadFormats: ['CSV', 'PDF', 'JSON'],
    manualInputPath: '/dashboard/career/add',
  },
  education: {
    title: 'Add Education Data',
    color: 'indigo',
    integrations: [
      { name: 'Coursera', description: 'Import Coursera courses', icon: '🎓' },
      { name: 'Udemy', description: 'Sync Udemy progress', icon: '📚' },
      { name: 'LinkedIn Learning', description: 'Connect LinkedIn Learning', icon: '🎯' },
    ],
    uploadFormats: ['CSV', 'PDF', 'JSON'],
    manualInputPath: '/dashboard/education/add',
  },
};

const colorClasses = {
  green: {
    border: 'border-green-600 dark:border-green-500',
    bg: 'bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600',
    text: 'text-green-600 dark:text-green-400',
    hoverBg: 'hover:bg-green-50 dark:hover:bg-green-900/20',
    hoverBorder: 'hover:border-green-500 dark:hover:border-green-400',
  },
  red: {
    border: 'border-red-600 dark:border-red-500',
    bg: 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600',
    text: 'text-red-600 dark:text-red-400',
    hoverBg: 'hover:bg-red-50 dark:hover:bg-red-900/20',
    hoverBorder: 'hover:border-red-500 dark:hover:border-red-400',
  },
  blue: {
    border: 'border-blue-600 dark:border-blue-500',
    bg: 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
    text: 'text-blue-600 dark:text-blue-400',
    hoverBg: 'hover:bg-blue-50 dark:hover:bg-blue-900/20',
    hoverBorder: 'hover:border-blue-500 dark:hover:border-blue-400',
  },
  indigo: {
    border: 'border-indigo-600 dark:border-indigo-500',
    bg: 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600',
    text: 'text-indigo-600 dark:text-indigo-400',
    hoverBg: 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20',
    hoverBorder: 'hover:border-indigo-500 dark:hover:border-indigo-400',
  },
};

export default function AddDataModal({ isOpen, onClose, domain }: AddDataModalProps) {
  const config = domainConfig[domain];
  const colors = colorClasses[config.color as keyof typeof colorClasses];

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 dark:bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all border border-gray-200 dark:border-gray-700">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-semibold leading-6 text-gray-900 dark:text-white mb-4"
                >
                  {config.title}
                </Dialog.Title>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Choose how you'd like to add your {domain} data:
                </p>

                <div className="space-y-4">
                  {/* Integration Option */}
                  <div className={`border-2 ${colors.border} rounded-lg p-4`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                          🔗 Connect Integration
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Automatically sync data from third-party services
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {config.integrations.map((integration) => (
                        <button
                          key={integration.name}
                          onClick={() => {
                            // TODO: Implement integration flow
                            alert(`Connecting to ${integration.name}...`);
                          }}
                          className={`flex items-center p-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg ${colors.hoverBg} ${colors.hoverBorder} transition-all`}
                        >
                          <span className="text-2xl mr-3">{integration.icon}</span>
                          <div className="text-left">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {integration.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {integration.description}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Upload Option */}
                  <div className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                          📤 Upload Data
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Import from a file (supports {config.uploadFormats.join(', ')})
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        // TODO: Implement file upload
                        alert('File upload coming soon!');
                      }}
                      className={`w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg ${colors.hoverBg} ${colors.hoverBorder} transition-all`}
                    >
                      <div className="flex flex-col items-center">
                        <svg
                          className="w-8 h-8 text-gray-400 dark:text-gray-500 mb-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {config.uploadFormats.join(', ')}
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* Manual Input Option */}
                  <div className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                          ✏️ Manual Input
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Enter your data manually using our form
                        </p>
                      </div>
                    </div>
                    <Link
                      href={config.manualInputPath}
                      className={`flex items-center justify-center w-full px-4 py-3 text-sm font-medium text-white ${colors.bg} rounded-lg transition-colors`}
                    >
                      Start Manual Entry
                    </Link>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
