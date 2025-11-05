'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  BellIcon, 
  LockClosedIcon, 
  ShieldCheckIcon, 
  UserCircleIcon,
  DocumentDuplicateIcon,
  ClockIcon,
  ArrowPathIcon,
  PencilIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

// Sample settings interface
interface HealthSettings {
  id: string;
  notificationsEnabled: boolean;
  notificationSettings: {
    appointmentReminders: boolean;
    medicationReminders: boolean;
    preventiveCareAlerts: boolean;
    reportAvailability: boolean;
  };
  privacySettings: {
    shareDataWithProviders: boolean;
    allowAnonymizedDataUsage: boolean;
    showSensitiveMedicalInfo: boolean;
  };
  dataRetentionMonths: number;
  documentDefaultPermissions: 'private' | 'shared-providers' | 'family-access';
  emergencyContacts: {
    id: string;
    name: string;
    relationship: string;
    phone: string;
    email?: string;
    canAccessRecords: boolean;
  }[];
  healthMetricsToTrack: string[];
}

// Sample health metrics options
const HEALTH_METRICS_OPTIONS = [
  'Blood Pressure',
  'Heart Rate',
  'Weight',
  'Sleep Duration',
  'Steps',
  'Blood Glucose',
  'Medication Adherence',
  'Mood',
  'Exercise Minutes',
  'Water Intake',
  'Calorie Intake'
];

