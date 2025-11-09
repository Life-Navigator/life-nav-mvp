/**
 * Life Navigator - Career Module Types
 *
 * Comprehensive TypeScript types for networking, events, and social integrations
 */

/**
 * Event Discovery Types
 */
export type EventPlatform = 'eventbrite' | 'meetup' | 'chamber' | 'local' | 'linkedin';

export type EventCategory =
  | 'networking'
  | 'conference'
  | 'workshop'
  | 'seminar'
  | 'social'
  | 'industry'
  | 'chamber'
  | 'professional_development'
  | 'job_fair'
  | 'other';

export interface Event {
  id: string;
  title: string;
  description: string;
  platform: EventPlatform;
  category: EventCategory;
  date: string;
  endDate?: string;
  location: {
    address: string;
    city: string;
    state: string;
    country: string;
    latitude?: number;
    longitude?: number;
    isVirtual: boolean;
    virtualUrl?: string;
  };
  organizer: {
    name: string;
    email?: string;
    website?: string;
  };
  attendees: {
    registered: number;
    capacity?: number;
  };
  pricing: {
    isFree: boolean;
    price?: number;
    currency?: string;
  };
  imageUrl?: string;
  externalUrl: string;
  isSaved: boolean;
  isRsvped: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EventFilters {
  platform?: EventPlatform[];
  category?: EventCategory[];
  dateRange?: {
    start: string;
    end: string;
  };
  distance?: number; // in miles
  priceRange?: {
    min: number;
    max: number;
  };
  isFreeOnly?: boolean;
  isVirtualOnly?: boolean;
  searchQuery?: string;
}

export interface EventSearchParams {
  location?: {
    latitude: number;
    longitude: number;
  };
  city?: string;
  radius?: number; // in miles
  category?: EventCategory;
  startDate?: string;
  endDate?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
}

export interface SavedEvent {
  id: string;
  eventId: string;
  event: Event;
  savedAt: string;
  notes?: string;
  reminders?: EventReminder[];
}

export interface EventReminder {
  id: string;
  eventId: string;
  timeBeforeEvent: number; // minutes
  type: 'push' | 'email' | 'sms';
  sent: boolean;
}

export interface EventRSVP {
  id: string;
  eventId: string;
  event: Event;
  rsvpedAt: string;
  attendanceStatus: 'going' | 'maybe' | 'not_going';
  notes?: string;
}

/**
 * LinkedIn Advanced Types
 */
export interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  headline: string;
  summary?: string;
  profilePictureUrl?: string;
  profileUrl: string;
  connections: number;
  location: {
    city: string;
    state: string;
    country: string;
  };
  industry?: string;
  positions?: LinkedInPosition[];
  education?: LinkedInEducation[];
  skills?: LinkedInSkill[];
  recommendations?: number;
  lastSynced: string;
}

export interface LinkedInPosition {
  id: string;
  title: string;
  company: string;
  companyId?: string;
  location?: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  description?: string;
}

export interface LinkedInEducation {
  id: string;
  school: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  grade?: string;
  activities?: string;
}

export interface LinkedInSkill {
  id: string;
  name: string;
  endorsements: number;
}

export interface LinkedInConnection {
  id: string;
  firstName: string;
  lastName: string;
  headline?: string;
  profilePictureUrl?: string;
  profileUrl: string;
  connectionDate: string;
  sharedConnections?: number;
}

export interface LinkedInRecommendation {
  id: string;
  connection: LinkedInConnection;
  relevanceScore: number; // 0-100
  reason: string;
  sharedIndustry?: boolean;
  sharedLocation?: boolean;
  sharedSkills?: string[];
  mutualConnections?: number;
}

export interface LinkedInShareContent {
  text: string;
  url?: string;
  imageUrl?: string;
  visibility: 'public' | 'connections' | 'private';
}

/**
 * Social Media Platform Types
 */
export type SocialPlatformType = 'linkedin' | 'twitter' | 'instagram' | 'tiktok';

export interface SocialPlatformData {
  id: string;
  platform: SocialPlatformType;
  username: string;
  displayName?: string;
  profileUrl: string;
  profileImageUrl?: string;
  isConnected: boolean;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  lastSynced: string;
  stats: SocialPlatformStats;
}

export interface SocialPlatformStats {
  followers: number;
  following: number;
  posts: number;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    views?: number;
    engagementRate: number; // percentage
  };
  recentGrowth: {
    followers: number; // change in last 30 days
    engagementRate: number; // change in last 30 days
  };
}

export interface TwitterData extends SocialPlatformData {
  platform: 'twitter';
  stats: SocialPlatformStats & {
    tweets: number;
    retweets: number;
    mentions: number;
  };
}

export interface InstagramData extends SocialPlatformData {
  platform: 'instagram';
  stats: SocialPlatformStats & {
    posts: number;
    stories: number;
    reels: number;
    avgLikes: number;
    avgComments: number;
  };
}

