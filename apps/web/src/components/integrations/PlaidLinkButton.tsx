'use client';

import { useState, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { getSupabaseClient } from '@/lib/supabase/client';

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
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('Supabase not configured');

      const { data, error } = await supabase.functions.invoke('plaid-link-token', {
        body: { products: ['auth', 'transactions'] },
      });

      if (error) throw new Error(error.message || 'Failed to create link token');
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
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Supabase not configured');

        const { data, error } = await supabase.functions.invoke('plaid-exchange', {
          body: {
            publicToken,
            institutionId: metadata.institution?.institution_id,
            institutionName: metadata.institution?.name,
          },
        });

        if (error) throw new Error(error.message || 'Failed to exchange token');
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
