'use client';

import React, { useState } from 'react';
import AssetCard from '@/components/financial/assets/AssetCard';
import AssetsSummary from '@/components/financial/assets/AssetsSummary';
import { Asset } from '@/types/financial';
import { mockAssets } from '@/lib/mock/financialAccounts';

export default function AssetsPage() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  
  // Filter assets based on selected type
  const filteredAssets = selectedType 
    ? mockAssets.filter(asset => asset.type === selectedType)
    : mockAssets;
  
  // Asset type display names
  const assetTypeDisplay: { [key: string]: { name: string; icon: string } } = {
    'all': { name: 'All Assets', icon: '💰' },
    'real_estate': { name: 'Real Estate', icon: '🏠' },
    'vehicle': { name: 'Vehicles', icon: '🚗' },
    'collectible': { name: 'Collectibles', icon: '🖼️' },
    'business': { name: 'Business', icon: '💼' },
    'other': { name: 'Other', icon: '📦' },
  };
  
  // Handle asset click
  const handleAssetClick = (asset: Asset) => {
    console.log('Asset clicked:', asset);
    // In a real implementation, this would navigate to an asset details page or show a modal
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">Assets</h1>
      
      {/* Assets Summary */}
      <AssetsSummary assets={mockAssets} />
      
      {/* Asset Type Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedType(null)}
          className={`flex items-center py-2 px-4 rounded-full text-sm font-medium transition-colors ${
            selectedType === null
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <span className="mr-2">{assetTypeDisplay['all'].icon}</span>
          {assetTypeDisplay['all'].name}
        </button>
        
        {Object.keys(assetTypeDisplay).filter(type => type !== 'all').map(type => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`flex items-center py-2 px-4 rounded-full text-sm font-medium transition-colors ${
              selectedType === type
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <span className="mr-2">{assetTypeDisplay[type].icon}</span>
            {assetTypeDisplay[type].name}
          </button>
        ))}
      </div>
      
      {/* Assets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAssets.map(asset => (
          <AssetCard
            key={asset.id}
            asset={asset}
            onClick={() => handleAssetClick(asset)}
          />
        ))}
        
        {/* Add Asset Card */}
        <div
          className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 border-dashed p-4 hover:bg-gray-100 dark:hover:bg-gray-750 transition-all cursor-pointer flex items-center justify-center"
          onClick={() => console.log('Add asset clicked')}
        >
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-1">Add New Asset</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Track a new property, vehicle, or other valuable asset
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}