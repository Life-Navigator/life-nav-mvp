'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/buttons/Button';
import { Card } from '@/components/ui/cards/Card';
import { LoadingSpinner } from '@/components/ui/loaders/LoadingSpinner';
import { EmailAccountModal } from '@/components/email/EmailAccountModal';
import { EmailInbox } from '@/components/email/EmailInbox';
import { EmailSidebar } from '@/components/email/EmailSidebar';
import { EnvelopeIcon, PlusIcon } from '@heroicons/react/24/outline';

interface EmailAccount {
  id: string;
  email: string;
  provider: string;
  name: string;
  lastSync: string | null;
  status: string;
  folders: string[];
}

export default function EmailPage() {
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeAccount, setActiveAccount] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [error, setError] = useState<Error | null>(null);

  // Fetch email accounts from API
  useEffect(() => {
    const fetchEmailAccounts = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/email/accounts');
        if (!response.ok) {
          throw new Error('Failed to fetch email accounts');
        }
        const data = await response.json();
        setEmailAccounts(data || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching email accounts:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch accounts'));
        setEmailAccounts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchEmailAccounts();
  }, []);

  // Set the first account as active if none is selected
  useEffect(() => {
    if (emailAccounts.length > 0 && !activeAccount) {
      setActiveAccount(emailAccounts[0].id);
    }
  }, [emailAccounts, activeAccount]);

  // Handle disconnecting an account
  const handleDisconnectAccount = async (accountId: string) => {
    try {
      const response = await fetch(`/api/email/accounts?id=${accountId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to disconnect account');

      // Remove from local state
      setEmailAccounts(accounts => accounts.filter(a => a.id !== accountId));

      // If this was the active account, switch to another
      if (activeAccount === accountId) {
        const remaining = emailAccounts.filter(a => a.id !== accountId);
        setActiveAccount(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error('Error disconnecting account:', err);
    }
  };

  // Handle connecting a new account
  const handleConnectNewEmail = () => {
    setIsModalOpen(true);
  };

  // Handle selecting an account
  const handleSelectAccount = (accountId: string) => {
    setActiveAccount(accountId);
    setActiveFolder('inbox'); // Reset to inbox when switching accounts
  };

  // Handle selecting a folder
  const handleSelectFolder = (folder: string) => {
    setActiveFolder(folder);
  };

  // Handle sync now
  const handleSyncNow = async () => {
    if (!activeAccount) return;

    try {
      // Call sync API
      await fetch(`/api/email/accounts/${activeAccount}/sync`, {
        method: 'POST',
      });

      // Refresh account data
      const response = await fetch('/api/email/accounts');
      if (response.ok) {
        const data = await response.json();
        setEmailAccounts(data || []);
      }
    } catch (err) {
      console.error('Error syncing account:', err);
    }
  };

  // Get the active account details
  const activeAccountDetails = emailAccounts.find(account => account.id === activeAccount);

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="p-6 max-w-md text-center">
          <p className="text-red-500 mb-4">Unable to load email accounts</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Email Sidebar */}
      <EmailSidebar
        accounts={emailAccounts}
        activeAccount={activeAccount}
        activeFolder={activeFolder}
        onSelectAccount={handleSelectAccount}
        onSelectFolder={handleSelectFolder}
        onConnectEmail={handleConnectNewEmail}
      />

      {/* Main Content */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {activeAccountDetails ? activeAccountDetails.email : 'Email'}
              </h1>
              {activeAccountDetails?.lastSync && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Last synced: {new Date(activeAccountDetails.lastSync).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={handleConnectNewEmail}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                Connect Email
              </Button>
              {activeAccount && (
                <Button
                  onClick={handleSyncNow}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white"
                >
                  Sync Now
                </Button>
              )}
            </div>
          </div>

          {/* Email Content */}
          {!activeAccount ? (
            <div className="flex-1 flex items-center justify-center">
              <Card className="p-8 max-w-md text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <EnvelopeIcon className="w-8 h-8 text-blue-500" />
                </div>
                <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">No Email Accounts Connected</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Connect your email accounts to view all your messages in one place and automatically sync your calendars.
                </p>
                <Button
                  onClick={handleConnectNewEmail}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Connect Email Account
                </Button>
              </Card>
            </div>
          ) : (
            <EmailInbox
              accountId={activeAccount}
              folder={activeFolder}
            />
          )}
        </div>
      </div>

      {/* New Email Account Modal */}
      <EmailAccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
