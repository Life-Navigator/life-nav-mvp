'use client';

import React from 'react';
import { Asset } from '@/types/financial';

interface AssetCardProps {
  asset: Asset;
  onClick?: () => void;
}

export default function AssetCard({ asset, onClick }: AssetCardProps) {
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: asset.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };
  
  // Calculate appreciation amount and percentage if purchase price exists
  const getAppreciation = () => {
    if (!asset.purchasePrice) return null;
    
    const diff = asset.value - asset.purchasePrice;
    const percentage = (diff / asset.purchasePrice) * 100;
    
    return {
      amount: diff,
      percentage: percentage,
    };
  };
  
  const appreciation = getAppreciation();
  
  // Format date
  const formatDate = (date: Date | undefined) => {
    if (!date) return 'Unknown';
    
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  };
  
  // Get icon based on asset type
  const getAssetIcon = () => {
    switch (asset.type) {
      case 'real_estate':
        return '🏠';
      case 'vehicle':
        return '🚗';
      case 'collectible':
        return '🖼️';
      case 'business':
        return '💼';
      default:
        return '💰';
    }
  };
  
  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mr-3">
            <span className="text-xl">{getAssetIcon()}</span>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">{asset.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
              {asset.type.replace('_', ' ')}
            </p>
          </div>
        </div>
      </div>
      
      <div className="mt-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Current Value</span>
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            {formatCurrency(asset.value)}
          </span>
        </div>
        
        {asset.purchasePrice && (
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Purchase Price</span>
            <span className="text-gray-700 dark:text-gray-300">
              {formatCurrency(asset.purchasePrice)}
            </span>
          </div>
        )}
        
        {appreciation && (
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Appreciation</span>
            <span className={`${appreciation.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {formatCurrency(appreciation.amount)} ({appreciation.percentage.toFixed(1)}%)
            </span>
          </div>
        )}
        
        {asset.purchaseDate && (
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">Purchase Date</span>
            <span className="text-gray-700 dark:text-gray-300">
              {formatDate(asset.purchaseDate)}
            </span>
          </div>
        )}
        
        {asset.location && (
          <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            <span className="inline-block mr-1">📍</span> {asset.location}
          </div>
        )}
      </div>
    </div>
  );
}