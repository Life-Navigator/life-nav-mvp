"use client";

import React, { useState } from 'react';
import { JobSearchParamsEnhanced, GigSearchParams } from '@/types/career';
import {
  useAllJobs,
  useRecommendedJobs,
  useAllGigs,
  useRecommendedGigs,
  useJobApplications,
  useApplicationStats,
  useJobMarketInsights,
} from '@/hooks/useCareer';
import JobCard from '@/components/career/JobCard';
import GigCard from '@/components/career/GigCard';
import JobFilters from '@/components/career/JobFilters';
import GigFilters from '@/components/career/GigFilters';
import ApplicationCard from '@/components/career/ApplicationCard';

type Tab = 'jobs' | 'gigs' | 'applications' | 'insights';

export default function OpportunitiesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('jobs');

  // Job filters
  const [jobFilters, setJobFilters] = useState<JobSearchParamsEnhanced>({
    platform: 'all',
    sortBy: 'relevance',
    page: 1,
    limit: 20,
  });

  // Gig filters
  const [gigFilters, setGigFilters] = useState<GigSearchParams>({
    platform: 'all',
    sortBy: 'relevance',
    page: 1,
    limit: 20,
  });

  // Fetch data
  const { data: jobsData, isLoading: jobsLoading } = useAllJobs(jobFilters);
  const { data: recommendedJobsData } = useRecommendedJobs();
  const { data: gigsData, isLoading: gigsLoading } = useAllGigs(gigFilters);
  const { data: recommendedGigsData } = useRecommendedGigs();
  const { applications, fetchApplications } = useJobApplications();
  const { data: appStats } = useApplicationStats();
  const { data: marketInsights } = useJobMarketInsights();

  const tabs = [
    { id: 'jobs' as Tab, label: 'Job Opportunities', icon: '💼' },
    { id: 'gigs' as Tab, label: 'Freelance Gigs', icon: '🚀' },
    { id: 'applications' as Tab, label: 'Application Tracker', icon: '📊' },
    { id: 'insights' as Tab, label: 'Market Insights', icon: '📈' },
  ];

  const resetJobFilters = () => {
    setJobFilters({
      platform: 'all',
      sortBy: 'relevance',
      page: 1,
      limit: 20,
    });
  };

  const resetGigFilters = () => {
    setGigFilters({
      platform: 'all',
      sortBy: 'relevance',
      page: 1,
      limit: 20,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Career Opportunities
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Discover jobs, gigs, and track your applications across multiple platforms
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'jobs' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Filters Sidebar */}
            <div className="lg:col-span-1">
              <JobFilters
                filters={jobFilters}
                onChange={setJobFilters}
                onReset={resetJobFilters}
              />
            </div>

            {/* Jobs Content */}
            <div className="lg:col-span-3">
              {/* Recommended Jobs */}
              {recommendedJobsData && recommendedJobsData.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    Recommended for You
                  </h2>
                  <div className="space-y-4">
                    {recommendedJobsData.slice(0, 3).map((job: any) => (
                      <JobCard key={job.id} job={job} />
                    ))}
                  </div>
                </div>
              )}

              {/* All Jobs */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  All Jobs
                  {jobsData?.total && (
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                      ({jobsData.total} results)
                    </span>
                  )}
                </h2>

                {jobsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                ) : jobsData && jobsData.jobs && jobsData.jobs.length > 0 ? (
                  <div className="space-y-4">
                    {jobsData.jobs.map((job: any) => (
                      <JobCard key={job.id} job={job} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                      No jobs found
                    </h3>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      Try adjusting your filters or search criteria
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'gigs' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Filters Sidebar */}
            <div className="lg:col-span-1">
              <GigFilters
                filters={gigFilters}
                onChange={setGigFilters}
                onReset={resetGigFilters}
              />
            </div>

            {/* Gigs Content */}
            <div className="lg:col-span-3">
              {/* Recommended Gigs */}
              {recommendedGigsData && recommendedGigsData.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    Recommended for You
                  </h2>
                  <div className="space-y-4">
                    {recommendedGigsData.slice(0, 3).map((gig: any) => (
                      <GigCard key={gig.id} gig={gig} />
                    ))}
                  </div>
                </div>
              )}

              {/* All Gigs */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  All Gigs
                  {gigsData?.total && (
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                      ({gigsData.total} results)
                    </span>
                  )}
                </h2>

                {gigsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                  </div>
                ) : gigsData && gigsData.gigs && gigsData.gigs.length > 0 ? (
                  <div className="space-y-4">
                    {gigsData.gigs.map((gig: any) => (
                      <GigCard key={gig.id} gig={gig} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                      No gigs found
                    </h3>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      Try adjusting your filters or search criteria
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'applications' && (
          <div>
            {/* Stats Cards */}
            {appStats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Applications</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        {appStats.totalApplications}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Interviewing</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        {appStats.interviewing}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Offers</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        {appStats.offered}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Response Rate</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        {appStats.responseRate}%
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Applications List */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Your Applications
              </h2>

              {applications && applications.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {applications.map((app: any) => (
                    <ApplicationCard
                      key={app.id}
                      application={app}
                      onUpdate={fetchApplications}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                    No applications yet
                  </h3>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Start applying to jobs and gigs to track them here
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-8">
            {/* Trending Skills */}
            {marketInsights?.trendingSkills && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Trending Skills
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {marketInsights.trendingSkills.map((skill, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{skill.skill}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {skill.demand} jobs
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${skill.growth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {skill.growth > 0 ? '+' : ''}{skill.growth}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Average Salaries */}
            {marketInsights?.averageSalaries && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Average Salaries by Role
                </h2>
                <div className="space-y-3">
                  {marketInsights.averageSalaries.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <p className="font-medium text-gray-900 dark:text-white">{item.role}</p>
                      <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {item.currency}{item.salary.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Hiring Companies */}
            {marketInsights?.topHiringCompanies && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Top Hiring Companies
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {marketInsights.topHiringCompanies.map((company, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <p className="font-medium text-gray-900 dark:text-white">{company.company}</p>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-full text-sm font-medium">
                        {company.openings} openings
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
