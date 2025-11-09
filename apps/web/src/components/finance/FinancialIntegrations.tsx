"use client";

import React, { useState } from 'react';
import {
  Building2,
  TrendingUp,
  Wallet,
  CreditCard,
  DollarSign,
  Shield,
  Lock,
  CheckCircle2,
  Search,
  Filter,
  ExternalLink,
  Clock,
  AlertCircle
} from 'lucide-react';

interface FinancialPlatform {
  id: string;
  name: string;
  description: string;
  category: 'Personal Finance' | 'Investments' | 'Banking' | 'Payments' | 'Business';
  isConnected: boolean;
  comingSoon: boolean;
  features: string[];
  securityFeatures: string[];
  pricing: 'Free' | 'Paid' | 'Freemium';
  syncFrequency?: string;
  gradientFrom: string;
  gradientTo: string;
  icon: string;
}

const financialPlatforms: FinancialPlatform[] = [
  // Personal Finance
  {
    id: 'plaid',
    name: 'Plaid',
    description: 'Securely connect your bank accounts and financial institutions',
    category: 'Banking',
    isConnected: true,
    comingSoon: false,
    features: ['Bank Account Linking', 'Real-time Balance Updates', 'Transaction Sync'],
    securityFeatures: ['Bank-level Encryption', 'Read-only Access', 'SOC 2 Certified'],
    pricing: 'Free',
    syncFrequency: 'Real-time',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-cyan-500',
    icon: 'Building2'
  },
  {
    id: 'monarch',
    name: 'Monarch Money',
    description: 'Modern money management and budgeting with collaborative features',
    category: 'Personal Finance',
    isConnected: false,
    comingSoon: true,
    features: ['Net Worth Tracking', 'Custom Budgets', 'Collaborative Finances'],
    securityFeatures: ['256-bit Encryption', 'Multi-factor Auth', 'Privacy-first'],
    pricing: 'Paid',
    syncFrequency: 'Daily',
    gradientFrom: 'from-purple-500',
    gradientTo: 'to-pink-500',
    icon: 'TrendingUp'
  },
  {
    id: 'ynab',
    name: 'YNAB',
    description: 'Zero-based budgeting system to give every dollar a job',
    category: 'Personal Finance',
    isConnected: false,
    comingSoon: true,
    features: ['Zero-based Budgeting', 'Goal Tracking', 'Real-time Sync'],
    securityFeatures: ['Bank-level Security', 'Read-only Access', 'Encrypted Data'],
    pricing: 'Paid',
    syncFrequency: 'Real-time',
    gradientFrom: 'from-yellow-500',
    gradientTo: 'to-orange-500',
    icon: 'Wallet'
  },
  {
    id: 'personal-capital',
    name: 'Personal Capital',
    description: 'Wealth management and investment tracking for retirement planning',
    category: 'Personal Finance',
    isConnected: false,
    comingSoon: true,
    features: ['Portfolio Analysis', 'Retirement Planner', 'Investment Checkup'],
    securityFeatures: ['2-Factor Auth', 'Touch ID', '256-bit AES Encryption'],
    pricing: 'Freemium',
    syncFrequency: 'Daily',
    gradientFrom: 'from-green-500',
    gradientTo: 'to-emerald-500',
    icon: 'TrendingUp'
  },
  {
    id: 'quicken',
    name: 'Quicken',
    description: 'Desktop personal finance software with comprehensive money management',
    category: 'Personal Finance',
    isConnected: false,
    comingSoon: true,
    features: ['Bill Management', 'Investment Tracking', 'Tax Planning'],
    securityFeatures: ['Bank-grade Security', 'Secure Cloud Backup', 'Password Protection'],
    pricing: 'Paid',
    syncFrequency: 'Daily',
    gradientFrom: 'from-red-500',
    gradientTo: 'to-rose-500',
    icon: 'Building2'
  },
  // Investment Platforms
  {
    id: 'robinhood',
    name: 'Robinhood',
    description: 'Commission-free stock trading with cryptocurrency support',
    category: 'Investments',
    isConnected: false,
    comingSoon: true,
    features: ['Commission-free Trading', 'Crypto Support', 'Fractional Shares'],
    securityFeatures: ['SIPC Protected', 'Two-factor Auth', 'Biometric Login'],
    pricing: 'Free',
    syncFrequency: 'Real-time',
    gradientFrom: 'from-teal-500',
    gradientTo: 'to-cyan-500',
    icon: 'TrendingUp'
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    description: 'Leading cryptocurrency exchange for buying, selling, and storing crypto',
    category: 'Investments',
    isConnected: false,
    comingSoon: true,
    features: ['Crypto Exchange', 'Secure Wallet', 'Staking Rewards'],
    securityFeatures: ['98% Cold Storage', '2FA Required', 'Insurance Protection'],
    pricing: 'Freemium',
    syncFrequency: 'Real-time',
    gradientFrom: 'from-blue-600',
    gradientTo: 'to-indigo-600',
    icon: 'DollarSign'
  },
  {
    id: 'wealthfront',
    name: 'Wealthfront',
    description: 'Automated investing and financial planning with tax optimization',
    category: 'Investments',
    isConnected: false,
    comingSoon: true,
    features: ['Automated Investing', 'Tax-loss Harvesting', 'Financial Planning'],
    securityFeatures: ['SIPC Coverage', 'Bank-level Security', 'Two-factor Auth'],
    pricing: 'Freemium',
    syncFrequency: 'Daily',
    gradientFrom: 'from-indigo-500',
    gradientTo: 'to-purple-500',
    icon: 'TrendingUp'
  },
  {
    id: 'betterment',
    name: 'Betterment',
    description: 'Robo-advisor for investing with personalized portfolio recommendations',
    category: 'Investments',
    isConnected: false,
    comingSoon: true,
    features: ['Goal-based Investing', 'Auto-rebalancing', 'Tax Coordination'],
    securityFeatures: ['SIPC Protected', 'SSL Encryption', 'Multi-factor Auth'],
    pricing: 'Freemium',
    syncFrequency: 'Daily',
    gradientFrom: 'from-cyan-500',
    gradientTo: 'to-blue-500',
    icon: 'TrendingUp'
  },
  // Banking & Payments
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payment processing and financial infrastructure for businesses',
    category: 'Payments',
    isConnected: false,
    comingSoon: true,
    features: ['Payment Processing', 'Subscription Billing', 'Financial Reporting'],
    securityFeatures: ['PCI DSS Level 1', 'TLS Encryption', 'Fraud Detection'],
    pricing: 'Freemium',
    syncFrequency: 'Real-time',
    gradientFrom: 'from-violet-500',
    gradientTo: 'to-purple-500',
    icon: 'CreditCard'
  },
  {
    id: 'paypal',
    name: 'PayPal',
    description: 'Digital wallet and payment platform for online transactions',
    category: 'Payments',
    isConnected: false,
    comingSoon: true,
    features: ['Digital Wallet', 'Invoice Creation', 'International Payments'],
    securityFeatures: ['Buyer Protection', 'Encryption', 'Fraud Monitoring'],
    pricing: 'Freemium',
    syncFrequency: 'Real-time',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-sky-500',
    icon: 'Wallet'
  },
  {
    id: 'venmo',
    name: 'Venmo',
    description: 'Peer-to-peer payment app with social features',
    category: 'Payments',
    isConnected: false,
    comingSoon: true,
    features: ['P2P Payments', 'Social Feed', 'Split Bills'],
    securityFeatures: ['Encryption', 'PIN Protection', 'Face/Touch ID'],
    pricing: 'Free',
    syncFrequency: 'Real-time',
    gradientFrom: 'from-sky-400',
    gradientTo: 'to-blue-400',
    icon: 'DollarSign'
  },
  {
    id: 'cashapp',
    name: 'Cash App',
    description: 'Mobile payment service with investing and banking features',
    category: 'Payments',
    isConnected: false,
    comingSoon: true,
    features: ['Mobile Payments', 'Bitcoin Trading', 'Direct Deposit'],
    securityFeatures: ['PCI-DSS Compliant', 'Face/Touch ID', 'Account Protection'],
    pricing: 'Free',
    syncFrequency: 'Real-time',
    gradientFrom: 'from-green-400',
    gradientTo: 'to-emerald-400',
    icon: 'DollarSign'
  },
  // Business Finance
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Business accounting software for invoicing, expenses, and payroll',
    category: 'Business',
    isConnected: false,
    comingSoon: true,
    features: ['Invoicing', 'Expense Tracking', 'Payroll Management'],
    securityFeatures: ['Multi-level Authentication', 'Encrypted Storage', 'Secure Backups'],
    pricing: 'Paid',
    syncFrequency: 'Real-time',
    gradientFrom: 'from-green-600',
    gradientTo: 'to-teal-600',
    icon: 'Building2'
  },
  {
    id: 'freshbooks',
    name: 'FreshBooks',
    description: 'Invoicing and accounting software for small businesses and freelancers',
    category: 'Business',
    isConnected: false,
    comingSoon: true,
    features: ['Professional Invoicing', 'Time Tracking', 'Expense Management'],
    securityFeatures: ['SSL Security', 'Encrypted Data', 'Secure Cloud Storage'],
    pricing: 'Paid',
    syncFrequency: 'Daily',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-cyan-500',
    icon: 'Building2'
  },
  {
    id: 'wave',
    name: 'Wave',
    description: 'Free accounting software with invoicing and receipt scanning',
    category: 'Business',
    isConnected: false,
    comingSoon: true,
    features: ['Free Accounting', 'Receipt Scanning', 'Invoice Creation'],
    securityFeatures: ['Bank-level Security', 'SSL Encryption', 'Secure Servers'],
    pricing: 'Free',
    syncFrequency: 'Daily',
    gradientFrom: 'from-teal-500',
    gradientTo: 'to-green-500',
    icon: 'Building2'
  }
];

