'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  ComputerDesktopIcon, 
  DevicePhoneMobileIcon, 
  LockClosedIcon, 
  ArrowPathIcon 
} from '@heroicons/react/24/outline';

export default function DesktopDownloadPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    operatingSystem: 'windows',
    emailUpdates: true,
    betaTester: false
  });
  
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    
    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate form
    if (!formData.name.trim() || !formData.email.trim()) {
      setError('Please fill out all required fields.');
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    
    // In a real app, you'd send this to your API
    console.log('Submitting waitlist form:', formData);
    
    // Simulate success
    setSubmitted(true);
  };
  
  return (
    <div className="h-full w-full flex flex-col items-center p-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <div className="mb-8 flex justify-center">
            <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-full">
              <ComputerDesktopIcon className="h-16 w-16 text-purple-500 dark:text-purple-400" />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">
            Life Navigator Desktop App
          </h1>
          
          <p className="text-lg mb-8 text-gray-600 dark:text-gray-300">
            Get enhanced features, local data processing, and advanced security with our upcoming desktop application.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <DevicePhoneMobileIcon className="h-10 w-10 text-purple-500 mb-4 mx-auto" />
            <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white text-center">Cross-Platform</h2>
            <p className="text-gray-600 dark:text-gray-300 text-center">Available for Windows, macOS, and Linux. Sync with your mobile devices.</p>
          </div>
          
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <LockClosedIcon className="h-10 w-10 text-purple-500 mb-4 mx-auto" />
            <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white text-center">Enhanced Security</h2>
            <p className="text-gray-600 dark:text-gray-300 text-center">Local data processing and end-to-end encryption for sensitive information.</p>
          </div>
          
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <ArrowPathIcon className="h-10 w-10 text-purple-500 mb-4 mx-auto" />
            <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white text-center">Offline Access</h2>
            <p className="text-gray-600 dark:text-gray-300 text-center">Access your data and continue working even without an internet connection.</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-100 dark:border-purple-800">
            <h2 className="text-xl font-semibold text-purple-800 dark:text-purple-300">Join the Waitlist</h2>
            <p className="text-purple-700 dark:text-purple-200">
              The desktop app is coming soon. Sign up to be notified and get early access when it launches.
            </p>
          </div>
          
          {!submitted ? (
            <form onSubmit={handleSubmit} className="p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-md">
                  {error}
                </div>
              )}
              
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email Address *
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <label htmlFor="operatingSystem" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Primary Operating System
                </label>
                <select
                  id="operatingSystem"
                  name="operatingSystem"
                  value={formData.operatingSystem}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="windows">Windows</option>
                  <option value="macos">macOS</option>
                  <option value="linux">Linux</option>
                </select>
              </div>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center">
                  <input
                    id="emailUpdates"
                    name="emailUpdates"
                    type="checkbox"
                    checked={formData.emailUpdates}
                    onChange={handleChange}
                    className="h-4 w-4 text-purple-600 border-gray-300 rounded"
                  />
                  <label htmlFor="emailUpdates" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    Send me updates about Life Navigator Desktop
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    id="betaTester"
                    name="betaTester"
                    type="checkbox"
                    checked={formData.betaTester}
                    onChange={handleChange}
                    className="h-4 w-4 text-purple-600 border-gray-300 rounded"
                  />
                  <label htmlFor="betaTester" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    I'm interested in being a beta tester
                  </label>
                </div>
              </div>
              
              <button
                type="submit"
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-md transition-colors"
              >
                Join Waitlist
              </button>
              
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                By submitting this form, you agree to our Privacy Policy and Terms of Service.
                We'll never share your information with third parties.
              </p>
            </form>
          ) : (
            <div className="p-6 flex flex-col items-center">
              <div className="bg-green-100 dark:bg-green-900/30 p-6 rounded-lg mb-6 text-center w-full">
                <h3 className="text-xl font-semibold mb-2 text-green-800 dark:text-green-300">
                  You're on the list!
                </h3>
                <p className="text-green-700 dark:text-green-200">
                  Thank you for joining our waitlist. We'll notify you when the Life Navigator Desktop App becomes available.
                  {formData.betaTester && " Since you expressed interest in beta testing, we'll reach out when our beta program opens."}
                </p>
              </div>
              
              <Link 
                href="/dashboard" 
                className="px-5 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-md font-medium transition-colors"
              >
                Return to Dashboard
              </Link>
            </div>
          )}
        </div>
        
        <div className="mt-8 flex justify-center">
          <Link 
            href="/dashboard" 
            className="px-5 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md font-medium transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}