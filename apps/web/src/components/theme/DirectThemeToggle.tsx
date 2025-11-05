'use client';

import { useEffect, useState } from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

export function DirectThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // When the component mounts, check current theme state
  useEffect(() => {
    setMounted(true);
    
    // Check if dark theme is already set
    const darkModeOn = document.documentElement.classList.contains('dark');
    setIsDark(darkModeOn);
    
    // Debug output
    console.log('DirectThemeToggle - Initial state:', { 
      isDark: darkModeOn,
      classList: document.documentElement.classList.toString(),
      bodyBg: getComputedStyle(document.body).backgroundColor
    });
  }, []);
  
  const toggleTheme = () => {
    // Log state before change
    console.log('DirectThemeToggle - Before toggle:', {
      isDark,
      classList: document.documentElement.classList.toString()
    });
    
    // Toggle the theme state
    const newIsDark = !isDark;
    
    // Apply the appropriate theme
    if (newIsDark) {
      // DARK MODE
      console.log('Switching to DARK mode');
      
      // 1. Add 'dark' class to html
      document.documentElement.classList.add('dark');
      
      // 2. Set dark mode colors directly on body
      document.body.style.setProperty('background-color', '#0f172a', 'important');
      document.body.style.setProperty('color', '#f1f5f9', 'important');
      
      // 3. Store preference
      localStorage.setItem('theme', 'dark');
    } else {
      // LIGHT MODE
      console.log('Switching to LIGHT mode');
      
      // 1. Remove 'dark' class from html
      document.documentElement.classList.remove('dark');
      
      // 2. Set light mode colors directly on body
      document.body.style.setProperty('background-color', '#ffffff', 'important');
      document.body.style.setProperty('color', '#171717', 'important');
      
      // 3. Store preference
      localStorage.setItem('theme', 'light');
    }
    
    // Update component state
    setIsDark(newIsDark);
    
    // Log state after change
    console.log('DirectThemeToggle - After toggle:', {
      newIsDark,
      classList: document.documentElement.classList.toString()
    });
  };
  
  // If not mounted yet, return placeholder
  if (!mounted) {
    return <div className="w-10 h-10" />;
  }
  
  return (
    <button
      onClick={toggleTheme}
      className="relative p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
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