const categoryColors = {
  'Personal Finance': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'Investments': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'Banking': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'Payments': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  'Business': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
};

const getIcon = (iconName: string) => {
  const icons: { [key: string]: React.ReactNode } = {
    Building2: <Building2 className="w-8 h-8" />,
    TrendingUp: <TrendingUp className="w-8 h-8" />,
    Wallet: <Wallet className="w-8 h-8" />,
    CreditCard: <CreditCard className="w-8 h-8" />,
    DollarSign: <DollarSign className="w-8 h-8" />
  };
  return icons[iconName] || <Building2 className="w-8 h-8" />;
};

export default function FinancialIntegrations() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedPlatform, setSelectedPlatform] = useState<FinancialPlatform | null>(null);

  const categories = ['All', ...Array.from(new Set(financialPlatforms.map(p => p.category)))];

  const filteredPlatforms = financialPlatforms.filter(platform => {
    const matchesSearch = platform.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         platform.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || platform.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const connectedPlatforms = financialPlatforms.filter(p => p.isConnected);
  const comingSoonPlatforms = financialPlatforms.filter(p => p.comingSoon);

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Financial Platform Integrations
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Connect your financial accounts and platforms to track all your money in one secure place
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Connected</p>
              <p className="text-3xl font-bold mt-1">{connectedPlatforms.length}</p>
            </div>
            <CheckCircle2 className="w-12 h-12 text-blue-100" />
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
        <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Total Platforms</p>
              <p className="text-3xl font-bold mt-1">{financialPlatforms.length}</p>
            </div>
            <Building2 className="w-12 h-12 text-green-100" />
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search financial platforms..."
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

      {/* Connected Platforms Section */}
      {connectedPlatforms.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Connected Platforms
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectedPlatforms.map((platform) => (
              <PlatformCard
                key={platform.id}
                platform={platform}
                onClick={() => setSelectedPlatform(platform)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Coming Soon Platforms */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Coming Soon
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlatforms
            .filter(p => p.comingSoon)
            .map((platform) => (
              <PlatformCard
                key={platform.id}
                platform={platform}
                onClick={() => setSelectedPlatform(platform)}
              />
            ))}
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Bank-Level Security
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
              All connections use industry-standard 256-bit encryption and are read-only. We never store your credentials
              and cannot make transactions on your behalf. Your financial data is protected by the same security banks use.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                256-bit Encryption
              </span>
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                Read-only Access
              </span>
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                SOC 2 Certified
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Waitlist Section */}
      <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-8 text-white">
        <div className="max-w-2xl">
          <h3 className="text-2xl font-bold mb-2">Want Early Access?</h3>
          <p className="text-purple-100 mb-6">
            We're actively working on these integrations. Join the waitlist to be notified when they're available
            and get exclusive early access to new financial platform connections.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 rounded-lg bg-white/20 backdrop-blur-sm text-white placeholder-purple-200 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            <button className="px-6 py-3 bg-white text-purple-600 rounded-lg hover:bg-purple-50 transition-colors font-semibold whitespace-nowrap">
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
function PlatformCard({ platform, onClick }: { platform: FinancialPlatform; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl hover:border-blue-500 dark:hover:border-blue-400 transition-all cursor-pointer"
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

      {/* Features */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {platform.features.slice(0, 2).map((feature, idx) => (
          <span
            key={idx}
            className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
          >
            {feature}
          </span>
        ))}
        {platform.features.length > 2 && (
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
            +{platform.features.length - 2}
          </span>
        )}
      </div>

      {/* Action Button */}
      <button
        disabled={platform.comingSoon}
        className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
          platform.isConnected
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
            : platform.comingSoon
            ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {platform.isConnected ? 'Manage Connection' : platform.comingSoon ? 'Coming Soon' : 'Connect Account'}
      </button>
    </div>
  );
}

// Platform Detail Modal Component
function PlatformDetailModal({ platform, onClose }: { platform: FinancialPlatform; onClose: () => void }) {
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

          {/* Security Features */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Security Features
            </h4>
            <div className="space-y-2">
              {platform.securityFeatures.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">{feature}</span>
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
                <button className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  View Details
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
              <button className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                Connect Account
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
