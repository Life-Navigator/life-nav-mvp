'use client';

import { useState, useEffect, useRef, FC } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';
import { DirectThemeToggle } from '@/components/theme/DirectThemeToggle';
import { getSupabaseClient } from '@/lib/supabase/client';

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
  const [mounted, setMounted] = useState<boolean>(false);
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'User',
    email: '',
    initials: 'U',
    image: null,
  });

  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useOnClickOutside(userMenuRef as React.RefObject<HTMLElement>, () => setShowUserMenu(false));

  // After mounting, fetch user data from Supabase session
  useEffect(() => {
    setMounted(true);
    const supabase = getSupabaseClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'User';
        const email = user.email || '';
        const initials =
          name
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2) || 'U';
        setUserProfile({ name, email, initials, image: user.user_metadata?.avatar_url || null });
      }
    });
  }, []);

  // Get page title based on the current pathname
  const getPageTitle = (): string => {
    const path = pathname?.split('/')[1];
    if (!path) return 'Home';
    return path.charAt(0).toUpperCase() + path.slice(1);
  };

  const user = userProfile;

  const handleSignOut = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    // Clear any legacy localStorage tokens
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
    // Full reload to clear all client state
    window.location.href = '/auth/login';
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
            {/* Theme toggle */}
            <div>{mounted && <DirectThemeToggle />}</div>

            {/* User menu */}
            <div ref={userMenuRef} className="relative ml-3">
              <div>
                <button
                  type="button"
                  className="flex rounded-full bg-blue-500 text-sm focus:outline-none"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  aria-label="User menu"
                >
                  <span className="sr-only">Open user menu</span>
                  {user.image ? (
                    <img className="h-8 w-8 rounded-full" src={user.image} alt={user.name} />
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
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {user.email}
                      </p>
                    </div>
                    <Link
                      href="/dashboard/profile"
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Your Profile
                    </Link>
                    <Link
                      href="/dashboard/settings"
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Settings
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
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

export default Header;