export default function HealthcareSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState<HealthSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [editingContact, setEditingContact] = useState<string | null>(null);
  const [newContact, setNewContact] = useState({
    name: '',
    relationship: '',
    phone: '',
    email: '',
    canAccessRecords: false
  });
  const [addingNewContact, setAddingNewContact] = useState(false);
  
  // Fetch settings
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        // In a real app, this would be an API call
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Mock data
        setSettings({
          id: 'hs1',
          notificationsEnabled: true,
          notificationSettings: {
            appointmentReminders: true,
            medicationReminders: true,
            preventiveCareAlerts: true,
            reportAvailability: false
          },
          privacySettings: {
            shareDataWithProviders: true,
            allowAnonymizedDataUsage: true,
            showSensitiveMedicalInfo: false
          },
          dataRetentionMonths: 36,
          documentDefaultPermissions: 'private',
          emergencyContacts: [
            {
              id: 'ec1',
              name: 'Jane Doe',
              relationship: 'Spouse',
              phone: '(555) 123-4567',
              email: 'jane@example.com',
              canAccessRecords: true
            }
          ],
          healthMetricsToTrack: ['Blood Pressure', 'Weight', 'Sleep Duration', 'Steps']
        });
        setLoading(false);
      } catch (err) {
        console.error('Error fetching health settings:', err);
        setError('Failed to load health settings. Please try again later.');
        setLoading(false);
      }
    };
    
    if (status === 'authenticated') {
      fetchSettings();
    } else if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);
  
  // Toggle notification setting
  const toggleNotificationSetting = (setting: keyof HealthSettings['notificationSettings']) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      notificationSettings: {
        ...settings.notificationSettings,
        [setting]: !settings.notificationSettings[setting]
      }
    });
  };
  
  // Toggle privacy setting
  const togglePrivacySetting = (setting: keyof HealthSettings['privacySettings']) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      privacySettings: {
        ...settings.privacySettings,
        [setting]: !settings.privacySettings[setting]
      }
    });
  };
  
  // Change data retention period
  const changeDataRetention = (months: number) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      dataRetentionMonths: months
    });
  };
  
  // Toggle health metric tracking
  const toggleHealthMetric = (metric: string) => {
    if (!settings) return;
    
    const metrics = [...settings.healthMetricsToTrack];
    
    if (metrics.includes(metric)) {
      setSettings({
        ...settings,
        healthMetricsToTrack: metrics.filter(m => m !== metric)
      });
    } else {
      setSettings({
        ...settings,
        healthMetricsToTrack: [...metrics, metric]
      });
    }
  };
  
  // Change document permissions
  const changeDocumentPermissions = (permission: HealthSettings['documentDefaultPermissions']) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      documentDefaultPermissions: permission
    });
  };
  
  // Handle contact form input change
  const handleContactInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    if (addingNewContact) {
      setNewContact({
        ...newContact,
        [name]: type === 'checkbox' ? checked : value
      });
    } else if (editingContact && settings) {
      // Find the contact being edited
      const updatedContacts = settings.emergencyContacts.map(contact => {
        if (contact.id === editingContact) {
          return {
            ...contact,
            [name]: type === 'checkbox' ? checked : value
          };
        }
        return contact;
      });
      
      setSettings({
        ...settings,
        emergencyContacts: updatedContacts
      });
    }
  };
  
  // Add a new contact
  const addContact = () => {
    if (!settings) return;
    
    const newContactWithId = {
      ...newContact,
      id: `ec${Math.random().toString(36).substring(2, 9)}`
    };
    
    setSettings({
      ...settings,
      emergencyContacts: [...settings.emergencyContacts, newContactWithId]
    });
    
    setNewContact({
      name: '',
      relationship: '',
      phone: '',
      email: '',
      canAccessRecords: false
    });
    
    setAddingNewContact(false);
  };
  
  // Remove a contact
  const removeContact = (id: string) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      emergencyContacts: settings.emergencyContacts.filter(contact => contact.id !== id)
    });
  };
  
  // Save settings
  const saveSettings = async () => {
    try {
      // In a real app, this would be an API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Show success message
      setSavedSuccess(true);
      
      // Hide after 3 seconds
      setTimeout(() => {
        setSavedSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings. Please try again.');
      
      // Hide error after 3 seconds
      setTimeout(() => {
        setError(null);
      }, 3000);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-300">Loading settings...</div>
      </div>
    );
  }
  
  if (error && !settings) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">Error</h2>
          <p className="text-gray-700 dark:text-gray-300">{error}</p>
          <button 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  if (!settings) {
    return null;
  }
  
  return (
    <div className="py-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Healthcare Settings</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage your healthcare preferences and privacy</p>
          </div>
          
          <button
            onClick={saveSettings}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 shadow-sm"
          >
            Save Changes
          </button>
        </div>
        
        {/* Success message */}
        {savedSuccess && (
          <div className="mb-6 bg-green-100 dark:bg-green-900/30 border-l-4 border-green-500 p-4">
            <div className="flex">
              <CheckIcon className="h-5 w-5 text-green-500 dark:text-green-400 mr-3" />
              <p className="text-green-700 dark:text-green-300">Settings saved successfully!</p>
            </div>
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <div className="mb-6 bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 p-4">
            <div className="flex">
              <svg className="h-5 w-5 text-red-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Notification Settings */}
          <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <BellIcon className="h-6 w-6 text-red-600 dark:text-red-400 mr-3" />
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Notification Settings</h2>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">Enable All Notifications</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Control all healthcare notifications in one place
                    </p>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={settings.notificationsEnabled}
                        onChange={() => setSettings({
                          ...settings,
                          notificationsEnabled: !settings.notificationsEnabled
                        })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 dark:peer-focus:ring-red-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-600"></div>
                    </label>
                  </div>
                </div>
                
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <fieldset className="space-y-3" disabled={!settings.notificationsEnabled}>
                    <div className="flex items-center">
                      <input
                        id="appointment-reminders"
                        type="checkbox"
                        className="h-4 w-4 text-red-600 border-gray-300 rounded disabled:opacity-50 focus:ring-red-500"
                        checked={settings.notificationSettings.appointmentReminders}
                        onChange={() => toggleNotificationSetting('appointmentReminders')}
                        disabled={!settings.notificationsEnabled}
                      />
                      <label htmlFor="appointment-reminders" className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                        Appointment Reminders
                      </label>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        id="medication-reminders"
                        type="checkbox"
                        className="h-4 w-4 text-red-600 border-gray-300 rounded disabled:opacity-50 focus:ring-red-500"
                        checked={settings.notificationSettings.medicationReminders}
                        onChange={() => toggleNotificationSetting('medicationReminders')}
                        disabled={!settings.notificationsEnabled}
                      />
                      <label htmlFor="medication-reminders" className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                        Medication Reminders
                      </label>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        id="preventive-care-alerts"
                        type="checkbox"
                        className="h-4 w-4 text-red-600 border-gray-300 rounded disabled:opacity-50 focus:ring-red-500"
                        checked={settings.notificationSettings.preventiveCareAlerts}
                        onChange={() => toggleNotificationSetting('preventiveCareAlerts')}
                        disabled={!settings.notificationsEnabled}
                      />
                      <label htmlFor="preventive-care-alerts" className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                        Preventive Care Alerts
                      </label>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        id="report-availability"
                        type="checkbox"
                        className="h-4 w-4 text-red-600 border-gray-300 rounded disabled:opacity-50 focus:ring-red-500"
                        checked={settings.notificationSettings.reportAvailability}
                        onChange={() => toggleNotificationSetting('reportAvailability')}
                        disabled={!settings.notificationsEnabled}
                      />
                      <label htmlFor="report-availability" className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                        Lab/Imaging Report Availability
                      </label>
                    </div>
                  </fieldset>
                </div>
              </div>
            </div>
          </div>
          
          {/* Document Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <DocumentDuplicateIcon className="h-6 w-6 text-red-600 dark:text-red-400 mr-3" />
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Document Settings</h2>
              </div>
            </div>
            
            <div className="p-6">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Default Document Permissions</h3>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      id="private"
                      type="radio"
                      className="h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500"
                      checked={settings.documentDefaultPermissions === 'private'}
                      onChange={() => changeDocumentPermissions('private')}
                    />
                    <label htmlFor="private" className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                      Private (Only you can access)
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      id="shared-providers"
                      type="radio"
                      className="h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500"
                      checked={settings.documentDefaultPermissions === 'shared-providers'}
                      onChange={() => changeDocumentPermissions('shared-providers')}
                    />
                    <label htmlFor="shared-providers" className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                      Share with Healthcare Providers
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      id="family-access"
                      type="radio"
                      className="h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500"
                      checked={settings.documentDefaultPermissions === 'family-access'}
                      onChange={() => changeDocumentPermissions('family-access')}
                    />
                    <label htmlFor="family-access" className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                      Family Access (Authorized contacts)
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Data Retention Period</h3>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      id="retention-12"
                      type="radio"
                      className="h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500"
                      checked={settings.dataRetentionMonths === 12}
                      onChange={() => changeDataRetention(12)}
                    />
                    <label htmlFor="retention-12" className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                      12 months
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      id="retention-36"
                      type="radio"
                      className="h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500"
                      checked={settings.dataRetentionMonths === 36}
                      onChange={() => changeDataRetention(36)}
                    />
                    <label htmlFor="retention-36" className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                      36 months (3 years)
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      id="retention-60"
                      type="radio"
                      className="h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500"
                      checked={settings.dataRetentionMonths === 60}
                      onChange={() => changeDataRetention(60)}
                    />
                    <label htmlFor="retention-60" className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                      60 months (5 years)
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      id="retention-forever"
                      type="radio"
                      className="h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500"
                      checked={settings.dataRetentionMonths === 0}
                      onChange={() => changeDataRetention(0)}
                    />
                    <label htmlFor="retention-forever" className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                      Keep indefinitely
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">Document Actions</h3>
                </div>
                <div className="space-y-2">
                  <button className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                    <ArrowPathIcon className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
                    Sync Documents
                  </button>
                  
                  <Link
                    href="/dashboard/healthcare/documents"
                    className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <LockClosedIcon className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
                    Manage Secure Vault
                  </Link>
                </div>
              </div>
            </div>
          </div>
          
          {/* Privacy Settings */}
          <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <ShieldCheckIcon className="h-6 w-6 text-red-600 dark:text-red-400 mr-3" />
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Privacy Settings</h2>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">Share Data with Healthcare Providers</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Allow your healthcare providers to access your health data through this platform.
                    </p>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={settings.privacySettings.shareDataWithProviders}
                        onChange={() => togglePrivacySetting('shareDataWithProviders')}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 dark:peer-focus:ring-red-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-600"></div>
                    </label>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">Allow Anonymized Data Usage</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Help improve healthcare by allowing anonymous usage of your health data for research.
                    </p>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={settings.privacySettings.allowAnonymizedDataUsage}
                        onChange={() => togglePrivacySetting('allowAnonymizedDataUsage')}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 dark:peer-focus:ring-red-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-600"></div>
                    </label>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">Show Sensitive Medical Information</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Display sensitive information like diagnostic results and medications directly in the dashboard.
                    </p>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={settings.privacySettings.showSensitiveMedicalInfo}
                        onChange={() => togglePrivacySetting('showSensitiveMedicalInfo')}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 dark:peer-focus:ring-red-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-600"></div>
                    </label>
                  </div>
                </div>
                
                <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Health Metrics to Track</h3>
                  <div className="grid grid-cols-2 gap-y-2">
                    {HEALTH_METRICS_OPTIONS.map((metric) => (
                      <div key={metric} className="flex items-center">
                        <input
                          id={`metric-${metric.toLowerCase().replace(/\s+/g, '-')}`}
                          type="checkbox"
                          className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                          checked={settings.healthMetricsToTrack.includes(metric)}
                          onChange={() => toggleHealthMetric(metric)}
                        />
                        <label htmlFor={`metric-${metric.toLowerCase().replace(/\s+/g, '-')}`} className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                          {metric}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Emergency Contacts */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <UserCircleIcon className="h-6 w-6 text-red-600 dark:text-red-400 mr-3" />
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Emergency Contacts</h2>
              </div>
            </div>
            
            <div className="p-6">
              {settings.emergencyContacts.length === 0 && !addingNewContact ? (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    No emergency contacts added yet
                  </p>
                  <button 
                    onClick={() => setAddingNewContact(true)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 shadow-sm"
                  >
                    Add Contact
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {settings.emergencyContacts.map((contact) => (
                    <div key={contact.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      {editingContact === contact.id ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                              Name
                            </label>
                            <input
                              type="text"
                              name="name"
                              value={
                                settings.emergencyContacts.find(c => c.id === editingContact)?.name || ''
                              }
                              onChange={handleContactInputChange}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                              Relationship
                            </label>
                            <input
                              type="text"
                              name="relationship"
                              value={
                                settings.emergencyContacts.find(c => c.id === editingContact)?.relationship || ''
                              }
                              onChange={handleContactInputChange}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                              Phone
                            </label>
                            <input
                              type="tel"
                              name="phone"
                              value={
                                settings.emergencyContacts.find(c => c.id === editingContact)?.phone || ''
                              }
                              onChange={handleContactInputChange}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                              Email (Optional)
                            </label>
                            <input
                              type="email"
                              name="email"
                              value={
                                settings.emergencyContacts.find(c => c.id === editingContact)?.email || ''
                              }
                              onChange={handleContactInputChange}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            />
                          </div>
                          
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              name="canAccessRecords"
                              checked={
                                settings.emergencyContacts.find(c => c.id === editingContact)?.canAccessRecords || false
                              }
                              onChange={handleContactInputChange}
                              className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                              id={`access-records-${contact.id}`}
                            />
                            <label htmlFor={`access-records-${contact.id}`} className="ml-3 text-xs text-gray-700 dark:text-gray-300">
                              Allow access to medical records
                            </label>
                          </div>
                          
                          <div className="flex space-x-2 pt-2">
                            <button
                              onClick={() => setEditingContact(null)}
                              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => setEditingContact(null)}
                              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                                {contact.name}
                              </h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {contact.relationship}
                              </p>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => setEditingContact(contact.id)}
                                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                              >
                                <PencilIcon className="h-4 w-4" />
                                <span className="sr-only">Edit</span>
                              </button>
                              <button
                                onClick={() => removeContact(contact.id)}
                                className="text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span className="sr-only">Delete</span>
                              </button>
                            </div>
                          </div>
                          
                          <div className="mt-2 space-y-1">
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Phone:</span> {contact.phone}
                            </p>
                            {contact.email && (
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                <span className="font-medium">Email:</span> {contact.email}
                              </p>
                            )}
                          </div>
                          
                          <div className="mt-3">
                            <div className="flex items-center">
                              <div className={`h-2 w-2 rounded-full ${
                                contact.canAccessRecords ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                              }`}></div>
                              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                {contact.canAccessRecords ? 'Can access records' : 'No record access'}
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  
                  {addingNewContact ? (
                    <div className="border border-gray-200 dark:border-gray-700 border-dashed rounded-lg p-4">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                        Add New Emergency Contact
                      </h3>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Name*
                          </label>
                          <input
                            type="text"
                            name="name"
                            value={newContact.name}
                            onChange={handleContactInputChange}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Relationship*
                          </label>
                          <input
                            type="text"
                            name="relationship"
                            value={newContact.relationship}
                            onChange={handleContactInputChange}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Phone*
                          </label>
                          <input
                            type="tel"
                            name="phone"
                            value={newContact.phone}
                            onChange={handleContactInputChange}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Email (Optional)
                          </label>
                          <input
                            type="email"
                            name="email"
                            value={newContact.email}
                            onChange={handleContactInputChange}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            name="canAccessRecords"
                            checked={newContact.canAccessRecords}
                            onChange={handleContactInputChange}
                            className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                            id="new-access-records"
                          />
                          <label htmlFor="new-access-records" className="ml-3 text-xs text-gray-700 dark:text-gray-300">
                            Allow access to medical records
                          </label>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2 mt-4">
                        <button
                          onClick={() => setAddingNewContact(false)}
                          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={addContact}
                          disabled={!newContact.name || !newContact.relationship || !newContact.phone}
                          className={`px-3 py-1.5 text-sm rounded-md ${
                            !newContact.name || !newContact.relationship || !newContact.phone
                              ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                              : 'bg-red-600 text-white hover:bg-red-700'
                          }`}
                        >
                          Add Contact
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingNewContact(true)}
                      className="mt-4 w-full flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <svg className="h-5 w-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Emergency Contact
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Bottom navigation */}
        <div className="mt-8 flex flex-col md:flex-row md:justify-between">
          <div className="mb-4 md:mb-0">
            <Link 
              href="/dashboard/healthcare"
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
            >
              ← Back to Health Dashboard
            </Link>
          </div>
          <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-4">
            <button
              onClick={saveSettings}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 shadow-sm"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}