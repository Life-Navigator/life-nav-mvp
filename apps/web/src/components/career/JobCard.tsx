"use client";

import React from 'react';
import { JobListingEnhanced } from '@/types/career';
import { useSaveJob, useUnsaveJob } from '@/hooks/useCareer';

interface JobCardProps {
  job: JobListingEnhanced;
  onApply?: (job: JobListingEnhanced) => void;
}

export default function JobCard({ job, onApply }: JobCardProps) {
  const saveJobMutation = useSaveJob();
  const unsaveJobMutation = useUnsaveJob();

  const handleSaveToggle = () => {
    if (job.isSaved) {
      unsaveJobMutation.mutate(job.id);
    } else {
      saveJobMutation.mutate({ jobId: job.id, platform: job.platform });
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
      case 'linkedin':
        return 'bg-blue-100 text-blue-700';
      case 'indeed':
        return 'bg-indigo-100 text-indigo-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatSalary = () => {
    if (!job.salaryRange) return null;
    const { min, max, currency, period } = job.salaryRange;
    return `${currency}${min.toLocaleString()} - ${currency}${max.toLocaleString()} / ${period}`;
  };

  const formatPostedDate = () => {
    const posted = new Date(job.postedDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - posted.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-4 flex-1">
          {job.companyLogo && (
            <img
              src={job.companyLogo}
              alt={job.company}
              className="w-12 h-12 rounded-lg object-cover"
            />
          )}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              {job.title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{job.company}</p>
          </div>
        </div>

        {/* Match Score */}
        {job.matchScore !== undefined && (
          <div className={`px-3 py-1 rounded-full text-sm font-semibold ${getMatchScoreColor(job.matchScore)}`}>
            {job.matchScore}% Match
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPlatformColor(job.platform)}`}>
          {job.platform.charAt(0).toUpperCase() + job.platform.slice(1)}
        </span>
        <span className="px-3 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded-full text-xs font-medium">
          {job.employmentType.charAt(0).toUpperCase() + job.employmentType.slice(1)}
        </span>
        <span className="px-3 py-1 bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300 rounded-full text-xs font-medium">
          {job.locationType.charAt(0).toUpperCase() + job.locationType.slice(1)}
        </span>
        <span className="px-3 py-1 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 rounded-full text-xs font-medium">
          {job.experienceLevel.charAt(0).toUpperCase() + job.experienceLevel.slice(1)}
        </span>
      </div>

      {/* Location and Salary */}
      <div className="flex items-center gap-4 mb-4 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{job.location}</span>
        </div>
        {job.salaryRange && (
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium text-gray-900 dark:text-white">{formatSalary()}</span>
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 line-clamp-3">
        {job.description}
      </p>

      {/* Skills */}
      {job.skills.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {job.skills.slice(0, 5).map((skill, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
              >
                {skill}
              </span>
            ))}
            {job.skills.length > 5 && (
              <span className="px-2 py-1 text-gray-500 dark:text-gray-400 text-xs">
                +{job.skills.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>{formatPostedDate()}</span>
          {job.applicants !== undefined && (
            <span>{job.applicants} applicants</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Save Button */}
          <button
            onClick={handleSaveToggle}
            disabled={saveJobMutation.isPending || unsaveJobMutation.isPending}
            className={`p-2 rounded-lg transition-colors ${
              job.isSaved
                ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title={job.isSaved ? 'Unsave job' : 'Save job'}
          >
            <svg className="w-5 h-5" fill={job.isSaved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>

          {/* View Details Button */}
          <a
            href={job.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            View Details
          </a>

          {/* Apply Button */}
          {onApply && !job.isApplied && (
            <button
              onClick={() => onApply(job)}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Quick Apply
            </button>
          )}

          {job.isApplied && (
            <span className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg">
              Applied
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
