'use client';

import React from 'react';
import { Asset } from '@/types/financial';

interface AssetsSummaryProps {
  assets: Asset[];
}

export default function AssetsSummary({ assets }: AssetsSummaryProps) {
  // Calculate total asset value
  const totalValue = assets.reduce((total, asset) => total + asset.value, 0);
  
  // Group assets by type and calculate totals for each type
  const getAssetTypeBreakdown = () => {
    const breakdown: { [type: string]: { value: number; percentage: number } } = {};
    
    assets.forEach(asset => {
      if (!breakdown[asset.type]) {
        breakdown[asset.type] = { value: 0, percentage: 0 };
      }
      
      breakdown[asset.type].value += asset.value;
    });
    
    // Calculate percentages
    Object.keys(breakdown).forEach(type => {
      breakdown[type].percentage = (breakdown[type].value / totalValue) * 100;
    });
    
    return breakdown;
  };
  
  const assetBreakdown = getAssetTypeBreakdown();
  
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };
  
  // Asset type display names and colors
  const assetTypeDisplay: { [key: string]: { name: string; color: string } } = {
    'real_estate': { 
      name: 'Real Estate', 
      color: 'bg-blue-500 dark:bg-blue-600' 
    },
    'vehicle': { 
      name: 'Vehicles', 
      color: 'bg-green-500 dark:bg-green-600' 
    },
    'collectible': { 
      name: 'Collectibles', 
      color: 'bg-purple-500 dark:bg-purple-600' 
    },
    'business': { 
      name: 'Business', 
      color: 'bg-amber-500 dark:bg-amber-600' 
    },
    'other': { 
      name: 'Other', 
      color: 'bg-gray-500 dark:bg-gray-600' 
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Asset Portfolio</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Summary */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Summary</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            {formatCurrency(totalValue)}
          </p>
          
          <div className="space-y-4">
            {Object.keys(assetBreakdown).map(type => (
              <div key={type} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 dark:text-gray-300">
                    {assetTypeDisplay[type]?.name || type.replace('_', ' ')}
                  </span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {formatCurrency(assetBreakdown[type].value)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div 
                    className={`h-2.5 rounded-full ${assetTypeDisplay[type]?.color || 'bg-blue-500'}`} 
                    style={{ width: `${assetBreakdown[type].percentage}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
                  {assetBreakdown[type].percentage.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Asset Count */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Asset Breakdown</h3>
          
          <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-500 dark:text-gray-400">Total Assets</span>
              <span className="text-gray-900 dark:text-white font-medium">{assets.length}</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
              {Object.keys(assetTypeDisplay).map(type => {
                const count = assets.filter(asset => asset.type === type).length;
                if (count === 0) return null;
                
                return (
                  <div key={type} className="flex items-center p-2 bg-white dark:bg-gray-800 rounded-md shadow-sm">
                    <div className={`w-3 h-3 rounded-full mr-2 ${assetTypeDisplay[type].color}`}></div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{assetTypeDisplay[type].name}</span>
                    <span className="ml-auto text-sm font-medium text-gray-900 dark:text-white">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Add Asset Button */}
          <button
            className="mt-4 w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add New Asset
          </button>
        </div>
      </div>
    </div>
  );
}