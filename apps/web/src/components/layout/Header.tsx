'use client';

import { useState, useEffect, useRef, FC } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { signOut } from 'next-auth/react';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';
import { DirectThemeToggle } from '@/components/theme/DirectThemeToggle';

type EmailAccount = {
  id: string;
  provider: string;
  email: string;
  unreadCount: number;
};

type Notification = {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
};

type UserProfile = {
  name: string;
  email: string;
  initials: string;
  image: string | null;
};

/**
 * Utility function to conditionally join class names
 */
const classNames = (...classes: (string | boolean | undefined)[]) => {
  return classes.filter(Boolean).join(' ');
};

const Header: FC = () => {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState<boolean>(false);
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [showEmailDropdown, setShowEmailDropdown] = useState<boolean>(false);
  
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const emailDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useOnClickOutside(userMenuRef as React.RefObject<HTMLElement>, () => setShowUserMenu(false));
  useOnClickOutside(notificationsRef as React.RefObject<HTMLElement>, () => setShowNotifications(false));
  useOnClickOutside(emailDropdownRef as React.RefObject<HTMLElement>, () => setShowEmailDropdown(false));

  // After mounting, we can safely show the UI that depends on client-side features
  useEffect(() => {
    setMounted(true);
  }, []);

  // Get page title based on the current pathname
  const getPageTitle = (): string => {
    const path = pathname?.split('/')[1];
    if (!path) return 'Home';
    return path.charAt(0).toUpperCase() + path.slice(1);
  };
  
  // Sample notifications
  const notifications: Notification[] = [
    {
      id: '1',
      title: 'New message',
      description: 'You have a new message from your financial advisor',
      time: '5 minutes ago',
      read: false,
    },
    {
      id: '2',
      title: 'Reminder',
      description: 'Career coaching session tomorrow at 3 PM',
      time: '1 hour ago',
      read: false,
    },
    {
      id: '3',
      title: 'Update',
      description: 'Your monthly financial report is ready to view',
      time: 'Yesterday',
      read: true,
    },
  ];

  // Sample email accounts
  const emailAccounts: EmailAccount[] = [
    {
      id: '1',
      provider: 'Gmail',
      email: 'thomas.riffe@gmail.com',
      unreadCount: 3,
    },
    {
      id: '2',
      provider: 'Outlook',
      email: 'thomas.riffe@outlook.com',
      unreadCount: 5,
    },
    {
      id: '3',
      provider: 'Work',
      email: 'thomas.riffe@company.com',
      unreadCount: 0,
    }
  ];

  // Sample user
  const user: UserProfile = {
    name: 'Thomas Riffe',
    email: 'thomas.riffe@example.com',
    initials: 'TR',
    image: null,
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm z-10 sticky top-0">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Left side - Title */}
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {getPageTitle()}
            </h1>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center space-x-4">
            {/* Calendar Link */}
            <Link
              href="/dashboard/calendar"
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 relative"
              aria-label="Calendar"
            >
              <CalendarIcon />
            </Link>

            {/* Email Dropdown */}
            <div ref={emailDropdownRef} className="relative">
              <button
                type="button"
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 relative"
                onClick={() => {
                  setShowEmailDropdown(!showEmailDropdown);
                  setShowNotifications(false);
                  setShowUserMenu(false);
                }}
                aria-label="Email Accounts"
              >
                <EmailIcon />
                {emailAccounts.some(account => account.unreadCount > 0) && (
                  <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-blue-500" />
                )}
              </button>

              {/* Email accounts dropdown */}
              {showEmailDropdown && (
                <div className="absolute right-0 mt-2 w-72 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 dark:ring-gray-700 focus:outline-none">
                  <div className="py-1 divide-y divide-gray-200">
                    <div className="px-4 py-2">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">Email Accounts</h3>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {emailAccounts.map((account) => (
                        <Link
                          key={account.id}
                          href="/email"
                          className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{account.provider}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">{account.email}</p>
                            </div>
                            {account.unreadCount > 0 && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                {account.unreadCount}
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                    <div className="px-4 py-2">
                      <Link href="/email/connect" className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                        Add email account
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Theme toggle */}
            <div>
              {mounted && <DirectThemeToggle />}
            </div>

            {/* Notifications */}
            <div ref={notificationsRef} className="relative">
              <button
                type="button"
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 relative"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowUserMenu(false);
                  setShowEmailDropdown(false);
                }}
                aria-label="Notifications"
              >
                <BellIcon />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-red-500" />
                )}
              </button>

              {/* Notifications dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 dark:ring-gray-700 focus:outline-none">
                  <div className="py-1 divide-y divide-gray-200">
                    <div className="px-4 py-2">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">Notifications</h3>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notification) => (
                          <Link
                            key={notification.id}
                            href="#"
                            className={classNames(
                              'block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700',
                              !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                            )}
                          >
                            <div className="flex justify-between">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{notification.title}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{notification.time}</p>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{notification.description}</p>
                          </Link>
                        ))
                      ) : (
                        <p className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">No new notifications</p>
                      )}
                    </div>
                    <div className="px-4 py-2">
                      <Link href="/notifications" className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                        View all notifications
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User menu */}
            <div ref={userMenuRef} className="relative ml-3">
              <div>
                <button
                  type="button"
                  className="flex rounded-full bg-blue-500 text-sm focus:outline-none"
                  onClick={() => {
                    setShowUserMenu(!showUserMenu);
                    setShowNotifications(false);
                    setShowEmailDropdown(false);
                  }}
                  aria-label="User menu"
                >
                  <span className="sr-only">Open user menu</span>
                  {user.image ? (
                    <img
                      className="h-8 w-8 rounded-full"
                      src={user.image}
                      alt={user.name}
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full flex items-center justify-center bg-blue-500 text-white">
                      {user.initials}
                    </div>
                  )}
                </button>
              </div>

              {/* User dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 dark:ring-gray-700 focus:outline-none">
                  <div className="py-1">
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{user.email}</p>
                    </div>
                    <Link
                      href="/profile"
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Your Profile
                    </Link>
                    <Link
                      href="/settings"
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Settings
                    </Link>
                    <button
                      type="button"
                      onClick={() => signOut({ callbackUrl: '/auth/login' })}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

// Icon components
const SunIcon: FC = () => (
  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
);

const MoonIcon: FC = () => (
  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
);

const BellIcon: FC = () => (
  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </svg>
);

const EmailIcon: FC = () => (
  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
    <polyline points="22,6 12,13 2,6"></polyline>
  </svg>
);

const CalendarIcon: FC = () => (
  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

export default Header;