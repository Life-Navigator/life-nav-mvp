'use client';

import { Fragment, useRef, useCallback, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import Link from 'next/link';
import { useFileUpload, UPLOAD_CONFIGS, type UploadDomain } from '@/lib/hooks/useFileUpload';

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
      { name: 'Plaid', description: 'Connect your bank accounts', icon: '🏦', provider: 'plaid' },
      { name: 'QuickBooks', description: 'Sync with QuickBooks', icon: '📊', provider: 'quickbooks' },
      { name: 'YNAB', description: 'Import from You Need A Budget', icon: '💰', provider: 'ynab' },
    ],
    uploadFormats: ['CSV', 'Excel', 'QFX', 'OFX'],
    manualInputPath: '/dashboard/finance/add',
  },
  health: {
    title: 'Add Health Data',
    color: 'red',
    integrations: [
      { name: 'Apple Health', description: 'Sync with Apple Health', icon: '🍎', provider: 'apple_health' },
      { name: 'Google Fit', description: 'Connect Google Fit', icon: '💪', provider: 'google_fit' },
      { name: 'MyChart', description: 'Import medical records', icon: '🏥', provider: 'mychart' },
    ],
    uploadFormats: ['CSV', 'PDF', 'HL7', 'FHIR'],
    manualInputPath: '/dashboard/healthcare/add',
  },
  career: {
    title: 'Add Career Data',
    color: 'blue',
    integrations: [
      { name: 'LinkedIn', description: 'Import LinkedIn profile', icon: '💼', provider: 'linkedin' },
      { name: 'Indeed', description: 'Sync job applications', icon: '📝', provider: 'indeed' },
      { name: 'Glassdoor', description: 'Connect Glassdoor', icon: '🔍', provider: 'glassdoor' },
    ],
    uploadFormats: ['CSV', 'PDF', 'JSON'],
    manualInputPath: '/dashboard/career/add',
  },
  education: {
    title: 'Add Education Data',
    color: 'indigo',
    integrations: [
      { name: 'Coursera', description: 'Import Coursera courses', icon: '🎓', provider: 'coursera' },
      { name: 'Udemy', description: 'Sync Udemy progress', icon: '📚', provider: 'udemy' },
      { name: 'LinkedIn Learning', description: 'Connect LinkedIn Learning', icon: '🎯', provider: 'linkedin_learning' },
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
    progressBg: 'bg-green-500',
  },
  red: {
    border: 'border-red-600 dark:border-red-500',
    bg: 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600',
    text: 'text-red-600 dark:text-red-400',
    hoverBg: 'hover:bg-red-50 dark:hover:bg-red-900/20',
    hoverBorder: 'hover:border-red-500 dark:hover:border-red-400',
    progressBg: 'bg-red-500',
  },
  blue: {
    border: 'border-blue-600 dark:border-blue-500',
    bg: 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
    text: 'text-blue-600 dark:text-blue-400',
    hoverBg: 'hover:bg-blue-50 dark:hover:bg-blue-900/20',
    hoverBorder: 'hover:border-blue-500 dark:hover:border-blue-400',
    progressBg: 'bg-blue-500',
  },
  indigo: {
    border: 'border-indigo-600 dark:border-indigo-500',
    bg: 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600',
    text: 'text-indigo-600 dark:text-indigo-400',
    hoverBg: 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20',
    hoverBorder: 'hover:border-indigo-500 dark:hover:border-indigo-400',
    progressBg: 'bg-indigo-500',
  },
};

/**
 * Integration connection component
 */
function IntegrationButton({
  integration,
  colors,
  onConnect,
}: {
  integration: { name: string; description: string; icon: string; provider: string };
  colors: typeof colorClasses[keyof typeof colorClasses];
  onConnect: (provider: string) => void;
}) {
  return (
    <button
      onClick={() => onConnect(integration.provider)}
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
  );
}

/**
 * File upload dropzone component
 */
