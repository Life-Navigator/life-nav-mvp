"use client";

import React from 'react';
import { GigListing } from '@/types/career';
import { useSaveGig, useUnsaveGig } from '@/hooks/useCareer';

interface GigCardProps {
  gig: GigListing;
  onApply?: (gig: GigListing) => void;
}

export default function GigCard({ gig, onApply }: GigCardProps) {
  const saveGigMutation = useSaveGig();
  const unsaveGigMutation = useUnsaveGig();

  const handleSaveToggle = () => {
    if (gig.isSaved) {
      unsaveGigMutation.mutate(gig.id);
    } else {
      saveGigMutation.mutate({ gigId: gig.id, platform: gig.platform });
    }
  };

  const getMatchScoreColor = (score?: number) => {
    if (!score) return 'bg-gray-100 text-gray-600';
    if (score >= 70) return 'bg-green-100 text-green-700';
    if (score >= 50) return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-600';
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'upwork':
        return 'bg-green-100 text-green-700';
      case 'fiverr':
        return 'bg-emerald-100 text-emerald-700';
      case 'freelancer':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatBudget = () => {
    if (!gig.budget) return null;
    const { type, amount, hourlyRate, currency } = gig.budget;

    if (type === 'fixed' && amount) {
      return `${currency}${amount.toLocaleString()} (Fixed)`;
    } else if (type === 'hourly' && hourlyRate) {
      return `${currency}${hourlyRate.min}-${currency}${hourlyRate.max}/hr`;
    }
    return null;
  };

  const formatPostedDate = () => {
    const posted = new Date(gig.postedDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - posted.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <svg
            key={i}
            className={`w-4 h-4 ${i < Math.floor(rating) ? 'text-yellow-400' : 'text-gray-300'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {gig.title}
          </h3>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600 dark:text-gray-400">{gig.client.name}</span>
            {gig.client.rating && (
              <div className="flex items-center gap-1">
                {renderStars(gig.client.rating)}
                <span className="text-xs text-gray-500">
                  ({gig.client.reviewCount || 0})
                </span>
              </div>
            )}
            {gig.client.location && (
              <span className="text-gray-500 dark:text-gray-400">• {gig.client.location}</span>
            )}
          </div>
        </div>

        {/* Match Score */}
        {gig.matchScore !== undefined && (
          <div className={`px-3 py-1 rounded-full text-sm font-semibold ${getMatchScoreColor(gig.matchScore)}`}>
            {gig.matchScore}% Match
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPlatformColor(gig.platform)}`}>
          {gig.platform.charAt(0).toUpperCase() + gig.platform.slice(1)}
        </span>
        <span className="px-3 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded-full text-xs font-medium">
          {gig.category}
        </span>
        <span className="px-3 py-1 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 rounded-full text-xs font-medium">
          {gig.experienceLevel.charAt(0).toUpperCase() + gig.experienceLevel.slice(1)}
        </span>
        {gig.budget && (
          <span className="px-3 py-1 bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300 rounded-full text-xs font-medium">
            {gig.budget.type === 'fixed' ? 'Fixed Price' : 'Hourly'}
          </span>
        )}
      </div>

      {/* Budget and Duration */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        {gig.budget && (
          <div className="flex items-center gap-1 text-gray-900 dark:text-white font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formatBudget()}</span>
          </div>
        )}
        {gig.duration && (
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{gig.duration}</span>
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 line-clamp-3">
        {gig.description}
      </p>

      {/* Skills */}
      {gig.skills.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {gig.skills.slice(0, 5).map((skill, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
              >
                {skill}
              </span>
            ))}
            {gig.skills.length > 5 && (
              <span className="px-2 py-1 text-gray-500 dark:text-gray-400 text-xs">
                +{gig.skills.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>{formatPostedDate()}</span>
          {gig.proposals !== undefined && (
            <span>{gig.proposals} proposals</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Save Button */}
          <button
            onClick={handleSaveToggle}
            disabled={saveGigMutation.isPending || unsaveGigMutation.isPending}
            className={`p-2 rounded-lg transition-colors ${
              gig.isSaved
                ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title={gig.isSaved ? 'Unsave gig' : 'Save gig'}
          >
            <svg className="w-5 h-5" fill={gig.isSaved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>

          {/* View Details Button */}
          <a
            href={gig.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            View Details
          </a>

          {/* Apply Button */}
          {onApply && !gig.isApplied && (
            <button
              onClick={() => onApply(gig)}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Submit Proposal
            </button>
          )}

          {gig.isApplied && (
            <span className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg">
              Applied
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
