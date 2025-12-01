'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, getAuthHeaders } from '@/hooks/useAuth';
import {
  UserCircleIcon,
  BriefcaseIcon,
  AcademicCapIcon,
  HeartIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  TrophyIcon,
  CalendarIcon,
  MapPinIcon,
  PhoneIcon,
  GlobeAltIcon,
  PencilIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface ProfileStats {
  overview: {
    daysSinceJoining: number;
    profileCompletion: number;
    totalAchievements: number;
    unreadNotifications: number;
  };
  goals: {
    total: number;
    active: number;
  };
  finance: {
    connectedAccounts: number;
    totalInvestments: number;
  };
  career: {
    title: string | null;
    company: string | null;
    connections: number;
    skills: number;
  };
  education: {
    studyStreak: number;
    totalStudyHours: number;
    certifications: number;
  };
  health: {
    connectedDevices: number;
    avgSteps: number;
    avgHeartRate: number | null;
  };
  activity: {
    eventsLast30Days: number;
  };
  achievements: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
  }>;
}

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  createdAt: string;
  profile: {
    // Demographics
    dateOfBirth: string | null;
    gender: string | null;
    phoneNumber: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    country: string | null;
    maritalStatus: string | null;
    dependents: number | null;
    // Professional
    occupation: string | null;
    employer: string | null;
    industry: string | null;
    yearsOfExperience: number | null;
    educationLevel: string | null;
    linkedInUrl: string | null;
    websiteUrl: string | null;
    // Financial
    incomeRange: string | null;
    riskTolerance: string | null;
    retirementAge: number | null;
    // Health
    healthStatus: string | null;
    fitnessLevel: string | null;
    dietaryPreferences: string | null;
    // Lifestyle
    bio: string | null;
    profileCompletion: number;
  } | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'edit'>('overview');

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);

  // Form state for editing
  const [formData, setFormData] = useState({
    // Basic
    name: '',
    bio: '',
    phoneNumber: '',
    // Location
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
    // Demographics
    dateOfBirth: '',
    gender: '',
    maritalStatus: '',
    dependents: 0,
    // Professional
    occupation: '',
    employer: '',
    industry: '',
    yearsOfExperience: 0,
    educationLevel: '',
    linkedInUrl: '',
    websiteUrl: '',
    // Financial
    incomeRange: '',
    riskTolerance: '',
    retirementAge: 65,
    // Health
    healthStatus: '',
    fitnessLevel: '',
    dietaryPreferences: '',
  });

  // Fetch profile and stats
  useEffect(() => {
    const fetchData = async () => {
      if (!isAuthenticated) return;

      try {
        const headers = getAuthHeaders();

        // Fetch profile
        const profileRes = await fetch('/api/user/profile', { headers });
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setProfile(profileData);

          // Set form data
          if (profileData.profile) {
            setFormData({
              name: profileData.name || '',
              bio: profileData.profile.bio || '',
              phoneNumber: profileData.profile.phoneNumber || '',
              address: profileData.profile.address || '',
              city: profileData.profile.city || '',
              state: profileData.profile.state || '',
              zipCode: profileData.profile.zipCode || '',
              country: profileData.profile.country || 'US',
              dateOfBirth: profileData.profile.dateOfBirth ? new Date(profileData.profile.dateOfBirth).toISOString().split('T')[0] : '',
              gender: profileData.profile.gender || '',
              maritalStatus: profileData.profile.maritalStatus || '',
              dependents: profileData.profile.dependents || 0,
              occupation: profileData.profile.occupation || '',
              employer: profileData.profile.employer || '',
              industry: profileData.profile.industry || '',
              yearsOfExperience: profileData.profile.yearsOfExperience || 0,
              educationLevel: profileData.profile.educationLevel || '',
              linkedInUrl: profileData.profile.linkedInUrl || '',
              websiteUrl: profileData.profile.websiteUrl || '',
              incomeRange: profileData.profile.incomeRange || '',
              riskTolerance: profileData.profile.riskTolerance || '',
              retirementAge: profileData.profile.retirementAge || 65,
              healthStatus: profileData.profile.healthStatus || '',
              fitnessLevel: profileData.profile.fitnessLevel || '',
              dietaryPreferences: profileData.profile.dietaryPreferences || '',
            });
          }
        }
        setIsLoading(false);

        // Fetch stats
        const statsRes = await fetch('/api/user/profile/stats', { headers });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
        setStatsLoading(false);
      } catch (error) {
        console.error('Error fetching profile data:', error);
        setIsLoading(false);
        setStatsLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const headers = getAuthHeaders();
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to update profile');

      const updatedProfile = await response.json();
      setProfile(updatedProfile);

      // Refresh stats
      const statsRes = await fetch('/api/user/profile/stats', { headers });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      alert('Profile updated successfully!');
      setActiveTab('overview');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[500px]">
        <div className="text-gray-600 dark:text-gray-400">Loading profile...</div>
      </div>
    );
  }

  if (!isAuthenticated || !profile) {
    return null;
  }

  const profileCompletion = profile.profile?.profileCompletion || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
              {profile.name ? profile.name.charAt(0).toUpperCase() : profile.email.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {profile.name || 'User'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">{profile.email}</p>
              {stats?.career.title && (
                <p className="text-gray-700 dark:text-gray-300 mt-2">
                  {stats.career.title} {stats.career.company && `at ${stats.career.company}`}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setActiveTab(activeTab === 'overview' ? 'edit' : 'overview')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <PencilIcon className="w-5 h-5" />
            {activeTab === 'overview' ? 'Edit Profile' : 'View Profile'}
          </button>
        </div>

        {/* Profile Completion Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Profile Completion
            </span>
            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
              {profileCompletion}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${profileCompletion}%` }}
            />
          </div>
          {profileCompletion < 100 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Complete your profile to unlock all features and get better recommendations
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'edit'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Edit Information
          </button>
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Grid */}
          {statsLoading ? (
            <div className="text-center py-8 text-gray-500">Loading statistics...</div>
          ) : stats && (
            <>
              {/* Key Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  icon={<CalendarIcon className="w-6 h-6" />}
                  label="Days Active"
                  value={stats.overview.daysSinceJoining.toString()}
                  color="blue"
                />
                <StatCard
                  icon={<TrophyIcon className="w-6 h-6" />}
                  label="Achievements"
                  value={stats.overview.totalAchievements.toString()}
                  color="yellow"
                />
                <StatCard
                  icon={<ChartBarIcon className="w-6 h-6" />}
                  label="Active Goals"
                  value={stats.goals.active.toString()}
                  color="green"
                />
                <StatCard
                  icon={<AcademicCapIcon className="w-6 h-6" />}
                  label="Study Streak"
                  value={`${stats.education.studyStreak} days`}
                  color="purple"
                />
              </div>

              {/* Detailed Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Finance Section */}
                <SectionCard
                  title="Finance"
                  icon={<CurrencyDollarIcon className="w-5 h-5" />}
                  iconColor="green"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Connected Accounts</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {stats.finance.connectedAccounts}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Investments</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {stats.finance.totalInvestments}
                      </span>
                    </div>
                    {profile.profile?.incomeRange && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Income Range</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {formatIncomeRange(profile.profile.incomeRange)}
                        </span>
                      </div>
                    )}
                  </div>
                </SectionCard>

                {/* Career Section */}
                <SectionCard
                  title="Career"
                  icon={<BriefcaseIcon className="w-5 h-5" />}
                  iconColor="blue"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Network Size</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {stats.career.connections}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Skills</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {stats.career.skills}
                      </span>
                    </div>
                    {profile.profile?.yearsOfExperience && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Experience</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {profile.profile.yearsOfExperience} years
                        </span>
                      </div>
                    )}
                  </div>
                </SectionCard>

                {/* Education Section */}
                <SectionCard
                  title="Education"
                  icon={<AcademicCapIcon className="w-5 h-5" />}
                  iconColor="purple"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Study Streak</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {stats.education.studyStreak} days
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Monthly Study Hours</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {stats.education.totalStudyHours}h
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Certifications</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {stats.education.certifications}
                      </span>
                    </div>
                  </div>
                </SectionCard>

                {/* Health Section */}
                <SectionCard
                  title="Health & Wellness"
                  icon={<HeartIcon className="w-5 h-5" />}
                  iconColor="red"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Connected Devices</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {stats.health.connectedDevices}
                      </span>
                    </div>
                    {stats.health.avgSteps > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Avg. Daily Steps</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {stats.health.avgSteps.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {stats.health.avgHeartRate && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Avg. Heart Rate</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {stats.health.avgHeartRate} bpm
                        </span>
                      </div>
                    )}
                  </div>
                </SectionCard>
              </div>

              {/* Achievements */}
              {stats.achievements.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <TrophyIcon className="w-5 h-5 text-yellow-500" />
                    Achievements
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats.achievements.map((achievement) => (
                      <div
                        key={achievement.id}
                        className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800"
                      >
                        <span className="text-3xl">{achievement.icon}</span>
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {achievement.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {achievement.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Personal Information */}
              {profile.profile && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <UserCircleIcon className="w-5 h-5 text-blue-500" />
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {profile.profile.phoneNumber && (
                      <InfoItem
                        icon={<PhoneIcon className="w-4 h-4" />}
                        label="Phone"
                        value={profile.profile.phoneNumber}
                      />
                    )}
                    {(profile.profile.city || profile.profile.state) && (
                      <InfoItem
                        icon={<MapPinIcon className="w-4 h-4" />}
                        label="Location"
                        value={`${profile.profile.city || ''}${profile.profile.city && profile.profile.state ? ', ' : ''}${profile.profile.state || ''}`}
                      />
                    )}
                    {profile.profile.linkedInUrl && (
                      <InfoItem
                        icon={<GlobeAltIcon className="w-4 h-4" />}
                        label="LinkedIn"
                        value={
                          <a href={profile.profile.linkedInUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            View Profile
                          </a>
                        }
                      />
                    )}
                    {profile.profile.websiteUrl && (
                      <InfoItem
                        icon={<GlobeAltIcon className="w-4 h-4" />}
                        label="Website"
                        value={
                          <a href={profile.profile.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            Visit Website
                          </a>
                        }
                      />
                    )}
                  </div>
                  {profile.profile.bio && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-gray-700 dark:text-gray-300">{profile.profile.bio}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Edit Tab */}
      {activeTab === 'edit' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <form onSubmit={handleSubmit} className="p-6 space-y-8">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Gender
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non-binary">Non-binary</option>
                    <option value="prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Marital Status
                  </label>
                  <select
                    name="maritalStatus"
                    value={formData.maritalStatus}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    <option value="">Select...</option>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                    <option value="partnered">Partnered</option>
                  </select>
                </div>
              </div>
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bio
                </label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Tell us about yourself..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Location
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    State
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Country
                  </label>
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Professional Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Professional Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Occupation
                  </label>
                  <input
                    type="text"
                    name="occupation"
                    value={formData.occupation}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Employer
                  </label>
                  <input
                    type="text"
                    name="employer"
                    value={formData.employer}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Industry
                  </label>
                  <input
                    type="text"
                    name="industry"
                    value={formData.industry}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Years of Experience
                  </label>
                  <input
                    type="number"
                    name="yearsOfExperience"
                    value={formData.yearsOfExperience}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Education Level
                  </label>
                  <select
                    name="educationLevel"
                    value={formData.educationLevel}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    <option value="">Select...</option>
                    <option value="high_school">High School</option>
                    <option value="associates">Associate's Degree</option>
                    <option value="bachelors">Bachelor's Degree</option>
                    <option value="masters">Master's Degree</option>
                    <option value="doctorate">Doctorate</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    LinkedIn URL
                  </label>
                  <input
                    type="url"
                    name="linkedInUrl"
                    value={formData.linkedInUrl}
                    onChange={handleChange}
                    placeholder="https://linkedin.com/in/..."
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Website URL
                  </label>
                  <input
                    type="url"
                    name="websiteUrl"
                    value={formData.websiteUrl}
                    onChange={handleChange}
                    placeholder="https://..."
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Financial Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Financial Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Income Range
                  </label>
                  <select
                    name="incomeRange"
                    value={formData.incomeRange}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    <option value="">Select...</option>
                    <option value="<25k">&lt; $25,000</option>
                    <option value="25k-50k">$25,000 - $50,000</option>
                    <option value="50k-75k">$50,000 - $75,000</option>
                    <option value="75k-100k">$75,000 - $100,000</option>
                    <option value="100k-150k">$100,000 - $150,000</option>
                    <option value="150k-200k">$150,000 - $200,000</option>
                    <option value="200k+">$200,000+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Risk Tolerance
                  </label>
                  <select
                    name="riskTolerance"
                    value={formData.riskTolerance}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    <option value="">Select...</option>
                    <option value="conservative">Conservative</option>
                    <option value="moderate">Moderate</option>
                    <option value="aggressive">Aggressive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Target Retirement Age
                  </label>
                  <input
                    type="number"
                    name="retirementAge"
                    value={formData.retirementAge}
                    onChange={handleChange}
                    min="50"
                    max="80"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Health Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Health & Wellness
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Health Status
                  </label>
                  <select
                    name="healthStatus"
                    value={formData.healthStatus}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    <option value="">Select...</option>
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Fitness Level
                  </label>
                  <select
                    name="fitnessLevel"
                    value={formData.fitnessLevel}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    <option value="">Select...</option>
                    <option value="sedentary">Sedentary</option>
                    <option value="lightly_active">Lightly Active</option>
                    <option value="moderately_active">Moderately Active</option>
                    <option value="very_active">Very Active</option>
                    <option value="extremely_active">Extremely Active</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Dietary Preferences
                  </label>
                  <select
                    name="dietaryPreferences"
                    value={formData.dietaryPreferences}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    <option value="">Select...</option>
                    <option value="none">No Restrictions</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="pescatarian">Pescatarian</option>
                    <option value="keto">Keto</option>
                    <option value="paleo">Paleo</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="px-6 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="w-5 h-5" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// Helper Components
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'blue' | 'green' | 'yellow' | 'purple' | 'red';
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-600 dark:text-yellow-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400',
  };

  return (
    <div className={`p-6 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-center gap-3">
        <div>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

interface SectionCardProps {
  title: string;
  icon: React.ReactNode;
  iconColor: string;
  children: React.ReactNode;
}

function SectionCard({ title, icon, iconColor, children }: SectionCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className={`text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2 text-${iconColor}-600`}>
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

function InfoItem({ icon, label, value }: InfoItemProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-gray-400 mt-0.5">{icon}</div>
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
        <p className="text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

// Helper functions
function formatIncomeRange(range: string): string {
  const formats: { [key: string]: string } = {
    '<25k': '< $25,000',
    '25k-50k': '$25,000 - $50,000',
    '50k-75k': '$50,000 - $75,000',
    '75k-100k': '$75,000 - $100,000',
    '100k-150k': '$100,000 - $150,000',
    '150k-200k': '$150,000 - $200,000',
    '200k+': '$200,000+',
  };
  return formats[range] || range;
}
