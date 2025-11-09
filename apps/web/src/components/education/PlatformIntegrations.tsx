"use client";

import React from 'react';

interface Platform {
  id: string;
  name: string;
  description: string;
  logo: string; // URL or placeholder
  category: string;
  isAvailable: boolean;
  comingSoon: boolean;
  features?: string[];
}

const platforms: Platform[] = [
  {
    id: 'icarus',
    name: 'Icarus.AI',
    description: 'AI-powered adaptive learning platform with personalized course recommendations',
    logo: '/logos/icarus.png',
    category: 'AI Learning',
    isAvailable: false,
    comingSoon: true,
    features: ['AI Tutor', 'Adaptive Learning', 'Skill Assessments']
  },
  {
    id: 'udemy',
    name: 'Udemy',
    description: "World's largest online course marketplace with 200,000+ courses",
    logo: '/logos/udemy.png',
    category: 'Course Marketplace',
    isAvailable: false,
    comingSoon: true,
    features: ['200K+ Courses', 'Lifetime Access', 'Certificate of Completion']
  },
  {
    id: 'coursera',
    name: 'Coursera',
    description: 'University partnerships offering degrees, certificates, and professional courses',
    logo: '/logos/coursera.png',
    category: 'University Courses',
    isAvailable: false,
    comingSoon: true,
    features: ['University Degrees', 'Professional Certificates', 'Guided Projects']
  },
  {
    id: 'edx',
    name: 'edX',
    description: 'MIT and Harvard founded platform with academic and professional courses',
    logo: '/logos/edx.png',
    category: 'Academic',
    isAvailable: false,
    comingSoon: true,
    features: ['MicroMasters', 'Professional Certificates', 'University Credits']
  },
  {
    id: 'cfi',
    name: 'Corporate Finance Institute',
    description: 'Leading provider of financial analyst certification and training programs',
    logo: '/logos/cfi.png',
    category: 'Finance',
    isAvailable: false,
    comingSoon: true,
    features: ['FMVA Certification', 'Finance Courses', 'Excel Training']
  },
  {
    id: 'linkedin',
    name: 'LinkedIn Learning',
    description: 'Professional development courses with industry expert instructors',
    logo: '/logos/linkedin-learning.png',
    category: 'Professional',
    isAvailable: false,
    comingSoon: true,
    features: ['Expert Instructors', 'Skill Paths', 'LinkedIn Integration']
  }
];

export default function PlatformIntegrations() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Platform Integrations
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Connect your learning accounts to track all your courses in one place
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {platforms.map((platform) => (
          <div
            key={platform.id}
            className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow"
          >
            {/* Coming Soon Badge */}
            {platform.comingSoon && (
              <div className="absolute top-4 right-4">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-full text-xs font-medium">
                  Coming Soon
                </span>
              </div>
            )}

            {/* Platform Logo Placeholder */}
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl font-bold text-white">
                {platform.name.charAt(0)}
              </span>
            </div>

            {/* Platform Info */}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {platform.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {platform.description}
            </p>

            {/* Features */}
            {platform.features && (
              <div className="flex flex-wrap gap-2 mb-4">
                {platform.features.map((feature, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            )}

            {/* Connect Button (Disabled) */}
            <button
              disabled
              className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-md cursor-not-allowed"
            >
              {platform.comingSoon ? 'Coming Soon' : 'Connect Account'}
            </button>
          </div>
        ))}
      </div>

      {/* Notification Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
              Want early access?
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
              We&apos;re actively working on these integrations. Join the waitlist to be notified when they&apos;re available.
            </p>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium">
              Join Waitlist
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
