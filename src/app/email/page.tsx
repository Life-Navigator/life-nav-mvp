'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/buttons/Button';
import { Card } from '@/components/ui/cards/Card';
import { LoadingSpinner } from '@/components/ui/loaders/LoadingSpinner';
import { EmailAccountModal } from '@/components/email/EmailAccountModal';
import { EmailInbox } from '@/components/email/EmailInbox';
import { EmailSidebar } from '@/components/email/EmailSidebar';
import { useConnectedServices } from '@/hooks/useConnectedServices';

export default function EmailPage() {
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeAccount, setActiveAccount] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState('inbox');
  
  const { services, loading: servicesLoading } = useConnectedServices('email');
  const [emailAccounts, setEmailAccounts] = useState<any[]>([]);

  // Fetch email accounts from API
  useEffect(() => {
    const fetchEmailAccounts = async () => {
      try {
        // TODO: Implement API endpoint for fetching connected email accounts
        // const response = await fetch('/api/email/accounts');
        // const data = await response.json();
        // setEmailAccounts(data);
        setEmailAccounts([]); // Empty for now - will be populated when users connect accounts
      } catch (error) {
        console.error('Error fetching email accounts:', error);
        setEmailAccounts([]);
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

  // Handle account connection
  const toggleEmailConnection = (id: string) => {
    // This would be replaced with actual API calls in production
    console.log(`Toggling connection for account ${id}`);
    // Update UI immediately for better UX
    // setEmailAccounts(...);
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

  // Get the active account details
  const activeAccountDetails = emailAccounts.find(account => account.id === activeAccount);

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
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {activeAccountDetails ? `Last synced: ${activeAccountDetails.lastSync}` : ''}
              </p>
            </div>
            <div className="flex space-x-2">
              <Button 
                onClick={handleConnectNewEmail}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                Connect New Email
              </Button>
              <Button className="bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white">
                Sync Now
              </Button>
            </div>
          </div>

          {/* Email Content */}
          {loading || servicesLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : !activeAccount ? (
            <div className="flex-1 flex items-center justify-center">
              <Card className="p-6 max-w-md text-center">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">No Email Accounts Connected</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Connect your email accounts to view all your messages in one place and automatically sync your calendars.
                </p>
                <Button 
                  onClick={handleConnectNewEmail}
                  className="bg-blue-500 hover:bg-blue-600 text-white mx-auto"
                >
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