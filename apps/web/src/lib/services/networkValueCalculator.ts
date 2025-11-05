/**
 * Network Value Calculator
 *
 * Calculates the monetary and influence value of social network connections
 * across LinkedIn, Instagram, Twitter, and TikTok.
 */

interface NetworkMetrics {
  followersCount: number;
  followingCount: number;
  postsCount: number;
  engagementRate: number;
  impressions?: number;
  reach?: number;
  profileViews?: number;
}

interface FollowerProfile {
  followerCount: number;
  verifiedStatus: boolean;
  engagementRate?: number;
  industry?: string;
}

interface NetworkValue {
  estimatedValue: number;
  influenceScore: number;
  monetizationPotential: number;
  networkQuality: number;
  breakdown: {
    audienceValue: number;
    engagementValue: number;
    reachValue: number;
    industryValue: number;
  };
}

/**
 * Platform-specific value multipliers
 * Based on typical CPM rates and engagement value
 */
const PLATFORM_MULTIPLIERS = {
  linkedin: {
    base: 5.0, // Higher value per follower due to B2B nature
    engagement: 0.15,
    verified: 2.5,
    industryBonus: { tech: 1.5, finance: 1.8, healthcare: 1.6, default: 1.0 },
  },
  instagram: {
    base: 2.5,
    engagement: 0.10,
    verified: 2.0,
    industryBonus: { fashion: 1.4, beauty: 1.6, lifestyle: 1.3, default: 1.0 },
  },
  twitter: {
    base: 1.8,
    engagement: 0.08,
    verified: 2.2,
    industryBonus: { tech: 1.4, media: 1.5, politics: 1.3, default: 1.0 },
  },
  tiktok: {
    base: 3.2,
    engagement: 0.12,
    verified: 2.0,
    industryBonus: { entertainment: 1.5, education: 1.3, lifestyle: 1.4, default: 1.0 },
  },
};

/**
 * Calculate base audience value
 * Formula: (followers * platform_base * quality_factor) / 1000
 */
function calculateAudienceValue(
  platform: keyof typeof PLATFORM_MULTIPLIERS,
  followersCount: number,
  followingRatio: number
): number {
  const multiplier = PLATFORM_MULTIPLIERS[platform];

  // Quality factor based on follower/following ratio
  // Higher ratio = more authentic audience
  let qualityFactor = 1.0;
  if (followingRatio < 0.5) qualityFactor = 1.5; // Very selective following
  else if (followingRatio < 1.0) qualityFactor = 1.2;
  else if (followingRatio > 2.0) qualityFactor = 0.7; // Following too many

  return (followersCount * multiplier.base * qualityFactor) / 1000;
}

/**
 * Calculate engagement value
 * High engagement = more valuable network
 */
function calculateEngagementValue(
  platform: keyof typeof PLATFORM_MULTIPLIERS,
  followersCount: number,
  engagementRate: number
): number {
  const multiplier = PLATFORM_MULTIPLIERS[platform];

  // Engagement rate thresholds
  let engagementMultiplier = 1.0;
  if (engagementRate > 10) engagementMultiplier = 2.0; // Exceptional
  else if (engagementRate > 5) engagementMultiplier = 1.5; // Great
  else if (engagementRate > 2) engagementMultiplier = 1.2; // Good
  else if (engagementRate < 0.5) engagementMultiplier = 0.5; // Poor

  return followersCount * multiplier.engagement * engagementRate * engagementMultiplier;
}

/**
 * Calculate reach value based on impressions and profile views
 */
function calculateReachValue(
  followersCount: number,
  impressions?: number,
  profileViews?: number
): number {
  let reachValue = 0;

  if (impressions) {
    // CPM-based calculation (typical social media CPM: $5-$15)
    const avgCPM = 10;
    reachValue += (impressions / 1000) * avgCPM * 0.1; // 10% potential monetization
  }

  if (profileViews) {
    // Profile views indicate discoverability
    const viewToFollowerRatio = profileViews / followersCount;
    reachValue += viewToFollowerRatio * followersCount * 0.05;
  }

  return reachValue;
}

/**
 * Calculate industry-specific value
 */
function calculateIndustryValue(
  platform: keyof typeof PLATFORM_MULTIPLIERS,
  followersCount: number,
  industry?: string
): number {
  const multiplier = PLATFORM_MULTIPLIERS[platform];
  const industryBonus = industry
    ? multiplier.industryBonus[industry as keyof typeof multiplier.industryBonus] ||
      multiplier.industryBonus.default
    : multiplier.industryBonus.default;

  return (followersCount * industryBonus) / 100;
}

/**
 * Calculate influence score (0-100)
 */
