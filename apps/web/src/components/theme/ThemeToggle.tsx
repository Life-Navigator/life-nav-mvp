'use client';

import { useTheme } from 'next-themes';
import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // After mounting, we can safely show the UI that depends on client-side features
  useEffect(() => {
    setMounted(true);
  }, []);

  // If not mounted yet, return a placeholder to avoid layout shift
  if (!mounted) {
    return <div className="w-[106px] h-[38px]" />;
  }

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    // Force a class update on the document element
    if (newTheme === 'dark' || (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  };

  console.log('Current theme:', theme, 'Resolved theme:', resolvedTheme);

  return (
    <div className="flex items-center space-x-2 rounded-lg border border-gray-200 p-1 dark:border-gray-700">
      <button
        onClick={() => handleThemeChange('light')}
        className={`rounded p-1.5 ${
          theme === 'light' || (theme === 'system' && resolvedTheme === 'light')
            ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
            : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
        }`}
        aria-label="Light Mode"
        type="button"
      >
        <SunIcon className="h-5 w-5" />
      </button>

      <button
        onClick={() => handleThemeChange('dark')}
        className={`rounded p-1.5 ${
          theme === 'dark' || (theme === 'system' && resolvedTheme === 'dark')
            ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
            : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
        }`}
        aria-label="Dark Mode"
        type="button"
      >
        <MoonIcon className="h-5 w-5" />
      </button>

      <button
        onClick={() => handleThemeChange('system')}
        className={`rounded p-1.5 ${
          theme === 'system'
            ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
            : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
        }`}
        aria-label="System Mode"
        type="button"
      >
        <ComputerDesktopIcon className="h-5 w-5" />
      </button>
    </div>
  );
}