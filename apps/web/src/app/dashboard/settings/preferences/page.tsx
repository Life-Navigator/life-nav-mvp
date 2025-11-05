'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';
import { toast } from '@/components/ui/toaster';
import LoadingSpinner from '@/components/ui/loaders/LoadingSpinner';

interface UserSettings {
  theme: string;
  currency: string;
  notificationsEnabled: boolean;
  dashboardLayout: string;
  language: string;
  timeFormat: string;
  dateFormat: string;
}

export default function PreferencesPage() {
  const { data: session, status } = useSession();
  const { setTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    theme: 'system',
    currency: 'USD',
    notificationsEnabled: true,
    dashboardLayout: 'default',
    language: 'en',
    timeFormat: '12h',
    dateFormat: 'MM/DD/YYYY',
  });
  const [error, setError] = useState<string | null>(null);
  
  // Available options
  const currencies = [
    { value: 'USD', label: 'US Dollar ($)' },
    { value: 'EUR', label: 'Euro (€)' },
    { value: 'GBP', label: 'British Pound (£)' },
    { value: 'JPY', label: 'Japanese Yen (¥)' },
    { value: 'CAD', label: 'Canadian Dollar (C$)' },
    { value: 'AUD', label: 'Australian Dollar (A$)' },
  ];
  
  const languages = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'zh', label: 'Chinese' },
    { value: 'ja', label: 'Japanese' },
  ];
  
  const themes = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];
  
  const timeFormats = [
    { value: '12h', label: '12-hour (1:30 PM)' },
    { value: '24h', label: '24-hour (13:30)' },
  ];
  
  const dateFormats = [
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
  ];
  
  const dashboardLayouts = [
    { value: 'default', label: 'Default' },
    { value: 'compact', label: 'Compact' },
    { value: 'expanded', label: 'Expanded' },
  ];
  
  // Fetch user settings
  useEffect(() => {
    const fetchUserSettings = async () => {
      if (status === 'loading') return;
      
      if (!session?.user?.id) {
        setError('You must be logged in to view this page');
        setIsLoading(false);
        return;
      }
      
      try {
        const response = await fetch('/api/user/settings');
        
        if (!response.ok) {
          throw new Error('Failed to fetch settings');
        }
        
        const data = await response.json();
        setSettings({
          ...settings,
          ...data,
        });
        
        // Update theme directly
        if (data.theme) {
          setTheme(data.theme);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
        setError('Failed to load user settings. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserSettings();
  }, [session, status, setTheme]);
  
  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setSettings({
        ...settings,
        [name]: checked,
      });
    } else {
      setSettings({
        ...settings,
        [name]: value,
      });
      
      // Update theme in real-time
      if (name === 'theme') {
        setTheme(value);
      }
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    
    try {
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update settings');
      }
      
      toast({
        title: "Settings Saved",
        description: "Your preferences have been successfully updated.",
        type: "success",
      });
    } catch (error) {
      console.error('Error updating settings:', error);
      setError('Failed to update settings. Please try again.');
      toast({
        title: "Update Failed",
        description: "There was an error updating your preferences.",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Reset settings to defaults
  const handleResetDefaults = () => {
    const defaultSettings = {
      theme: 'system',
      currency: 'USD',
      notificationsEnabled: true,
      dashboardLayout: 'default',
      language: 'en',
      timeFormat: '12h',
      dateFormat: 'MM/DD/YYYY',
    };
    
    setSettings(defaultSettings);
    setTheme(defaultSettings.theme);
    
    toast({
      title: "Defaults Restored",
      description: "Your preferences have been reset to the default values.",
      type: "info",
    });
  };
  
  // Show loading spinner
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[500px]">
        <LoadingSpinner size="large" />
      </div>
    );
  }
  
  // Show error message
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-4 rounded-lg">
          <p>{error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Preferences</h1>
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Appearance Section */}
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Appearance</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Customize how Life Navigator looks and behaves.
              </p>
              
              <div className="space-y-6">
                {/* Theme Selector */}
                <div>
                  <label htmlFor="theme" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Theme
                  </label>
                  <select
                    id="theme"
                    name="theme"
                    value={settings.theme}
                    onChange={handleChange}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm py-2 px-3 
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-white 
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {themes.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Choose between light, dark, or system preference.
                  </p>
                </div>
                
                {/* Dashboard Layout */}
                <div>
                  <label htmlFor="dashboardLayout" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Dashboard Layout
                  </label>
                  <select
                    id="dashboardLayout"
                    name="dashboardLayout"
                    value={settings.dashboardLayout}
                    onChange={handleChange}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm py-2 px-3 
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-white 
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {dashboardLayouts.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </Card>
          
          {/* Localization Section */}
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Localization</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Configure your preferred language, currency, and date formats.
              </p>
              
              <div className="space-y-6">
                {/* Language Selector */}
                <div>
                  <label htmlFor="language" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Language
                  </label>
                  <select
                    id="language"
                    name="language"
                    value={settings.language}
                    onChange={handleChange}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm py-2 px-3 
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-white 
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {languages.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Currency Selector */}
                <div>
                  <label htmlFor="currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Currency
                  </label>
                  <select
                    id="currency"
                    name="currency"
                    value={settings.currency}
                    onChange={handleChange}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm py-2 px-3 
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-white 
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {currencies.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Used for displaying financial information throughout the app.
                  </p>
                </div>
                
                {/* Date Format Selector */}
                <div>
                  <label htmlFor="dateFormat" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date Format
                  </label>
                  <select
                    id="dateFormat"
                    name="dateFormat"
                    value={settings.dateFormat}
                    onChange={handleChange}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm py-2 px-3 
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-white 
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {dateFormats.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Time Format Selector */}
                <div>
                  <label htmlFor="timeFormat" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Time Format
                  </label>
                  <select
                    id="timeFormat"
                    name="timeFormat"
                    value={settings.timeFormat}
                    onChange={handleChange}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm py-2 px-3 
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-white 
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {timeFormats.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </Card>
          
          {/* Notifications Section */}
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Notifications</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Control whether you receive notifications within the application.
              </p>
              
              <div className="flex items-center">
                <input
                  id="notificationsEnabled"
                  name="notificationsEnabled"
                  type="checkbox"
                  checked={settings.notificationsEnabled}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="notificationsEnabled" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Enable in-app notifications
                </label>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                For more detailed notification preferences, visit the <a href="/dashboard/settings/notifications" className="text-blue-600 dark:text-blue-400 hover:underline">Notifications</a> page.
              </p>
            </div>
          </Card>
          
          {/* Action Buttons */}
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleResetDefaults}
              className="border-gray-300"
            >
              Reset to Defaults
            </Button>
            
            <Button
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}