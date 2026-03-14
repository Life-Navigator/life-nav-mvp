'use client';

import { useState, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';

interface PlaidLinkButtonProps {
  onSuccess?: (accounts: unknown[]) => void;
  onError?: (error: string) => void;
  className?: string;
  children?: React.ReactNode;
}

export function PlaidLinkButton({ onSuccess, onError, className, children }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLinkToken = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/integrations/plaid/link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: ['auth', 'transactions'] }),
      });
      if (!res.ok) throw new Error('Failed to create link token');
      const data = await res.json();
      setLinkToken(data.linkToken);
    } catch (err) {
      onError?.((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  const handlePlaidSuccess = useCallback(
    async (publicToken: string, metadata: any) => {
      try {
        const res = await fetch('/api/integrations/plaid/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicToken,
            institutionId: metadata.institution?.institution_id,
            institutionName: metadata.institution?.name,
            accounts: metadata.accounts,
          }),
        });
        if (!res.ok) throw new Error('Failed to exchange token');
        const data = await res.json();
        onSuccess?.(data.accounts || []);
      } catch (err) {
        onError?.((err as Error).message);
      }
    },
    [onSuccess, onError]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handlePlaidSuccess,
    onExit: () => setLinkToken(null),
  });

  const handleClick = async () => {
    if (linkToken && ready) {
      open();
    } else {
      await fetchLinkToken();
    }
  };

  // Open Plaid Link automatically once we have a token
  if (linkToken && ready) {
    open();
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={
        className ||
        'inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors'
      }
    >
      {isLoading ? 'Connecting...' : children || 'Connect Bank Account'}
    </button>
  );
}
