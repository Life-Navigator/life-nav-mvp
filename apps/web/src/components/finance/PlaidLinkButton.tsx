'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink, PlaidLinkOnSuccess, PlaidLinkOnExit } from 'react-plaid-link';

interface PlaidLinkButtonProps {
  onSuccess?: (publicToken: string, metadata: unknown) => void;
  onExit?: () => void;
  buttonText?: string;
  className?: string;
  disabled?: boolean;
}

export function PlaidLinkButton({
  onSuccess,
  onExit,
  buttonText = 'Connect Bank Account',
  className = '',
  disabled = false,
}: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch link token on mount
  useEffect(() => {
    const fetchLinkToken = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/plaid/link-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create link token');
        }

        const data = await response.json();
        setLinkToken(data.linkToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize Plaid');
        console.error('Error fetching link token:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLinkToken();
  }, []);

  const handleSuccess = useCallback<PlaidLinkOnSuccess>(
    async (publicToken, metadata) => {
      try {
        setLoading(true);
        // Exchange public token for access token
        const response = await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicToken }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to exchange token');
        }

        const data = await response.json();
        console.log('Successfully connected bank:', data.institutionName);

        // Trigger initial sync
        await fetch('/api/plaid/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: data.itemId }),
        });

        onSuccess?.(publicToken, metadata);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect bank');
        console.error('Error exchanging token:', err);
      } finally {
        setLoading(false);
      }
    },
    [onSuccess]
  );

  const handleExit = useCallback<PlaidLinkOnExit>(
    (err) => {
      if (err) {
        console.error('Plaid Link exit error:', err);
      }
      onExit?.();
    },
    [onExit]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: handleExit,
  });

  const isDisabled = disabled || !ready || loading || !linkToken;

  return (
    <div>
      <button
        onClick={() => open()}
        disabled={isDisabled}
        className={`inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Connecting...
          </>
        ) : (
          <>
            <svg
              className="-ml-1 mr-2 h-5 w-5"
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
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

export default PlaidLinkButton;