function UploadDropzone({
  domain,
  colors,
  onUploadSuccess,
}: {
  domain: UploadDomain;
  colors: typeof colorClasses[keyof typeof colorClasses];
  onUploadSuccess?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadConfig = UPLOAD_CONFIGS[domain];

  const {
    state,
    isDragOver,
    handleFileSelect,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    reset,
    abort,
    acceptedMimeTypes,
    maxSizeMB,
  } = useFileUpload({
    ...uploadConfig,
    onSuccess: () => {
      onUploadSuccess?.();
    },
  });

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Reset on domain change
  useEffect(() => {
    reset();
  }, [domain, reset]);

  const isUploading = state.status === 'uploading' || state.status === 'validating';
  const isSuccess = state.status === 'success';
  const isError = state.status === 'error';

  return (
    <div className="space-y-3">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedMimeTypes}
        onChange={handleFileSelect}
        className="hidden"
        aria-label="File upload input"
      />

      {/* Dropzone */}
      <button
        type="button"
        onClick={openFileDialog}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        disabled={isUploading}
        className={`
          w-full p-6 border-2 border-dashed rounded-lg transition-all cursor-pointer
          ${isDragOver
            ? `${colors.border} ${colors.hoverBg}`
            : 'border-gray-300 dark:border-gray-600'
          }
          ${!isUploading && !isDragOver ? `${colors.hoverBg} ${colors.hoverBorder}` : ''}
          ${isUploading ? 'cursor-not-allowed opacity-75' : ''}
          ${isSuccess ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}
          ${isError ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''}
        `}
      >
        <div className="flex flex-col items-center">
          {/* Icon */}
          {isSuccess ? (
            <svg className="w-10 h-10 text-green-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : isError ? (
            <svg className="w-10 h-10 text-red-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : isUploading ? (
            <svg className="w-10 h-10 text-gray-400 mb-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg className="w-10 h-10 text-gray-400 dark:text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          )}

          {/* Text */}
          {isSuccess ? (
            <div className="text-center">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                Upload complete!
              </p>
              <p className="text-xs text-green-500 dark:text-green-400 mt-1">
                {state.file?.name}
              </p>
            </div>
          ) : isError ? (
            <div className="text-center">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                Upload failed
              </p>
              <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                {state.error}
              </p>
            </div>
          ) : isUploading ? (
            <div className="text-center w-full">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {state.status === 'validating' ? 'Validating file...' : 'Uploading...'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate max-w-[200px]">
                {state.file?.name}
              </p>
              {/* Progress bar */}
              <div className="w-full mt-3 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`${colors.progressBg} h-2 rounded-full transition-all duration-300`}
                  style={{ width: `${state.progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{state.progress}%</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {isDragOver ? 'Drop file here' : 'Click to upload or drag and drop'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {uploadConfig.formats.join(', ')} (max {maxSizeMB}MB)
              </p>
            </div>
          )}
        </div>
      </button>

      {/* Action buttons */}
      {(isSuccess || isError || isUploading) && (
        <div className="flex justify-center gap-2">
          {isUploading && (
            <button
              onClick={abort}
              className="px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            >
              Cancel
            </button>
          )}
          {(isSuccess || isError) && (
            <button
              onClick={reset}
              className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              Upload another file
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Main AddDataModal component
 */
export default function AddDataModal({ isOpen, onClose, domain }: AddDataModalProps) {
  const config = domainConfig[domain];
  const colors = colorClasses[config.color as keyof typeof colorClasses];
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  const handleIntegrationConnect = useCallback(async (provider: string) => {
    setConnectingProvider(provider);

    try {
      // Initiate OAuth flow or integration connection
      const response = await fetch(`/api/integrations/${domain}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.authUrl) {
          // Redirect to OAuth
          window.location.href = data.authUrl;
        } else {
          // Show success or next steps
          alert(`Successfully initiated connection to ${provider}`);
        }
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to connect integration');
      }
    } catch (error) {
      console.error('Integration connection error:', error);
      alert('Failed to connect. Please try again.');
    } finally {
      setConnectingProvider(null);
    }
  }, [domain]);

  const handleUploadSuccess = useCallback(() => {
    // Could close modal or show success message
    // For now, let user upload more files if needed
  }, []);

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
                          Connect Integration
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Automatically sync data from third-party services
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {config.integrations.map((integration) => (
                        <div key={integration.name} className="relative">
                          <IntegrationButton
                            integration={integration}
                            colors={colors}
                            onConnect={handleIntegrationConnect}
                          />
                          {connectingProvider === integration.provider && (
                            <div className="absolute inset-0 bg-white/75 dark:bg-gray-800/75 rounded-lg flex items-center justify-center">
                              <svg className="w-6 h-6 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Upload Option */}
                  <div className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                          Upload Data
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Import from a file with automatic processing
                        </p>
                      </div>
                    </div>
                    <UploadDropzone
                      domain={domain}
                      colors={colors}
                      onUploadSuccess={handleUploadSuccess}
                    />
                  </div>

                  {/* Manual Input Option */}
                  <div className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                          Manual Input
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
