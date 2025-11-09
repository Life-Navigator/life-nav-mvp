"use client";

import React, { useState } from 'react';
import {
  Activity,
  Heart,
  Moon,
  Apple,
  Watch,
  Smartphone,
  Brain,
  Utensils,
  Stethoscope,
  FlaskConical,
  Zap,
  Shield,
  Lock,
  CheckCircle2,
  Search,
  Clock,
  RefreshCw,
  AlertCircle,
  Waves,
  TrendingUp
} from 'lucide-react';

interface HealthPlatform {
  id: string;
  name: string;
  description: string;
  category: 'Fitness Trackers' | 'Health Apps' | 'Medical' | 'Nutrition' | 'Mental Health';
  isConnected: boolean;
  comingSoon: boolean;
  features: string[];
  dataTypes: string[];
  privacyCompliance: string[];
  pricing: 'Free' | 'Paid' | 'Freemium';
  syncFrequency?: string;
  lastSync?: string;
  gradientFrom: string;
  gradientTo: string;
  icon: string;
}

const healthPlatforms: HealthPlatform[] = [
  // Fitness Trackers
  {
    id: 'fitbit',
    name: 'Fitbit',
    description: 'Activity tracking and health monitoring with comprehensive wellness insights',
    category: 'Fitness Trackers',
    isConnected: false,
    comingSoon: true,
    features: ['Activity Tracking', 'Heart Rate Monitoring', 'Sleep Analysis', 'GPS Tracking'],
    dataTypes: ['Steps', 'Heart Rate', 'Sleep', 'Calories', 'Active Minutes'],
    privacyCompliance: ['HIPAA Compliant', 'GDPR Compliant', 'Data Encryption'],
    pricing: 'Freemium',
    syncFrequency: 'Real-time',
    gradientFrom: 'from-teal-500',
    gradientTo: 'to-cyan-500',
    icon: 'Activity'
  },
  {
    id: 'apple-health',
    name: 'Apple Health',
    description: 'iOS health data aggregation and centralized health records',
    category: 'Health Apps',
    isConnected: false,
    comingSoon: true,
    features: ['Health Data Hub', 'Medical Records', 'Fitness Integration', 'Vital Signs'],
    dataTypes: ['All Health Metrics', 'Medical Records', 'Lab Results', 'Medications'],
    privacyCompliance: ['End-to-end Encryption', 'On-device Processing', 'HIPAA Ready'],
    pricing: 'Free',
    syncFrequency: 'Real-time',
    gradientFrom: 'from-gray-700',
    gradientTo: 'to-gray-900',
    icon: 'Apple'
  },
  {
    id: 'google-fit',
    name: 'Google Fit',
    description: 'Android fitness tracking with AI-powered health insights',
    category: 'Fitness Trackers',
    isConnected: false,
    comingSoon: true,
    features: ['Activity Goals', 'Heart Points', 'Sleep Tracking', 'Workout Detection'],
    dataTypes: ['Steps', 'Heart Rate', 'Weight', 'Nutrition', 'Workouts'],
    privacyCompliance: ['GDPR Compliant', 'Secure Cloud Storage', 'User Controlled Data'],
    pricing: 'Free',
    syncFrequency: 'Real-time',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-green-500',
    icon: 'Smartphone'
  },
  {
    id: 'garmin',
    name: 'Garmin Connect',
    description: 'GPS and fitness devices with advanced athletic performance metrics',
    category: 'Fitness Trackers',
    isConnected: false,
    comingSoon: true,
    features: ['GPS Tracking', 'VO2 Max', 'Training Load', 'Recovery Time'],
    dataTypes: ['GPS Routes', 'Heart Rate Variability', 'Training Metrics', 'Sleep Score'],
    privacyCompliance: ['ISO 27001 Certified', 'Data Encryption', 'Privacy Controls'],
    pricing: 'Freemium',
    syncFrequency: 'Hourly',
    gradientFrom: 'from-blue-600',
    gradientTo: 'to-cyan-600',
    icon: 'Watch'
  },
  {
    id: 'whoop',
    name: 'Whoop',
    description: 'Recovery and strain tracking for optimizing athletic performance',
    category: 'Fitness Trackers',
    isConnected: false,
    comingSoon: true,
    features: ['Recovery Score', 'Strain Coach', 'Sleep Performance', 'HRV Analysis'],
    dataTypes: ['Recovery', 'Strain', 'Sleep', 'HRV', 'Respiratory Rate'],
    privacyCompliance: ['HIPAA Compliant', 'SOC 2 Type II', 'Encrypted Data'],
    pricing: 'Paid',
    syncFrequency: 'Real-time',
    gradientFrom: 'from-purple-600',
    gradientTo: 'to-pink-600',
    icon: 'Zap'
  },
  {
    id: 'oura',
    name: 'Oura Ring',
    description: 'Sleep and readiness tracking with personalized health insights',
    category: 'Fitness Trackers',
    isConnected: false,
    comingSoon: true,
    features: ['Sleep Stages', 'Readiness Score', 'Activity Tracking', 'Body Temperature'],
    dataTypes: ['Sleep Quality', 'Readiness', 'HRV', 'Body Temperature', 'Activity'],
    privacyCompliance: ['GDPR Compliant', 'Encrypted Storage', 'User Privacy First'],
    pricing: 'Paid',
    syncFrequency: 'Daily',
    gradientFrom: 'from-indigo-600',
    gradientTo: 'to-purple-600',
    icon: 'Moon'
  },
  // Health Apps
  {
    id: 'myfitnesspal',
    name: 'MyFitnessPal',
    description: 'Nutrition and calorie tracking with extensive food database',
    category: 'Nutrition',
    isConnected: false,
    comingSoon: true,
    features: ['Calorie Counter', 'Macro Tracking', 'Recipe Importer', 'Barcode Scanner'],
    dataTypes: ['Calories', 'Macros', 'Micronutrients', 'Water Intake', 'Weight'],
    privacyCompliance: ['Privacy Shield Certified', 'Data Encryption', 'User Consent'],
    pricing: 'Freemium',
    syncFrequency: 'Real-time',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-blue-600',
    icon: 'Utensils'
  },
  {
    id: 'strava',
    name: 'Strava',
    description: 'Running and cycling social network with performance analysis',
    category: 'Health Apps',
    isConnected: false,
    comingSoon: true,
    features: ['Activity Feed', 'Route Planning', 'Segment Leaderboards', 'Training Plans'],
    dataTypes: ['GPS Activities', 'Performance Metrics', 'Heart Rate', 'Power Data'],
    privacyCompliance: ['GDPR Compliant', 'Privacy Zones', 'Data Portability'],
    pricing: 'Freemium',
    syncFrequency: 'Real-time',
    gradientFrom: 'from-orange-500',
    gradientTo: 'to-red-500',
    icon: 'TrendingUp'
  },
  {
    id: 'peloton',
    name: 'Peloton',
    description: 'Connected fitness platform with live and on-demand classes',
    category: 'Health Apps',
    isConnected: false,
    comingSoon: true,
    features: ['Live Classes', 'On-demand Workouts', 'Performance Metrics', 'Social Features'],
    dataTypes: ['Workout History', 'Output Metrics', 'Heart Rate', 'Calories', 'Achievements'],
    privacyCompliance: ['Privacy Policy', 'Secure Data Storage', 'User Controls'],
    pricing: 'Paid',
    syncFrequency: 'Real-time',
    gradientFrom: 'from-red-600',
    gradientTo: 'to-orange-600',
    icon: 'Activity'
  },
  {
    id: 'headspace',
    name: 'Headspace',
    description: 'Meditation and mindfulness app for mental wellness',
    category: 'Mental Health',
    isConnected: false,
    comingSoon: true,
    features: ['Guided Meditation', 'Sleep Sounds', 'Mindfulness Exercises', 'Stress Relief'],
    dataTypes: ['Meditation Minutes', 'Mood Tracking', 'Sleep Sessions', 'Mindful Days'],
    privacyCompliance: ['HIPAA Compliant', 'Privacy First', 'Anonymous Usage'],
    pricing: 'Paid',
    syncFrequency: 'Daily',
    gradientFrom: 'from-orange-400',
    gradientTo: 'to-pink-400',
    icon: 'Brain'
  },
  // Medical Platforms
  {
    id: 'epic-mychart',
    name: 'Epic MyChart',
    description: 'Electronic health records access and patient portal',
    category: 'Medical',
    isConnected: false,
    comingSoon: true,
    features: ['Medical Records', 'Test Results', 'Appointment Scheduling', 'Messaging'],
    dataTypes: ['Medical History', 'Lab Results', 'Medications', 'Immunizations', 'Vitals'],
    privacyCompliance: ['HIPAA Compliant', 'HL7 FHIR', 'Secure Messaging', 'Audit Logs'],
    pricing: 'Free',
    syncFrequency: 'Real-time',
    gradientFrom: 'from-blue-700',
    gradientTo: 'to-indigo-700',
    icon: 'Stethoscope'
  },
  {
    id: 'cerner',
    name: 'Cerner Health',
    description: 'Patient portal for accessing health information and care team',
    category: 'Medical',
    isConnected: false,
    comingSoon: true,
    features: ['Health Summary', 'Prescription Refills', 'Bill Payment', 'Care Team Access'],
    dataTypes: ['Health Records', 'Lab Values', 'Prescriptions', 'Appointments', 'Billing'],
    privacyCompliance: ['HIPAA Compliant', 'Secure Access', 'Data Encryption', 'Audit Trails'],
    pricing: 'Free',
    syncFrequency: 'Real-time',
    gradientFrom: 'from-teal-600',
    gradientTo: 'to-green-600',
    icon: 'Stethoscope'
  },
  {
    id: 'teladoc',
    name: 'Teladoc',
    description: 'Telehealth services for virtual doctor visits and consultations',
    category: 'Medical',
    isConnected: false,
    comingSoon: true,
    features: ['Virtual Visits', '24/7 Access', 'Prescription Services', 'Mental Health'],
    dataTypes: ['Visit History', 'Prescriptions', 'Health Assessments', 'Care Plans'],
    privacyCompliance: ['HIPAA Compliant', 'Secure Video', 'Protected Health Info', 'Privacy Controls'],
    pricing: 'Freemium',
    syncFrequency: 'On-demand',
    gradientFrom: 'from-green-500',
    gradientTo: 'to-emerald-500',
    icon: 'Heart'
  },
  {
    id: 'labcorp',
    name: 'LabCorp',
    description: 'Lab results and diagnostic test information access',
    category: 'Medical',
    isConnected: false,
    comingSoon: true,
    features: ['Lab Results', 'Test History', 'Result Notifications', 'Share with Doctors'],
    dataTypes: ['Lab Results', 'Test Orders', 'Result Trends', 'Reference Ranges'],
    privacyCompliance: ['HIPAA Compliant', 'Secure Portal', 'Encrypted Data', 'Access Controls'],
    pricing: 'Free',
    syncFrequency: 'As Available',
    gradientFrom: 'from-blue-600',
    gradientTo: 'to-purple-600',
    icon: 'FlaskConical'
  },
  // Nutrition
  {
    id: 'cronometer',
    name: 'Cronometer',
    description: 'Detailed nutrition tracking with micronutrient analysis',
    category: 'Nutrition',
    isConnected: false,
    comingSoon: true,
    features: ['Nutrient Tracking', 'Biometric Logging', 'Custom Foods', 'Reports'],
    dataTypes: ['Calories', 'Macros', 'Micronutrients', 'Biometrics', 'Custom Metrics'],
    privacyCompliance: ['Privacy Policy', 'Data Encryption', 'User Owned Data'],
    pricing: 'Freemium',
    syncFrequency: 'Real-time',
    gradientFrom: 'from-green-600',
    gradientTo: 'to-teal-600',
    icon: 'Utensils'
  },
  {
    id: 'noom',
    name: 'Noom',
    description: 'Weight loss and behavior change program with psychology-based approach',
    category: 'Nutrition',
    isConnected: false,
    comingSoon: true,
    features: ['Food Logging', 'Coaching', 'Behavior Change', 'Weight Tracking'],
    dataTypes: ['Weight', 'Food Intake', 'Exercise', 'Mood', 'Progress Photos'],
    privacyCompliance: ['HIPAA Compliant', 'Privacy Protected', 'Secure Data'],
    pricing: 'Paid',
    syncFrequency: 'Daily',
    gradientFrom: 'from-orange-500',
    gradientTo: 'to-yellow-500',
    icon: 'TrendingUp'
  }
];

