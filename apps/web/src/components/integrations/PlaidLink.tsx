'use client';

/**
 * Plaid Link Component
 *
 * Handles financial account linking through Plaid Link.
 */

import { useState, useCallback, useEffect } from 'react';
import { usePlaidLink, PlaidLinkOptions, PlaidLinkOnSuccess } from 'react-plaid-link';

interface PlaidLinkProps {
  onSuccess?: (publicToken: string, metadata: any) => void;
  onExit?: () => void;
  onError?: (error: string) => void;
  buttonText?: string;
  className?: string;
  disabled?: boolean;
}

export function PlaidLinkButton({
  onSuccess,
  onExit,
  onError,
  buttonText = 'Connect Bank Account',
  className,
  disabled,
}: PlaidLinkProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exchanging, setExchanging] = useState(false);

  // Fetch link token on mount
  useEffect(() => {
    const fetchLinkToken = async () => {
      try {
        const response = await fetch('/api/integrations/plaid/link-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            products: ['auth', 'transactions'],
            country_codes: ['US'],
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to create link token');
        }

        const data = await response.json();
        setLinkToken(data.linkToken);
      } catch (err) {
        console.error('Failed to fetch link token:', err);
        onError?.((err as Error).message);
      }
    };

    fetchLinkToken();
  }, [onError]);

  const handleSuccess: PlaidLinkOnSuccess = useCallback(
    async (publicToken, metadata) => {
      setExchanging(true);

      try {
        // Exchange public token for access token
        const response = await fetch('/api/integrations/plaid/exchange', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            publicToken,
            institutionId: metadata.institution?.institution_id,
            institutionName: metadata.institution?.name,
            accounts: metadata.accounts,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to exchange token');
        }

        onSuccess?.(publicToken, metadata);
      } catch (err) {
        console.error('Failed to exchange token:', err);
        onError?.((err as Error).message);
      } finally {
        setExchanging(false);
      }
    },
    [onSuccess, onError]
  );

  const config: PlaidLinkOptions = {
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: (err) => {
      if (err) {
        console.error('Plaid Link error:', err);
        onError?.(err.display_message || 'An error occurred');
      }
      onExit?.();
    },
  };

  const { open, ready } = usePlaidLink(config);

  const handleClick = () => {
    if (ready && linkToken) {
      open();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || !ready || !linkToken || exchanging}
      className={`inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed ${className || ''}`}
    >
      {exchanging ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
      ) : !ready || !linkToken ? (
        'Loading...'
      ) : (
        <>
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
          {buttonText}
        </>
      )}
    </button>
  );
}

interface LinkedAccount {
  id: string;
  name: string;
  mask: string;
  type: string;
  subtype: string;
  institutionName: string;
  currentBalance: number | null;
  availableBalance: number | null;
  isConnected: boolean;
}

interface PlaidAccountsListProps {
  accounts: LinkedAccount[];
  onDisconnect?: (accountId: string) => void;
  onRefresh?: () => void;
}

export function PlaidAccountsList({
  accounts,
  onDisconnect,
  onRefresh,
}: PlaidAccountsListProps) {
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const handleDisconnect = async (accountId: string) => {
    setDisconnecting(accountId);
    try {
      await onDisconnect?.(accountId);
    } finally {
      setDisconnecting(null);
    }
  };

  if (accounts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
          />
        </svg>
        <p className="mt-2">No accounts connected yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Connected Accounts
        </h3>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Refresh
          </button>
        )}
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="py-4 flex items-center justify-between"
          >
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {account.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {account.institutionName} ****{account.mask}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {account.currentBalance !== null && (
                <span className="text-gray-900 dark:text-white font-medium">
                  ${account.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              )}
              {onDisconnect && (
                <button
                  onClick={() => handleDisconnect(account.id)}
                  disabled={disconnecting === account.id}
                  className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {disconnecting === account.id ? 'Disconnecting...' : 'Disconnect'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PlaidLinkButton;
