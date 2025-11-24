'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  HomeIcon,
  TruckIcon,
  BuildingOfficeIcon,
  SparklesIcon,
  CurrencyDollarIcon,
  PlusIcon,
  ChevronRightIcon,
  DocumentIcon,
  WrenchScrewdriverIcon,
  BanknotesIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import { AssetType, Asset, AssetSummary } from '@/types/financial';

// Asset type icons and colors
const assetTypeConfig: Record<AssetType, { icon: React.ReactNode; color: string; bgColor: string; label: string }> = {
  real_estate: {
    icon: <HomeIcon className="w-6 h-6" />,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    label: 'Real Estate',
  },
  vehicle: {
    icon: <TruckIcon className="w-6 h-6" />,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    label: 'Vehicles',
  },
  business: {
    icon: <BuildingOfficeIcon className="w-6 h-6" />,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    label: 'Business',
  },
  collectible: {
    icon: <SparklesIcon className="w-6 h-6" />,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    label: 'Collectibles',
  },
  other: {
    icon: <CurrencyDollarIcon className="w-6 h-6" />,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-900/30',
    label: 'Other',
  },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Asset Card Component
function AssetCard({ asset, onClick }: { asset: Asset; onClick: () => void }) {
  const config = assetTypeConfig[asset.type] || assetTypeConfig.other;
  const equity = asset.currentValue - (asset.loans?.reduce((sum, l) => sum + (l.isActive ? l.currentBalance : 0), 0) || 0);
  const appreciation = asset.purchasePrice ? ((asset.currentValue - asset.purchasePrice) / asset.purchasePrice) * 100 : null;

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${config.bgColor}`}>
          <span className={config.color}>{config.icon}</span>
        </div>
        <ChevronRightIcon className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
      </div>

      <h3 className="font-semibold text-lg text-slate-900 dark:text-white mb-1 truncate">
        {asset.name}
      </h3>

      {asset.location && (
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 truncate">
          {asset.location}
        </p>
      )}

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500 dark:text-slate-400">Current Value</span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {formatCurrency(asset.currentValue)}
          </span>
        </div>

        {asset.loans && asset.loans.length > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500 dark:text-slate-400">Equity</span>
            <span className="font-medium text-green-600 dark:text-green-400">
              {formatCurrency(equity)}
            </span>
          </div>
        )}

        {appreciation !== null && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500 dark:text-slate-400">Appreciation</span>
            <span className={`flex items-center font-medium ${appreciation >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {appreciation >= 0 ? (
                <ArrowTrendingUpIcon className="w-4 h-4 mr-1" />
              ) : (
                <ArrowTrendingDownIcon className="w-4 h-4 mr-1" />
              )}
              {appreciation.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="flex gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
        {asset.loans && asset.loans.length > 0 && (
          <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
            <BanknotesIcon className="w-4 h-4 mr-1" />
            {asset.loans.filter(l => l.isActive).length} loan{asset.loans.filter(l => l.isActive).length !== 1 ? 's' : ''}
          </div>
        )}
        {asset.upgrades && asset.upgrades.length > 0 && (
          <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
            <WrenchScrewdriverIcon className="w-4 h-4 mr-1" />
            {asset.upgrades.filter(u => u.status === 'planned').length} planned
          </div>
        )}
        {asset.documents && Array.isArray(asset.documents) && asset.documents.length > 0 && (
          <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
            <DocumentIcon className="w-4 h-4 mr-1" />
            {asset.documents.length} doc{asset.documents.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

// Summary Card Component
function SummaryCard({
  title,
  value,
  icon,
  color = 'blue',
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</span>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

// Add Asset Modal
function AddAssetModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Asset>) => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'real_estate' as AssetType,
    currentValue: '',
    purchasePrice: '',
    purchaseDate: '',
    location: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        name: formData.name,
        type: formData.type,
        currentValue: parseFloat(formData.currentValue) || 0,
        purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : undefined,
        purchaseDate: formData.purchaseDate ? new Date(formData.purchaseDate) : undefined,
        location: formData.location || undefined,
        description: formData.description || undefined,
      });
      onClose();
      setFormData({
        name: '',
        type: 'real_estate',
        currentValue: '',
        purchasePrice: '',
        purchaseDate: '',
        location: '',
        description: '',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Add New Asset</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track your valuable assets and their appreciation
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Asset Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Primary Residence"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Asset Type *
            </label>
            <select
              required
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as AssetType })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Object.entries(assetTypeConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Current Value *
              </label>
              <input
                type="number"
                required
                value={formData.currentValue}
                onChange={(e) => setFormData({ ...formData, currentValue: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Purchase Price
              </label>
              <input
                type="number"
                value={formData.purchasePrice}
                onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Purchase Date
            </label>
            <input
              type="date"
              value={formData.purchaseDate}
              onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., 123 Main St, City, State"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Additional details about this asset..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Empty State Component
function EmptyState({ onAddAsset }: { onAddAsset: () => void }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
        <HomeIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
        No Assets Yet
      </h3>
      <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
        Start tracking your valuable assets like real estate, vehicles, and collectibles.
        Monitor their value, manage loans, and plan upgrades all in one place.
      </p>
      <button
        onClick={onAddAsset}
        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <PlusIcon className="w-5 h-5 mr-2" />
        Add Your First Asset
      </button>
    </div>
  );
}

// Asset Detail Modal Component
function AssetDetailModal({
  asset,
  onClose,
}: {
  asset: Asset;
  onClose: () => void;
}) {
  const config = assetTypeConfig[asset.type] || assetTypeConfig.other;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {asset.name}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {config.label}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Value & Equity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
              <span className="text-sm text-slate-500 dark:text-slate-400">Current Value</span>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(asset.currentValue)}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
              <span className="text-sm text-slate-500 dark:text-slate-400">Purchase Price</span>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {asset.purchasePrice ? formatCurrency(asset.purchasePrice) : 'N/A'}
              </p>
            </div>
          </div>

          {/* Details */}
          {asset.location && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Location</h3>
              <p className="text-slate-900 dark:text-white">{asset.location}</p>
            </div>
          )}

          {asset.description && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</h3>
              <p className="text-slate-900 dark:text-white">{asset.description}</p>
            </div>
          )}

          {asset.purchaseDate && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Purchase Date</h3>
              <p className="text-slate-900 dark:text-white">{formatDate(asset.purchaseDate)}</p>
            </div>
          )}

          {/* Loans Section */}
          {asset.loans && asset.loans.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <BanknotesIcon className="w-4 h-4" />
                Loans
              </h3>
              <div className="space-y-2">
                {asset.loans.filter(l => l.isActive).map((loan) => (
                  <div key={loan.id} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{loan.lender}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {loan.interestRate}% APR | {formatCurrency(loan.monthlyPayment)}/mo
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900 dark:text-white">{formatCurrency(loan.currentBalance)}</p>
                      <p className="text-xs text-slate-500">remaining</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upgrades Section */}
          {asset.upgrades && asset.upgrades.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <WrenchScrewdriverIcon className="w-4 h-4" />
                Upgrades
              </h3>
              <div className="space-y-2">
                {asset.upgrades.map((upgrade) => (
                  <div key={upgrade.id} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{upgrade.name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{upgrade.category}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        upgrade.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        upgrade.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        upgrade.status === 'planned' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-slate-100 text-slate-700 dark:bg-slate-600 dark:text-slate-300'
                      }`}>
                        {upgrade.status}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-4 text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        Cost: {formatCurrency(upgrade.actualCost || upgrade.estimatedCost)}
                      </span>
                      {upgrade.valueIncrease && (
                        <span className="text-green-600 dark:text-green-400">
                          +{formatCurrency(upgrade.valueIncrease)} value
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
              <WrenchScrewdriverIcon className="w-4 h-4" />
              Add Upgrade
            </button>
            <button className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2">
              <BanknotesIcon className="w-4 h-4" />
              Add Loan
            </button>
            <button className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2">
              <DocumentIcon className="w-4 h-4" />
              Documents
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<AssetType | 'all'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        includeLoans: 'true',
        includeUpgrades: 'true',
      });
      if (selectedType !== 'all') {
        params.set('type', selectedType);
      }

      const response = await fetch(`/api/assets?${params}`);

      if (!response.ok) {
        console.warn('[Assets] API returned non-OK status:', response.status);
        setAssets([]);
        setSummary(null);
        return;
      }

      const data = await response.json();
      setAssets(data.assets || []);
      setSummary(data.summary || null);
    } catch (error) {
      console.error('[Assets] Error fetching assets:', error);
      setAssets([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [selectedType]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleAddAsset = async (data: Partial<Asset>) => {
    try {
      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create asset');
      }

      await fetchAssets();
    } catch (error) {
      console.error('[Assets] Error creating asset:', error);
      throw error;
    }
  };

  const filteredAssets = selectedType === 'all'
    ? assets
    : assets.filter(a => a.type === selectedType);

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Assets</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Track and manage your valuable assets
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="mt-4 md:mt-0 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Add Asset
        </button>
      </div>

      {/* Summary Cards */}
      {!loading && summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            title="Total Asset Value"
            value={formatCurrency(summary.totalValue)}
            icon={<ChartBarIcon className="w-5 h-5" />}
            color="blue"
          />
          <SummaryCard
            title="Total Equity"
            value={formatCurrency(summary.totalEquity)}
            icon={<ArrowTrendingUpIcon className="w-5 h-5" />}
            color="green"
          />
          <SummaryCard
            title="Total Debt"
            value={formatCurrency(summary.totalDebt)}
            icon={<BanknotesIcon className="w-5 h-5" />}
            color="red"
          />
          <SummaryCard
            title="Asset Count"
            value={assets.length.toString()}
            icon={<HomeIcon className="w-5 h-5" />}
            color="purple"
          />
        </div>
      )}

      {/* Type Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedType('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedType === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
          }`}
        >
          All Assets
        </button>
        {Object.entries(assetTypeConfig).map(([type, config]) => (
          <button
            key={type}
            onClick={() => setSelectedType(type as AssetType)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              selectedType === type
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            <span className={selectedType === type ? 'text-white' : config.color}>
              {React.cloneElement(config.icon as React.ReactElement, { className: 'w-4 h-4' })}
            </span>
            {config.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 animate-pulse">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-4" />
              <div className="space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredAssets.length === 0 && (
        <EmptyState onAddAsset={() => setIsAddModalOpen(true)} />
      )}

      {/* Asset Grid */}
      {!loading && filteredAssets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onClick={() => setSelectedAsset(asset)}
            />
          ))}
        </div>
      )}

      {/* Asset Type Breakdown */}
      {!loading && summary && summary.byType.length > 1 && (
        <div className="mt-8 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Asset Allocation
          </h2>
          <div className="space-y-4">
            {summary.byType.map((item) => {
              const config = assetTypeConfig[item.type as AssetType] || assetTypeConfig.other;
              const percentage = summary.totalValue > 0 ? (item.value / summary.totalValue) * 100 : 0;

              return (
                <div key={item.type}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={config.color}>
                        {React.cloneElement(config.icon as React.ReactElement, { className: 'w-4 h-4' })}
                      </span>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {config.label}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        ({item.count} asset{item.count !== 1 ? 's' : ''})
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(item.value)}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${config.bgColor} transition-all`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Asset Modal */}
      <AddAssetModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddAsset}
      />

      {/* Asset Detail Modal */}
      {selectedAsset && (
        <AssetDetailModal
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
        />
      )}
    </div>
  );
}