const categoryColors = {
  'Fitness Trackers': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  'Health Apps': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'Medical': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  'Nutrition': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'Mental Health': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
};

const getIcon = (iconName: string) => {
  const icons: { [key: string]: React.ReactNode } = {
    Activity: <Activity className="w-8 h-8" />,
    Heart: <Heart className="w-8 h-8" />,
    Moon: <Moon className="w-8 h-8" />,
    Apple: <Apple className="w-8 h-8" />,
    Watch: <Watch className="w-8 h-8" />,
    Smartphone: <Smartphone className="w-8 h-8" />,
    Brain: <Brain className="w-8 h-8" />,
    Utensils: <Utensils className="w-8 h-8" />,
    Stethoscope: <Stethoscope className="w-8 h-8" />,
    FlaskConical: <FlaskConical className="w-8 h-8" />,
    Zap: <Zap className="w-8 h-8" />,
    TrendingUp: <TrendingUp className="w-8 h-8" />
  };
  return icons[iconName] || <Activity className="w-8 h-8" />;
};

export default function HealthIntegrations() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedPlatform, setSelectedPlatform] = useState<HealthPlatform | null>(null);

  const categories = ['All', ...Array.from(new Set(healthPlatforms.map(p => p.category)))];

  const filteredPlatforms = healthPlatforms.filter(platform => {
    const matchesSearch = platform.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         platform.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || platform.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const connectedPlatforms = healthPlatforms.filter(p => p.isConnected);
  const comingSoonPlatforms = healthPlatforms.filter(p => p.comingSoon);

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Health & Wellness Integrations
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Connect your health apps and devices to track your wellness journey in one unified dashboard
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-teal-100 text-sm font-medium">Connected</p>
              <p className="text-3xl font-bold mt-1">{connectedPlatforms.length}</p>
            </div>
            <CheckCircle2 className="w-12 h-12 text-teal-100" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Coming Soon</p>
              <p className="text-3xl font-bold mt-1">{comingSoonPlatforms.length}</p>
            </div>
            <Clock className="w-12 h-12 text-purple-100" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Platforms</p>
              <p className="text-3xl font-bold mt-1">{healthPlatforms.length}</p>
            </div>
            <Activity className="w-12 h-12 text-blue-100" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Last Sync</p>
              <p className="text-lg font-bold mt-1">Never</p>
            </div>
            <RefreshCw className="w-12 h-12 text-green-100" />
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search health platforms and devices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State for Connected */}
      {connectedPlatforms.length === 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-xl p-12 text-center">
          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            No Devices Connected Yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Connect your fitness trackers, health apps, and medical portals to get a complete view of your wellness journey
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <div className="px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Automatic Sync</span>
              </div>
            </div>
            <div className="px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">HIPAA Compliant</span>
              </div>
            </div>
            <div className="px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Encrypted Data</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Coming Soon Platforms by Category */}
      {categories.filter(cat => cat !== 'All').map(category => {
        const categoryPlatforms = filteredPlatforms.filter(
          p => p.comingSoon && p.category === category
        );

        if (categoryPlatforms.length === 0) return null;

        return (
          <div key={category} className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {category}
              </h3>
              <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
                Coming Soon
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryPlatforms.map((platform) => (
                <PlatformCard
                  key={platform.id}
                  platform={platform}
                  onClick={() => setSelectedPlatform(platform)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Privacy & Security Notice */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              HIPAA Compliant & Privacy Protected
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
              Your health data is protected with bank-level encryption and HIPAA compliance. We never share your personal
              health information without your explicit consent. All integrations use secure OAuth authentication and encrypted
              data transmission.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                HIPAA Compliant
              </span>
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                End-to-end Encryption
              </span>
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                GDPR Compliant
              </span>
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                SOC 2 Certified
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Data Retention Policy */}
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
          Data Sync & Retention
        </h4>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-3">
            <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white mb-1">Automatic Syncing</p>
              <p className="text-gray-600 dark:text-gray-400">
                Your data syncs automatically based on each platform's frequency (real-time to daily)
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white mb-1">Your Data, Your Control</p>
              <p className="text-gray-600 dark:text-gray-400">
                You can disconnect any platform and delete all synced data at any time
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Waitlist Section */}
      <div className="bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl p-8 text-white">
        <div className="max-w-2xl">
          <h3 className="text-2xl font-bold mb-2">Get Early Access to Health Integrations</h3>
          <p className="text-teal-100 mb-6">
            We're actively developing these health platform integrations. Join the waitlist to be first in line
            when they launch and help shape the features you want to see.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 rounded-lg bg-white/20 backdrop-blur-sm text-white placeholder-teal-200 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            <button className="px-6 py-3 bg-white text-teal-600 rounded-lg hover:bg-teal-50 transition-colors font-semibold whitespace-nowrap">
              Join Waitlist
            </button>
          </div>
        </div>
      </div>

      {/* Platform Detail Modal */}
      {selectedPlatform && (
        <PlatformDetailModal
          platform={selectedPlatform}
          onClose={() => setSelectedPlatform(null)}
        />
      )}
    </div>
  );
}

// Platform Card Component
function PlatformCard({ platform, onClick }: { platform: HealthPlatform; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl hover:border-teal-500 dark:hover:border-teal-400 transition-all cursor-pointer"
    >
      {/* Status Badge */}
      <div className="absolute top-4 right-4">
        {platform.isConnected ? (
          <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full text-xs font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Connected
          </span>
        ) : platform.comingSoon ? (
          <span className="px-3 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-full text-xs font-medium">
            Coming Soon
          </span>
        ) : null}
      </div>

      {/* Platform Icon */}
      <div className={`w-16 h-16 bg-gradient-to-br ${platform.gradientFrom} ${platform.gradientTo} rounded-xl flex items-center justify-center mb-4 text-white group-hover:scale-110 transition-transform`}>
        {getIcon(platform.icon)}
      </div>

      {/* Platform Info */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {platform.name}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
        {platform.description}
      </p>

      {/* Category */}
      <div className="mb-3">
        <span className={`px-2 py-1 rounded text-xs font-medium ${categoryColors[platform.category]}`}>
          {platform.category}
        </span>
      </div>

      {/* Data Types */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {platform.dataTypes.slice(0, 2).map((dataType, idx) => (
          <span
            key={idx}
            className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
          >
            {dataType}
          </span>
        ))}
        {platform.dataTypes.length > 2 && (
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
            +{platform.dataTypes.length - 2}
          </span>
        )}
      </div>

      {/* Sync Frequency */}
      {platform.syncFrequency && (
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-4">
          <RefreshCw className="w-3 h-3" />
          <span>Syncs {platform.syncFrequency}</span>
        </div>
      )}

      {/* Action Button */}
      <button
        disabled={platform.comingSoon}
        className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
          platform.isConnected
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
            : platform.comingSoon
            ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            : 'bg-teal-600 text-white hover:bg-teal-700'
        }`}
      >
        {platform.isConnected ? 'Manage Connection' : platform.comingSoon ? 'Coming Soon' : 'Connect Device'}
      </button>
    </div>
  );
}

// Platform Detail Modal Component
function PlatformDetailModal({ platform, onClose }: { platform: HealthPlatform; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 bg-gradient-to-br ${platform.gradientFrom} ${platform.gradientTo} rounded-xl flex items-center justify-center text-white`}>
                {getIcon(platform.icon)}
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {platform.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {platform.category}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <AlertCircle className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Description */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">About</h4>
            <p className="text-gray-600 dark:text-gray-400">{platform.description}</p>
          </div>

          {/* Features */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Key Features</h4>
            <div className="space-y-2">
              {platform.features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Data Types Synced */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              Data Types Synced
            </h4>
            <div className="flex flex-wrap gap-2">
              {platform.dataTypes.map((dataType, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-full text-sm"
                >
                  {dataType}
                </span>
              ))}
            </div>
          </div>

          {/* Privacy & Compliance */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Privacy & Compliance
            </h4>
            <div className="space-y-2">
              {platform.privacyCompliance.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Pricing</h4>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                platform.pricing === 'Free'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : platform.pricing === 'Paid'
                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              }`}>
                {platform.pricing}
              </span>
            </div>
            {platform.syncFrequency && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Sync Frequency</h4>
                <span className="text-gray-700 dark:text-gray-300">{platform.syncFrequency}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            {platform.isConnected ? (
              <>
                <button className="flex-1 px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium">
                  View Data
                </button>
                <button className="flex-1 px-4 py-3 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors font-medium">
                  Disconnect
                </button>
              </>
            ) : platform.comingSoon ? (
              <button className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium">
                Join Waitlist
              </button>
            ) : (
              <button className="flex-1 px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium">
                Connect Device
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
