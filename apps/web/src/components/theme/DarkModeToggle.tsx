'use client';

import { useEffect, useState } from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

export function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Initialize theme state based on class on html element
  useEffect(() => {
    setMounted(true);
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
    console.log('DarkModeToggle - Initial dark mode:', isDarkMode);
  }, []);
  
  // Apply dark mode directly
  const toggleDarkMode = () => {
    console.log('Toggling dark mode, current state:', isDark);
    
    if (isDark) {
      // Switch to light mode
      localStorage.theme = 'light';
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      // Switch to dark mode
      localStorage.theme = 'dark';
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
    
    // Force CSS variables to update
    document.body.style.backgroundColor = '';
    document.body.style.color = '';
    
    // Force re-render by refreshing the body class
    document.body.className = document.body.className;
    
    // Update state
    setIsDark(!isDark);
  };
  
  // If component hasn't mounted yet, don't render anything to avoid hydration mismatch
  if (!mounted) return <div className="w-10 h-10" />;

  return (
    <button
      onClick={toggleDarkMode}
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