export interface TikTokData extends SocialPlatformData {
  platform: 'tiktok';
  stats: SocialPlatformStats & {
    videos: number;
    totalViews: number;
    totalLikes: number;
    avgViews: number;
  };
}

export interface CrossPostContent {
  text: string;
  platforms: SocialPlatformType[];
  media?: {
    type: 'image' | 'video';
    url: string;
  }[];
  scheduledFor?: string;
  hashtags?: string[];
}

export interface CrossPostResult {
  platform: SocialPlatformType;
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

/**
 * Network Analytics Types
 */
export interface NetworkAnalytics {
  totalNetworkSize: number;
  platformBreakdown: PlatformNetworkSize[];
  growthMetrics: NetworkGrowthMetrics;
  influenceScore: InfluenceScore;
  reachMetrics: ReachMetrics;
  engagementMetrics: EngagementMetrics;
  geographicDistribution: GeographicData[];
  industryDistribution: IndustryData[];
  topConnections: TopConnection[];
  lastUpdated: string;
}

export interface PlatformNetworkSize {
  platform: SocialPlatformType;
  size: number;
  percentage: number;
}

export interface NetworkGrowthMetrics {
  currentPeriod: {
    start: string;
    end: string;
    growth: number;
    growthRate: number; // percentage
  };
  historical: NetworkGrowthDataPoint[];
  periods: {
    last30Days: number;
    last60Days: number;
    last90Days: number;
  };
}

export interface NetworkGrowthDataPoint {
  date: string;
  total: number;
  byPlatform: {
    platform: SocialPlatformType;
    count: number;
  }[];
}

export interface InfluenceScore {
  overall: number; // 0-100
  breakdown: {
    networkSize: number; // 0-100
    engagement: number; // 0-100
    contentQuality: number; // 0-100
    consistency: number; // 0-100
  };
  rank: string; // 'novice', 'emerging', 'established', 'influencer', 'thought_leader'
  percentile: number; // 0-100
  trends: {
    direction: 'up' | 'down' | 'stable';
    change: number;
    period: string;
  };
}

export interface ReachMetrics {
  totalReach: number;
  potentialReach: number;
  activeReach: number;
  byPlatform: {
    platform: SocialPlatformType;
    reach: number;
    percentage: number;
  }[];
  estimatedImpressions: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}

export interface EngagementMetrics {
  overallRate: number; // percentage
  byPlatform: {
    platform: SocialPlatformType;
    engagementRate: number;
    totalEngagements: number;
    breakdown: {
      likes: number;
      comments: number;
      shares: number;
      views?: number;
    };
  }[];
  topPerformingContent: TopContent[];
  peakEngagementTimes: {
    dayOfWeek: number; // 0-6
    hour: number; // 0-23
    engagementRate: number;
  }[];
}

export interface TopContent {
  id: string;
  platform: SocialPlatformType;
  contentType: string;
  publishedAt: string;
  engagements: number;
  reach: number;
  url: string;
}

export interface GeographicData {
  country: string;
  city?: string;
  count: number;
  percentage: number;
}

export interface IndustryData {
  industry: string;
  count: number;
  percentage: number;
}

export interface TopConnection {
  id: string;
  name: string;
  platform: SocialPlatformType;
  profileUrl: string;
  influenceScore: number;
  mutualConnections?: number;
  engagementRate: number;
  relationship: 'strong' | 'moderate' | 'weak';
}

/**
 * OAuth Types
 */
export interface OAuthConfig {
  platform: SocialPlatformType;
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  tokenType: string;
}

/**
 * API Request/Response Types
 */
export interface EventsResponse {
  events: Event[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface NetworkInsightsResponse {
  insights: NetworkInsight[];
  lastUpdated: string;
}

export interface NetworkInsight {
  id: string;
  type: 'opportunity' | 'warning' | 'suggestion' | 'achievement';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  action?: {
    label: string;
    type: 'navigate' | 'external_link' | 'api_call';
    payload: any;
  };
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  location?: string;
  notes?: string;
  allDay: boolean;
  source: 'event' | 'manual';
  sourceId?: string;
}

/**
 * Component Props Types
 */
export interface EventCardProps {
  event: Event;
  onPress: (event: Event) => void;
  onSave?: (event: Event) => void;
  onRSVP?: (event: Event) => void;
}

export interface SocialPlatformCardProps {
  platform: SocialPlatformData;
  onConnect: (platform: SocialPlatformType) => void;
  onDisconnect: (platform: SocialPlatformType) => void;
  onSync: (platform: SocialPlatformType) => void;
}

export interface NetworkAnalyticsChartProps {
  data: NetworkGrowthDataPoint[];
  height?: number;
  showLegend?: boolean;
}

export interface InfluenceScoreGaugeProps {
  score: InfluenceScore;
  size?: number;
  showDetails?: boolean;
}

export default {};
