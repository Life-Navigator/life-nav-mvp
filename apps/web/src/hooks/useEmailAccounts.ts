import { useState, useEffect } from 'react';

type EmailAccount = {
  id: string;
  provider: string;
  email: string;
  connected: boolean;
  lastSync: string | Date;
  calendarConnected: boolean;
  calendarId?: string;
};

export function useEmailAccounts() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch email accounts
  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/email/accounts');
      
      if (!response.ok) {
        throw new Error('Failed to fetch email accounts');
      }
      
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      console.error('Error fetching email accounts:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Connect new email account
  const connectEmail = async (emailData: {
    provider: string;
    email: string;
    credentials?: any;
  }) => {
    try {
      const response = await fetch('/api/email/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to connect email account');
      }
      
      const data = await response.json();
      
      // Refresh accounts list
      await fetchAccounts();
      
      return { success: true, data };
    } catch (err) {
      console.error('Error connecting email:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'An unknown error occurred' 
      };
    }
  };

  // Disconnect email account
  const disconnectEmail = async (accountId: string) => {
    try {
      const response = await fetch(`/api/email/accounts?id=${accountId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to disconnect email account');
      }
      
      // Refresh accounts list
      await fetchAccounts();
      
      return { success: true };
    } catch (err) {
      console.error('Error disconnecting email:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'An unknown error occurred' 
      };
    }
  };

  // Sync email account
  const syncEmail = async (accountId: string) => {
    try {
      const response = await fetch(`/api/email/${accountId}/sync`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync email account');
      }
      
      const data = await response.json();
      
      // Refresh accounts list
      await fetchAccounts();
      
      return { success: true, lastSync: data.lastSync };
    } catch (err) {
      console.error('Error syncing email:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'An unknown error occurred' 
      };
    }
  };

  // Sync calendar from email
  const syncCalendarFromEmail = async (emailConnectionId?: string) => {
    try {
      const response = await fetch('/api/calendar/sync-from-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emailConnectionId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync calendar');
      }
      
      const data = await response.json();
      
      // Refresh accounts list
      await fetchAccounts();
      
      return { success: true, data };
    } catch (err) {
      console.error('Error syncing calendar from email:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'An unknown error occurred' 
      };
    }
  };

  // Fetch accounts on mount
  useEffect(() => {
    fetchAccounts();
  }, []);

  return {
    accounts,
    loading,
    error,
    fetchAccounts,
    connectEmail,
    disconnectEmail,
    syncEmail,
    syncCalendarFromEmail,
  };
}