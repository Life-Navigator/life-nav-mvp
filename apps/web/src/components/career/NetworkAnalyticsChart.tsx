'use client';

import React from 'react';
import { NetworkAnalytics } from '@/types/career';

interface NetworkAnalyticsChartProps {
  analytics: NetworkAnalytics;
}

export default function NetworkAnalyticsChart({ analytics }: NetworkAnalyticsChartProps) {
  const influencePlatforms = [
    { name: 'LinkedIn', score: analytics.influenceScore.linkedin, color: 'bg-blue-500' },
    { name: 'Twitter', score: analytics.influenceScore.twitter, color: 'bg-sky-500' },
    { name: 'Instagram', score: analytics.influenceScore.instagram, color: 'bg-pink-500' },
    { name: 'TikTok', score: analytics.influenceScore.tiktok, color: 'bg-black' }
  ];

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Network Size</p>
              <p className="text-3xl font-bold text-gray-900">{formatNumber(analytics.totalNetworkSize)}</p>
              <p className="text-sm text-green-600 mt-2">
                +{analytics.growthRate}% growth
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Influence Score</p>
              <p className="text-3xl font-bold text-gray-900">{analytics.influenceScore.overall}</p>
              <p className="text-sm text-gray-500 mt-2">Out of 100</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Reach</p>
              <p className="text-3xl font-bold text-gray-900">{formatNumber(analytics.reachMetrics.totalReach)}</p>
              <p className="text-sm text-gray-500 mt-2">
                {analytics.reachMetrics.averageEngagement.toFixed(1)}% engagement
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Influence Score Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Influence Score by Platform</h3>
        <div className="space-y-4">
          {influencePlatforms.map((platform) => (
            <div key={platform.name}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{platform.name}</span>
                <span className="text-sm font-semibold text-gray-900">{platform.score}/100</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`${platform.color} h-2 rounded-full transition-all duration-300`}
                  style={{ width: `${platform.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Platform Distribution */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Distribution</h3>
        <div className="space-y-3">
          {analytics.platformDistribution.map((platform) => (
            <div key={platform.platform} className="flex items-center justify-between">
              <div className="flex items-center flex-1">
                <span className="text-sm font-medium text-gray-700 w-24">{platform.platform}</span>
                <div className="flex-1 mx-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${platform.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-gray-900">{formatNumber(platform.connections)}</span>
                <span className="text-xs text-gray-500 ml-2">({platform.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Connections */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Connections</h3>
        <div className="space-y-4">
          {analytics.topConnections.slice(0, 5).map((connection, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{connection.name}</p>
                <p className="text-sm text-gray-600">{connection.title} at {connection.company}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500 capitalize">{connection.platform}</span>
                {connection.mutualConnections && (
                  <p className="text-xs text-gray-500">{connection.mutualConnections} mutual</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Geographic Distribution */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Geographic Distribution</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {analytics.geographicDistribution.slice(0, 6).map((location, index) => (
            <div key={index} className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-1">{location.location}</p>
              <p className="text-2xl font-bold text-gray-900">{location.count}</p>
              <p className="text-xs text-gray-500">{location.percentage}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* Industry Distribution */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Industry Distribution</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analytics.industryDistribution.slice(0, 8).map((industry, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">{industry.industry}</span>
              <div className="text-right">
                <span className="text-sm font-semibold text-gray-900">{industry.count}</span>
                <span className="text-xs text-gray-500 ml-2">({industry.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
