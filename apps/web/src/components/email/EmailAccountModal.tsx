'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/buttons/Button';
import { Card } from '@/components/ui/cards/Card';
import { LoadingSpinner } from '@/components/ui/loaders/LoadingSpinner';

// Email provider types
const EMAIL_PROVIDERS = [
  {
    id: 'gmail',
    name: 'Gmail',
    icon: '/images/email/gmail.svg', // Add these icons to your public directory
    description: 'Connect your Google email account',
    color: '#DB4437'
  },
  {
    id: 'outlook',
    name: 'Outlook',
    icon: '/images/email/outlook.svg',
    description: 'Connect your Microsoft email account',
    color: '#0078D4'
  },
  {
    id: 'yahoo',
    name: 'Yahoo Mail',
    icon: '/images/email/yahoo.svg',
    description: 'Connect your Yahoo email account',
    color: '#6001D2'
  },
  {
    id: 'icloud',
    name: 'iCloud Mail',
    icon: '/images/email/icloud.svg',
    description: 'Connect your Apple email account',
    color: '#999999'
  },
  {
    id: 'other',
    name: 'Other Email Service',
    icon: '/images/email/other.svg',
    description: 'Connect via IMAP/SMTP settings',
    color: '#555555'
  }
];

type EmailAccountModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function EmailAccountModal({ isOpen, onClose }: EmailAccountModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualConfig, setManualConfig] = useState({
    email: '',
    password: '',
    imapServer: '',
    imapPort: '993',
    smtpServer: '',
    smtpPort: '587',
    useSSL: true
  });
  
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Close the modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);
  
  // Close on escape key
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }
    
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  // Handle OAuth flow for standard providers
  const handleConnectProvider = async (providerId: string) => {
    setSelectedProvider(providerId);
    setLoading(true);
    
    try {
      // Here you'd initiate the OAuth flow
      // For example with Gmail, redirect to Google's OAuth consent screen
      if (providerId === 'other') {
        setShowManualForm(true);
        setLoading(false);
        return;
      }
      
      // Mock API call for now
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Redirect to OAuth provider
      const redirectUrl = `/api/integrations/oauth/init?provider=${providerId}&service=email&redirectUrl=/email`;
      window.location.href = redirectUrl;
      
    } catch (error) {
      console.error('Error connecting email provider:', error);
      setLoading(false);
    }
  };

  // Handle manual IMAP/SMTP configuration
  const handleManualConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Here you'd send the IMAP/SMTP configuration to your backend
      console.log('Manual connection config:', manualConfig);
      
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // On success, close the modal
      onClose();
      // You'd typically reload the email accounts list here
    } catch (error) {
      console.error('Error setting up manual email:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setManualConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div 
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full overflow-hidden" 
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {showManualForm ? 'Configure Email Manually' : 'Connect Email Account'}
          </h2>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-4">
          {loading ? (
            <div className="py-8 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : showManualForm ? (
            <form onSubmit={handleManualConnect} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={manualConfig.email}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Password</label>
                <input
                  type="password"
                  name="password"
                  value={manualConfig.password}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">IMAP Server</label>
                  <input
                    type="text"
                    name="imapServer"
                    value={manualConfig.imapServer}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                    placeholder="imap.example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">IMAP Port</label>
                  <input
                    type="text"
                    name="imapPort"
                    value={manualConfig.imapPort}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">SMTP Server</label>
                  <input
                    type="text"
                    name="smtpServer"
                    value={manualConfig.smtpServer}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                    placeholder="smtp.example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">SMTP Port</label>
                  <input
                    type="text"
                    name="smtpPort"
                    value={manualConfig.smtpPort}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                  />
                </div>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="useSSL"
                  checked={manualConfig.useSSL}
                  onChange={handleInputChange}
                  className="mr-2"
                />
                <label className="text-sm text-gray-700 dark:text-gray-300">Use SSL/TLS (recommended)</label>
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                <p>
                  By connecting your email, you agree to allow Life Navigator to:
                </p>
                <ul className="list-disc pl-5 mt-1">
                  <li>Sync email messages and folders</li>
                  <li>Sync calendar events</li>
                  <li>Provide personalized insights on your communications</li>
                </ul>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Choose your email provider to connect. We'll automatically sync calendars for connected accounts.
              </p>
              
              {EMAIL_PROVIDERS.map(provider => (
                <Card 
                  key={provider.id}
                  className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center"
                  onClick={() => handleConnectProvider(provider.id)}
                >
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center mr-3"
                    style={{ backgroundColor: `${provider.color}20` }} // Light background based on provider color
                  >
                    <div className="text-xl font-bold" style={{ color: provider.color }}>
                      {provider.name.charAt(0)}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{provider.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{provider.description}</p>
                  </div>
                </Card>
              ))}
              
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                <p>
                  By connecting your email, you agree to allow Life Navigator to:
                </p>
                <ul className="list-disc pl-5 mt-1">
                  <li>Sync email messages and folders</li>
                  <li>Sync calendar events automatically</li>
                  <li>Provide personalized insights on your communications</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 flex justify-end space-x-2">
          <Button 
            type="button" 
            onClick={onClose}
            className="bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-white"
          >
            Cancel
          </Button>
          
          {showManualForm && (
            <>
              <Button 
                type="button" 
                onClick={() => setShowManualForm(false)}
                className="bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-white"
              >
                Back
              </Button>
              <Button 
                type="button"
                onClick={handleManualConnect}
                className="bg-blue-500 text-white"
              >
                Connect Email
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}