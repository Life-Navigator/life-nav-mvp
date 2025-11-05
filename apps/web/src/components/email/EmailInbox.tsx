'use client';

import { useState, useEffect } from 'react';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  StarIcon as StarOutlineIcon,
  PaperClipIcon, 
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { LoadingSpinner } from '@/components/ui/loaders/LoadingSpinner';

type Email = {
  id: string;
  subject: string;
  from: {
    name: string;
    email: string;
  };
  to: {
    name: string;
    email: string;
  }[];
  date: string;
  body: string;
  read: boolean;
  starred: boolean;
  hasAttachments: boolean;
  labels?: string[];
};

type EmailInboxProps = {
  accountId: string;
  folder: string;
};

export function EmailInbox({ accountId, folder }: EmailInboxProps) {
  const [loading, setLoading] = useState(true);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Mock fetch emails
  useEffect(() => {
    const fetchEmails = async () => {
      setLoading(true);

      try {
        // In a real app, you'd call your API like:
        // const response = await fetch(`/api/email/${accountId}/messages?folder=${folder}`);
        // const data = await response.json();
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock data
        const mockEmails: Email[] = [
          {
            id: '1',
            subject: 'Weekly Team Meeting - Agenda',
            from: { name: 'John Smith', email: 'john@example.com' },
            to: [{ name: 'Me', email: 'me@example.com' }],
            date: '2025-05-13T10:30:00Z',
            body: 'Hello team, here is the agenda for our weekly meeting. Please review and let me know if you have any topics to add.',
            read: false,
            starred: true,
            hasAttachments: true
          },
          {
            id: '2',
            subject: 'Your invoice from Spotify Premium',
            from: { name: 'Spotify', email: 'noreply@spotify.com' },
            to: [{ name: 'Me', email: 'me@example.com' }],
            date: '2025-05-12T08:15:00Z',
            body: 'Thank you for your payment. Here is your monthly invoice for Spotify Premium.',
            read: true,
            starred: false,
            hasAttachments: true
          },
          {
            id: '3',
            subject: 'Project deadline extension',
            from: { name: 'Sarah Johnson', email: 'sarah@company.com' },
            to: [{ name: 'Me', email: 'me@example.com' }, { name: 'Team', email: 'team@company.com' }],
            date: '2025-05-11T16:45:00Z',
            body: 'Hi everyone, I wanted to inform you that we have extended the project deadline by one week.',
            read: true,
            starred: false,
            hasAttachments: false
          },
          {
            id: '4',
            subject: 'Weekend plans',
            from: { name: 'Alex Green', email: 'alex@friend.com' },
            to: [{ name: 'Me', email: 'me@example.com' }],
            date: '2025-05-10T19:20:00Z',
            body: 'Hey! Are you free this weekend? I was thinking we could go hiking if the weather is nice.',
            read: true,
            starred: true,
            hasAttachments: false
          },
          {
            id: '5',
            subject: 'Your flight confirmation',
            from: { name: 'Airlines Booking', email: 'bookings@airline.com' },
            to: [{ name: 'Me', email: 'me@example.com' }],
            date: '2025-05-09T12:00:00Z',
            body: 'Thank you for booking with us. Here is your flight confirmation and boarding pass.',
            read: false,
            starred: false,
            hasAttachments: true
          }
        ];
        
        setEmails(mockEmails);
      } catch (error) {
        console.error('Error fetching emails:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEmails();
  }, [accountId, folder]);

  // Toggle star status
  const toggleStar = (emailId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEmails(emails.map(email => 
      email.id === emailId ? { ...email, starred: !email.starred } : email
    ));
  };

  // Format date to readable format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    // Today
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // Yesterday
    else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    // This year
    else if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    // Earlier
    else {
      return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    }
  };

  // Handle marking email as read when selected
  const handleSelectEmail = (emailId: string) => {
    setSelectedEmail(emailId);
    
    // Mark as read
    setEmails(emails.map(email => 
      email.id === emailId ? { ...email, read: true } : email
    ));
  };

  // Filter emails by search query
  const filteredEmails = emails.filter(email => 
    searchQuery === '' || 
    email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.from.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.from.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.body.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get selected email details
  const selectedEmailDetails = emails.find(email => email.id === selectedEmail);

  return (
    <div className="flex flex-col h-full">
      {/* Search and filters */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search emails..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
        </div>
        <button className="ml-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
          <FunnelIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Email list and detail view */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Email list */}
          <div className={`${selectedEmail ? 'w-1/3 border-r border-gray-200 dark:border-gray-700' : 'w-full'} overflow-y-auto`}>
            {filteredEmails.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No emails found in this folder
              </div>
            ) : (
              <div>
                {filteredEmails.map(email => (
                  <div
                    key={email.id}
                    onClick={() => handleSelectEmail(email.id)}
                    className={`
                      p-3 border-b border-gray-200 dark:border-gray-700 cursor-pointer flex
                      ${!email.read ? 'font-semibold bg-blue-50 dark:bg-blue-900/20' : ''}
                      ${selectedEmail === email.id ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}
                    `}
                  >
                    <div className="mr-3 flex flex-col items-center justify-center">
                      <button 
                        onClick={(e) => toggleStar(email.id, e)}
                        className="focus:outline-none"
                      >
                        {email.starred ? (
                          <StarSolidIcon className="w-5 h-5 text-yellow-400" />
                        ) : (
                          <StarOutlineIcon className="w-5 h-5 text-gray-400 hover:text-yellow-400" />
                        )}
                      </button>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between">
                        <p className="truncate font-medium text-gray-900 dark:text-white">{email.from.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-2">
                          {formatDate(email.date)}
                        </p>
                      </div>
                      
                      <p className="truncate text-gray-900 dark:text-white">{email.subject}</p>
                      
                      <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm">
                        <p className="truncate">{email.body.substring(0, 60)}...</p>
                        {email.hasAttachments && (
                          <PaperClipIcon className="w-4 h-4 ml-1 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                    
                    <div className="ml-2">
                      <ChevronRightIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Email detail view */}
          {selectedEmail && selectedEmailDetails && (
            <div className="w-2/3 overflow-y-auto p-4">
              <div className="mb-6">
                <h1 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-white">{selectedEmailDetails.subject}</h1>
                
                <div className="flex justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center text-blue-800 dark:text-blue-200 font-semibold mr-3">
                      {selectedEmailDetails.from.name.charAt(0).toUpperCase()}
                    </div>
                    
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedEmailDetails.from.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{selectedEmailDetails.from.email}</p>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(selectedEmailDetails.date).toLocaleDateString([], {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                
                <div className="text-sm mb-2 text-gray-700 dark:text-gray-300">
                  <span className="text-gray-500 dark:text-gray-400">To:</span>{' '}
                  {selectedEmailDetails.to.map(recipient => recipient.name).join(', ')}
                </div>
              </div>
              
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 whitespace-pre-line text-gray-800 dark:text-gray-200">
                {selectedEmailDetails.body}
              </div>
              
              {selectedEmailDetails.hasAttachments && (
                <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h3 className="text-sm font-medium mb-2 text-gray-900 dark:text-white">Attachments</h3>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded p-3 inline-block">
                    <div className="flex items-center">
                      <PaperClipIcon className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
                      <span className="text-gray-800 dark:text-gray-200">Document.pdf</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button className="bg-blue-500 text-white px-4 py-2 rounded mr-2">
                  Reply
                </button>
                <button className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded mr-2">
                  Forward
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}