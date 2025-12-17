'use client';

/**
 * Google Connect Component
 *
 * Handles Google OAuth connection for various Google services.
 */

import { useState, useEffect } from 'react';
import { SCOPE_BUNDLES } from '@/lib/integrations/google/oauth';

type ServiceBundle = keyof typeof SCOPE_BUNDLES;

interface GoogleService {
  id: ServiceBundle;
  name: string;
  description: string;
  icon: string;
}

const GOOGLE_SERVICES: GoogleService[] = [
  {
    id: 'calendar',
    name: 'Google Calendar',
    description: 'Sync your calendar events and schedule',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Read and send emails',
    icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
  {
    id: 'drive',
    name: 'Google Drive',
    description: 'Access and organize your files',
    icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  },
  {
    id: 'tasks',
    name: 'Google Tasks',
    description: 'Sync your task lists',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  },
  {
    id: 'contacts',
    name: 'Google Contacts',
    description: 'Access your contacts',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  },
  {
    id: 'fitness',
    name: 'Google Fit / Health Connect',
    description: 'Sync health and fitness data',
    icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  },
  {
    id: 'meet',
    name: 'Google Meet',
    description: 'Create and manage meetings',
    icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  },
  {
    id: 'chat',
    name: 'Google Chat',
    description: 'Access chat spaces and messages',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  },
];

interface GoogleConnectProps {
  connectedServices?: string[];
  connectedEmail?: string;
  onConnect?: (services: string[]) => void;
  onDisconnect?: () => void;
}

export function GoogleConnect({
  connectedServices = [],
  connectedEmail,
  onConnect,
  onDisconnect,
}: GoogleConnectProps) {
  const [selectedServices, setSelectedServices] = useState<Set<ServiceBundle>>(
    new Set(['basic'])
  );
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const isConnected = connectedServices.length > 0;

  const toggleService = (serviceId: ServiceBundle) => {
    const newSelected = new Set(selectedServices);
    if (newSelected.has(serviceId)) {
      newSelected.delete(serviceId);
    } else {
      newSelected.add(serviceId);
    }
    setSelectedServices(newSelected);
  };

  const handleConnect = async () => {
    setLoading(true);

    try {
      // Build URL with selected bundles
      const bundles = Array.from(selectedServices).join(',');
      const response = await fetch(
        `/api/integrations/oauth/google?bundles=${bundles}&redirect=/settings/integrations`,
        { method: 'GET', redirect: 'manual' }
      );

      // If we get a redirect, navigate to it
      if (response.type === 'opaqueredirect' || response.status === 302) {
        // For POST method, get the auth URL
        const postResponse = await fetch('/api/integrations/oauth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bundles: Array.from(selectedServices),
            redirect: '/settings/integrations',
          }),
        });

        if (postResponse.ok) {
          const data = await postResponse.json();
          window.location.href = data.authUrl;
        }
      } else {
        // Direct redirect for GET
        window.location.href = `/api/integrations/oauth/google?bundles=${bundles}&redirect=/settings/integrations`;
      }
    } catch (err) {
      console.error('Failed to initiate OAuth:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);

    try {
      const response = await fetch('/api/integrations/google/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        onDisconnect?.();
      }
    } catch (err) {
      console.error('Failed to disconnect:', err);
    } finally {
      setDisconnecting(false);
    }
  };

  if (isConnected) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Google Connected
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {connectedEmail}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            Connected
          </span>
        </div>

        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Connected Services
          </h4>
          <div className="flex flex-wrap gap-2">
            {connectedServices.map((service) => (
              <span
                key={service}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
              >
                {service.charAt(0).toUpperCase() + service.slice(1)}
              </span>
            ))}
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleConnect}
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Add More Services'}
          </button>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-600 dark:border-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
          >
            {disconnecting ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-gray-500" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Connect Google Account
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select which Google services to connect
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {GOOGLE_SERVICES.map((service) => {
          const isSelected = selectedServices.has(service.id);
          return (
            <button
              key={service.id}
              onClick={() => toggleService(service.id)}
              className={`flex items-start p-3 rounded-lg border-2 transition-colors text-left ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${
                  isSelected
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={service.icon}
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`font-medium text-sm ${
                    isSelected
                      ? 'text-blue-900 dark:text-blue-100'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {service.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {service.description}
                </p>
              </div>
              {isSelected && (
                <svg
                  className="w-5 h-5 text-blue-500 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={handleConnect}
        disabled={loading || selectedServices.size === 0}
        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {loading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Connecting...
          </>
        ) : (
          <>
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Connect with Google
          </>
        )}
      </button>
    </div>
  );
}

export default GoogleConnect;
