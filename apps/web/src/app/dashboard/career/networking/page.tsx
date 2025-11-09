'use client';

import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import EventCard from '@/components/career/EventCard';
import EventFilters from '@/components/career/EventFilters';
import SocialAccountCard from '@/components/career/SocialAccountCard';
import NetworkAnalyticsChart from '@/components/career/NetworkAnalyticsChart';
import {
  useAllEvents,
  useSavedEvents,
  useLinkedInProfile,
  useLinkedInConnections,
  useConnectedSocialAccounts,
  useSocialAnalytics,
  useNetworkAnalytics,
  useCrossPost
} from '@/hooks/useCareer';
import { EventSearchParams, CrossPostContent } from '@/types/career';

export default function CareerNetworkingPage() {
  const [activeTab, setActiveTab] = useState('contacts');
  const [eventFilters, setEventFilters] = useState<EventSearchParams>({});
  const [selectedPlatformAnalytics, setSelectedPlatformAnalytics] = useState<string | null>(null);
  const [crossPostContent, setCrossPostContent] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  // Data hooks
  const { data: events, isLoading: eventsLoading } = useAllEvents(eventFilters);
  const { data: savedEvents } = useSavedEvents();
  const { data: linkedInProfile } = useLinkedInProfile();
  const { data: linkedInConnections } = useLinkedInConnections();
  const { data: socialAccounts } = useConnectedSocialAccounts();
  const { data: platformAnalytics } = useSocialAnalytics(selectedPlatformAnalytics || '');
  const { data: networkAnalytics } = useNetworkAnalytics();
  const crossPostMutation = useCrossPost();

  const handleFilterChange = (filters: EventSearchParams) => {
    setEventFilters(filters);
  };

  const handleViewAnalytics = (platform: string) => {
    setSelectedPlatformAnalytics(platform);
  };

  const handleCrossPost = async () => {
    if (!crossPostContent.trim() || selectedPlatforms.length === 0) {
      alert('Please enter content and select at least one platform');
      return;
    }

    const content: CrossPostContent = {
      platforms: selectedPlatforms,
      content: crossPostContent
    };

    try {
      await crossPostMutation.mutateAsync(content);
      setCrossPostContent('');
      setSelectedPlatforms([]);
      alert('Posted successfully!');
    } catch (error) {
      alert('Failed to post content');
    }
  };

  const handleConnectSocial = (platform: string) => {
    // This would initiate OAuth flow
    const authUrls = {
      twitter: '/api/auth/twitter',
      instagram: '/api/auth/instagram',
      tiktok: '/api/auth/tiktok',
      linkedin: '/api/auth/linkedin'
    };
    window.location.href = authUrls[platform as keyof typeof authUrls];
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Professional Networking</h1>
        <p className="text-gray-600">
          Manage your professional connections, discover events, and track your network growth
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex border-b border-gray-200 mb-8">
          <TabsTrigger
            value="contacts"
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'contacts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Contacts
          </TabsTrigger>
          <TabsTrigger
            value="social"
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'social'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Social Media
          </TabsTrigger>
          <TabsTrigger
            value="events"
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'events'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Events
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'analytics'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className={activeTab === 'contacts' ? 'block' : 'hidden'}>
          <div className="space-y-6">
            {/* LinkedIn Profile Section */}
            {linkedInProfile && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">LinkedIn Profile</h2>
                  <a
                    href={linkedInProfile.publicProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    View Full Profile
                  </a>
                </div>
                <div className="flex items-start gap-4">
                  {linkedInProfile.profilePictureUrl && (
                    <img
                      src={linkedInProfile.profilePictureUrl}
                      alt={`${linkedInProfile.firstName} ${linkedInProfile.lastName}`}
                      className="w-20 h-20 rounded-full"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {linkedInProfile.firstName} {linkedInProfile.lastName}
                    </h3>
                    <p className="text-gray-700 mb-2">{linkedInProfile.headline}</p>
                    {linkedInProfile.location && (
                      <p className="text-sm text-gray-600">{linkedInProfile.location}</p>
                    )}
                    <p className="text-sm text-gray-600 mt-2">
                      {linkedInProfile.connections} connections
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* LinkedIn Connections */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">LinkedIn Connections</h2>
              {linkedInConnections && linkedInConnections.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {linkedInConnections.slice(0, 9).map((connection) => (
                    <div key={connection.id} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-start gap-3">
                        {connection.profilePictureUrl && (
                          <img
                            src={connection.profilePictureUrl}
                            alt={`${connection.firstName} ${connection.lastName}`}
                            className="w-12 h-12 rounded-full"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">
                            {connection.firstName} {connection.lastName}
                          </h4>
                          <p className="text-sm text-gray-600 truncate">{connection.headline}</p>
                          {connection.company && (
                            <p className="text-xs text-gray-500 mt-1">{connection.company}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">Connect your LinkedIn account to view your connections</p>
                  <button
                    onClick={() => handleConnectSocial('linkedin')}
                    className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Connect LinkedIn
                  </button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Social Media Tab */}
        <TabsContent value="social" className={activeTab === 'social' ? 'block' : 'hidden'}>
          <div className="space-y-6">
            {/* Connected Accounts */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Connected Accounts</h2>
              {socialAccounts && socialAccounts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {socialAccounts.map((account) => (
                    <SocialAccountCard
                      key={account.id}
                      account={account}
                      onViewAnalytics={handleViewAnalytics}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                  <p className="text-gray-600 mb-4">No social media accounts connected</p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => handleConnectSocial('twitter')}
                      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                    >
                      Connect Twitter
                    </button>
                    <button
                      onClick={() => handleConnectSocial('instagram')}
                      className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-md hover:opacity-90 transition-opacity"
                    >
                      Connect Instagram
                    </button>
                    <button
                      onClick={() => handleConnectSocial('tiktok')}
                      className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors"
                    >
                      Connect TikTok
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Cross-Post Tool */}
            {socialAccounts && socialAccounts.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Cross-Post Content</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Platforms
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {socialAccounts.map((account) => (
                        <label key={account.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedPlatforms.includes(account.platform)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPlatforms([...selectedPlatforms, account.platform]);
                              } else {
                                setSelectedPlatforms(selectedPlatforms.filter(p => p !== account.platform));
                              }
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700 capitalize">{account.platform}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Content
                    </label>
                    <textarea
                      value={crossPostContent}
                      onChange={(e) => setCrossPostContent(e.target.value)}
                      placeholder="What's on your mind?"
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    onClick={handleCrossPost}
                    disabled={crossPostMutation.isPending}
                    className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                  >
                    {crossPostMutation.isPending ? 'Posting...' : 'Post to Selected Platforms'}
                  </button>
                </div>
              </div>
            )}

            {/* Platform Analytics */}
            {selectedPlatformAnalytics && platformAnalytics && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 capitalize">
                    {selectedPlatformAnalytics} Analytics
                  </h2>
                  <button
                    onClick={() => setSelectedPlatformAnalytics(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Followers</p>
                    <p className="text-2xl font-bold text-gray-900">{platformAnalytics.followers}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Posts</p>
                    <p className="text-2xl font-bold text-gray-900">{platformAnalytics.posts}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Total Likes</p>
                    <p className="text-2xl font-bold text-gray-900">{platformAnalytics.engagement.likes}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Growth Rate</p>
                    <p className="text-2xl font-bold text-green-600">+{platformAnalytics.growthRate}%</p>
                  </div>
                </div>

                {platformAnalytics.topPosts.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Top Posts</h3>
                    <div className="space-y-3">
                      {platformAnalytics.topPosts.map((post) => (
                        <div key={post.id} className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-gray-900 mb-2">{post.content}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>{post.likes} likes</span>
                            <span>{post.comments} comments</span>
                            <span>{post.shares} shares</span>
                            <span className="ml-auto">{new Date(post.postedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className={activeTab === 'events' ? 'block' : 'hidden'}>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Filters Sidebar */}
            <div className="lg:col-span-1">
              <EventFilters onFilterChange={handleFilterChange} />
            </div>

            {/* Events Grid */}
            <div className="lg:col-span-3">
              {eventsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : events && Array.isArray(events) && events.length > 0 ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {events.length} Events Found
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {events.map((event: any) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                  <svg
                    className="w-16 h-16 mx-auto text-gray-400 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Events Found</h3>
                  <p className="text-gray-600">Try adjusting your filters to find more events</p>
                </div>
              )}

              {/* Saved Events */}
              {savedEvents && Array.isArray(savedEvents) && savedEvents.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Saved Events</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {savedEvents.map((event: any) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className={activeTab === 'analytics' ? 'block' : 'hidden'}>
          {networkAnalytics ? (
            <NetworkAnalyticsChart analytics={networkAnalytics} />
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <svg
                className="w-16 h-16 mx-auto text-gray-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Analytics Data</h3>
              <p className="text-gray-600 mb-4">
                Connect your social accounts to view network analytics
              </p>
              <button
                onClick={() => setActiveTab('social')}
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Connect Accounts
              </button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
