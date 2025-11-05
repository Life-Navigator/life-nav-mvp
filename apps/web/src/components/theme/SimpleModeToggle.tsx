'use client';

import { useEffect, useState } from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

export function SimpleModeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  // After mounting, initialize the theme state
  useEffect(() => {
    setMounted(true);

    // Check if dark mode is enabled
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);

    // Debug info
    console.log('Initial theme state:', {
      isDarkMode,
      classList: document.documentElement.classList.toString(),
      storedTheme: localStorage.getItem('theme')
    });
  }, []);

  // If not mounted yet, return a placeholder to avoid layout shift
  if (!mounted) {
    return <div className="w-10 h-10" />;
  }

  const toggleTheme = () => {
    // Log before state
    console.log('Before toggle:', {
      isDark,
      classList: document.documentElement.classList.toString()
    });

    const newIsDark = !isDark;

    if (newIsDark) {
      // Switch to dark mode
      document.documentElement.classList.add('dark');

      // Set theme in localStorage for persistence
      localStorage.setItem('theme', 'dark');
      document.body.style.backgroundColor = 'var(--background)';
      document.body.style.color = 'var(--foreground)';
    } else {
      // Switch to light mode
      document.documentElement.classList.remove('dark');

      // Set theme in localStorage for persistence
      localStorage.setItem('theme', 'light');
      document.body.style.backgroundColor = 'var(--background)';
      document.body.style.color = 'var(--foreground)';
    }

    // Update state
    setIsDark(newIsDark);

    // Log after state
    console.log('After toggle:', {
      newIsDark,
      classList: document.documentElement.classList.toString()
    });
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <SunIcon className="h-5 w-5" />
      ) : (
        <MoonIcon className="h-5 w-5" />
      )}
    </button>
  );
}