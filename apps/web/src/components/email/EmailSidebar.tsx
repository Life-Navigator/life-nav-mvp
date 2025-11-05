'use client';

import { Button } from '@/components/ui/buttons/Button';
import { PlusIcon } from '@heroicons/react/24/outline';

// Define icons for folder types
function InboxIcon() {
  return (
    <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  );
}

function SentIcon() {
  return (
    <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

function DraftsIcon() {
  return (
    <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function SpamIcon() {
  return (
    <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

type EmailAccount = {
  id: string;
  provider: string;
  email: string;
  connected: boolean;
  lastSync: string;
  unread: number;
  folders: string[];
};

type EmailSidebarProps = {
  accounts: EmailAccount[];
  activeAccount: string | null;
  activeFolder: string;
  onSelectAccount: (accountId: string) => void;
  onSelectFolder: (folder: string) => void;
  onConnectEmail: () => void;
};

// Function to get folder icon
const getFolderIcon = (folder: string) => {
  switch (folder.toLowerCase()) {
    case 'inbox':
      return <InboxIcon />;
    case 'sent':
      return <SentIcon />;
    case 'drafts':
      return <DraftsIcon />;
    case 'trash':
      return <TrashIcon />;
    case 'spam':
    case 'junk':
      return <SpamIcon />;
    default:
      return <FolderIcon />;
  }
};

// Function to format folder name
const formatFolderName = (folder: string) => {
  return folder.charAt(0).toUpperCase() + folder.slice(1);
};

export function EmailSidebar({ 
  accounts, 
  activeAccount, 
  activeFolder, 
  onSelectAccount, 
  onSelectFolder,
  onConnectEmail
}: EmailSidebarProps) {
  // Get the active account details
  const activeAccountDetails = accounts.find(account => account.id === activeAccount);
  
  return (
    <div className="w-64 bg-gray-50 dark:bg-gray-900 p-4 border-r border-gray-200 dark:border-gray-700 h-full overflow-y-auto">
      {/* Header & Create Email Button */}
      <div className="mb-4">
        <Button 
          className="w-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          Compose Email
        </Button>
      </div>

      {/* Email Accounts */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">
          Accounts
        </h3>
        
        <div className="space-y-1">
          {accounts.map(account => (
            <div 
              key={account.id}
              onClick={() => onSelectAccount(account.id)}
              className={`
                p-2 rounded-md cursor-pointer flex items-center justify-between
                ${activeAccount === account.id ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
              `}
            >
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                <span className="text-sm truncate max-w-[150px] text-gray-900 dark:text-gray-100">{account.email.split('@')[0]}</span>
              </div>
              {account.unread > 0 && (
                <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {account.unread}
                </span>
              )}
            </div>
          ))}
          
          <div
            onClick={onConnectEmail}
            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md cursor-pointer text-sm flex items-center"
          >
            <PlusIcon className="w-4 h-4 mr-1" />
            Add Account
          </div>
        </div>
      </div>

      {/* Folders Section */}
      {activeAccountDetails && (
        <div>
          <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">
            Folders
          </h3>
          
          <div className="space-y-1">
            {activeAccountDetails.folders.map(folder => (
              <div
                key={folder}
                onClick={() => onSelectFolder(folder)}
                className={`
                  p-2 rounded-md cursor-pointer flex items-center justify-between
                  ${activeFolder === folder ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
                `}
              >
                <div className="flex items-center">
                  {getFolderIcon(folder)}
                  <span className="text-sm ml-2 text-gray-900 dark:text-gray-100">{formatFolderName(folder)}</span>
                </div>
                {folder === 'inbox' && activeAccountDetails.unread > 0 && (
                  <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {activeAccountDetails.unread}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Settings */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
          Email Settings
        </div>
      </div>
    </div>
  );
}