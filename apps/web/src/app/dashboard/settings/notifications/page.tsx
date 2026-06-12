'use client';

import React, { useEffect, useState } from 'react';
import { toast } from '@/components/ui/toaster';

interface NotificationPrefs {
  emailNotifications: boolean;
  pushNotifications: boolean;
  weeklyDigest: boolean;
  dailyDigest: boolean;
}

const DEFAULTS: NotificationPrefs = {
  emailNotifications: true,
  pushNotifications: true,
  weeklyDigest: true,
  dailyDigest: false,
};

export default function NotificationsSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // GET-on-mount: load persisted preferences.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/user/settings');
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setPrefs({
              emailNotifications:
                data.emailNotifications ?? data.notificationsEnabled ?? DEFAULTS.emailNotifications,
              pushNotifications: data.pushNotifications ?? DEFAULTS.pushNotifications,
              weeklyDigest: data.weeklyDigest ?? DEFAULTS.weeklyDigest,
              dailyDigest: data.dailyDigest ?? DEFAULTS.dailyDigest,
            });
          }
        }
      } catch (err) {
        console.error('Error loading notification preferences:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const toggle = (key: keyof NotificationPrefs) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailNotifications: prefs.emailNotifications,
          pushNotifications: prefs.pushNotifications,
          weeklyDigest: prefs.weeklyDigest,
          dailyDigest: prefs.dailyDigest,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.message ||
            err.error ||
            "We couldn't save this yet. Please check required fields and try again."
        );
      }
      toast({
        title: 'Notifications Saved',
        description: 'Your notification preferences have been updated.',
        type: 'success',
      });
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      toast({
        title: 'Save Failed',
        description:
          error instanceof Error
            ? error.message
            : "We couldn't save this yet. Please check required fields and try again.",
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
    </label>
  );

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Notification Settings</h1>
        <p className="text-gray-500 dark:text-gray-400">Loading preferences...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Notification Settings</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Email Notifications</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Receive account and activity emails
              </p>
            </div>
            <Toggle
              checked={prefs.emailNotifications}
              onChange={() => toggle('emailNotifications')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Weekly Summary</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Receive a weekly summary of your activity
              </p>
            </div>
            <Toggle checked={prefs.weeklyDigest} onChange={() => toggle('weeklyDigest')} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Daily Digest</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Receive a daily digest email
              </p>
            </div>
            <Toggle checked={prefs.dailyDigest} onChange={() => toggle('dailyDigest')} />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Push Notifications</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Push Notifications</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Deadline reminders and important events
              </p>
            </div>
            <Toggle
              checked={prefs.pushNotifications}
              onChange={() => toggle('pushNotifications')}
            />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}