function calculateInfluenceScore(
  followersCount: number,
  engagementRate: number,
  verifiedStatus: boolean,
  networkQuality: number
): number {
  let score = 0;

  // Follower count contribution (0-40 points)
  if (followersCount > 1000000) score += 40;
  else if (followersCount > 100000) score += 35;
  else if (followersCount > 10000) score += 25;
  else if (followersCount > 1000) score += 15;
  else score += (followersCount / 1000) * 10;

  // Engagement contribution (0-30 points)
  score += Math.min(engagementRate * 3, 30);

  // Verification bonus (10 points)
  if (verifiedStatus) score += 10;

  // Network quality (0-20 points)
  score += networkQuality * 20;

  return Math.min(Math.round(score), 100);
}

/**
 * Analyze follower network quality
 * Returns quality score 0-1
 */
function analyzeFollowerQuality(followers: FollowerProfile[]): number {
  if (followers.length === 0) return 0.5; // Neutral for no data

  let qualityScore = 0;
  let weights = 0;

  followers.forEach((follower) => {
    let followerScore = 0.5; // Base score

    // High follower count = influential follower
    if (follower.followerCount > 100000) followerScore += 0.3;
    else if (follower.followerCount > 10000) followerScore += 0.2;
    else if (follower.followerCount > 1000) followerScore += 0.1;

    // Verified status
    if (follower.verifiedStatus) followerScore += 0.2;

    // High engagement rate
    if (follower.engagementRate && follower.engagementRate > 5) {
      followerScore += 0.1;
    }

    // Industry alignment
    if (follower.industry) {
      followerScore += 0.05;
    }

    qualityScore += Math.min(followerScore, 1.0);
    weights += 1;
  });

  return qualityScore / weights;
}

/**
 * Main function: Calculate network value
 */
export function calculateNetworkValue(
  platform: 'linkedin' | 'instagram' | 'twitter' | 'tiktok',
  metrics: NetworkMetrics,
  followers: FollowerProfile[] = [],
  industry?: string
): NetworkValue {
  const followingRatio = metrics.followingCount / metrics.followersCount || 1;
  const networkQuality = analyzeFollowerQuality(followers);

  // Calculate individual components
  const audienceValue = calculateAudienceValue(
    platform,
    metrics.followersCount,
    followingRatio
  );

  const engagementValue = calculateEngagementValue(
    platform,
    metrics.followersCount,
    metrics.engagementRate
  );

  const reachValue = calculateReachValue(
    metrics.followersCount,
    metrics.impressions,
    metrics.profileViews
  );

  const industryValue = calculateIndustryValue(platform, metrics.followersCount, industry);

  // Total estimated value (annual potential)
  const estimatedValue =
    audienceValue + engagementValue + reachValue + industryValue;

  // Calculate influence score
  const influenceScore = calculateInfluenceScore(
    metrics.followersCount,
    metrics.engagementRate,
    false, // Will be updated with actual verified status
    networkQuality
  );

  // Monetization potential (0-100 scale)
  const monetizationPotential = Math.min(
    Math.round((estimatedValue / 10000) * 100),
    100
  );

  return {
    estimatedValue: Math.round(estimatedValue),
    influenceScore,
    monetizationPotential,
    networkQuality: Math.round(networkQuality * 100),
    breakdown: {
      audienceValue: Math.round(audienceValue),
      engagementValue: Math.round(engagementValue),
      reachValue: Math.round(reachValue),
      industryValue: Math.round(industryValue),
    },
  };
}

/**
 * Generate network insights and recommendations
 */
export function generateNetworkInsights(
  platform: string,
  currentValue: NetworkValue,
  previousValue?: NetworkValue
): {
  insights: string[];
  recommendations: string[];
  growthRate?: number;
} {
  const insights: string[] = [];
  const recommendations: string[] = [];
  let growthRate: number | undefined;

  // Growth analysis
  if (previousValue) {
    growthRate =
      ((currentValue.estimatedValue - previousValue.estimatedValue) /
        previousValue.estimatedValue) *
      100;

    if (growthRate > 10) {
      insights.push(`🚀 Your ${platform} network value grew by ${growthRate.toFixed(1)}% - excellent growth!`);
    } else if (growthRate < -5) {
      insights.push(`📉 Your ${platform} network value declined by ${Math.abs(growthRate).toFixed(1)}%.`);
      recommendations.push('Focus on engagement and content quality to reverse the trend');
    }
  }

  // Network quality insights
  if (currentValue.networkQuality > 80) {
    insights.push('✨ You have a high-quality network with influential connections');
  } else if (currentValue.networkQuality < 50) {
    recommendations.push('Build relationships with industry leaders and engage with quality accounts');
  }

  // Engagement insights
  if (currentValue.breakdown.engagementValue < currentValue.breakdown.audienceValue * 0.1) {
    recommendations.push('Your engagement rate is low - focus on creating more interactive content');
  }

  // Monetization potential
  if (currentValue.monetizationPotential > 70) {
    insights.push('💰 High monetization potential - consider brand partnerships or sponsored content');
  }

  return { insights, recommendations, growthRate };
}
