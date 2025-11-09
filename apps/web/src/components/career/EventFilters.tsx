'use client';

import React, { useState } from 'react';
import { EventSearchParams } from '@/types/career';

interface EventFiltersProps {
  onFilterChange: (filters: EventSearchParams) => void;
}

export default function EventFilters({ onFilterChange }: EventFiltersProps) {
  const [filters, setFilters] = useState<EventSearchParams>({
    keywords: '',
    category: '',
    location: '',
    platform: '',
    isVirtual: undefined,
    isFree: undefined,
    sortBy: 'date'
  });

  const handleFilterChange = (key: keyof EventSearchParams, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    const emptyFilters: EventSearchParams = {
      keywords: '',
      category: '',
      location: '',
      platform: '',
      isVirtual: undefined,
      isFree: undefined,
      sortBy: 'date'
    };
    setFilters(emptyFilters);
    onFilterChange(emptyFilters);
  };

  const categories = [
    'Networking',
    'Workshop',
    'Conference',
    'Meetup',
    'Webinar',
    'Career Fair',
    'Professional Development',
    'Industry Event'
  ];

  const platforms = [
    { value: '', label: 'All Platforms' },
    { value: 'eventbrite', label: 'Eventbrite' },
    { value: 'meetup', label: 'Meetup' },
    { value: 'chamber', label: 'Chamber of Commerce' },
    { value: 'local', label: 'Local Events' }
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        <button
          onClick={clearFilters}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Clear All
        </button>
      </div>

      {/* Search Keywords */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Search Keywords
        </label>
        <input
          type="text"
          value={filters.keywords || ''}
          onChange={(e) => handleFilterChange('keywords', e.target.value)}
          placeholder="Search events..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Location
        </label>
        <input
          type="text"
          value={filters.location || ''}
          onChange={(e) => handleFilterChange('location', e.target.value)}
          placeholder="City or ZIP code"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Category
        </label>
        <select
          value={filters.category || ''}
          onChange={(e) => handleFilterChange('category', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {/* Platform */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Platform
        </label>
        <select
          value={filters.platform || ''}
          onChange={(e) => handleFilterChange('platform', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {platforms.map((platform) => (
            <option key={platform.value} value={platform.value}>
              {platform.label}
            </option>
          ))}
        </select>
      </div>

      {/* Sort By */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Sort By
        </label>
        <select
          value={filters.sortBy || 'date'}
          onChange={(e) => handleFilterChange('sortBy', e.target.value as any)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="date">Date</option>
          <option value="relevance">Relevance</option>
          <option value="distance">Distance</option>
        </select>
      </div>

      {/* Toggle Filters */}
      <div className="space-y-3">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={filters.isVirtual || false}
            onChange={(e) => handleFilterChange('isVirtual', e.target.checked || undefined)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700">Virtual events only</span>
        </label>

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={filters.isFree || false}
            onChange={(e) => handleFilterChange('isFree', e.target.checked || undefined)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700">Free events only</span>
        </label>
      </div>

      {/* Date Range */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Start Date
        </label>
        <input
          type="date"
          value={filters.startDate || ''}
          onChange={(e) => handleFilterChange('startDate', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          End Date
        </label>
        <input
          type="date"
          value={filters.endDate || ''}
          onChange={(e) => handleFilterChange('endDate', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
