/**
 * Life Navigator - Social Integration Service
 *
 * Handles OAuth flows, data syncing, and cross-platform posting
 */

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SocialPlatformType,
  SocialPlatformData,
  OAuthConfig,
  OAuthToken,
  CrossPostContent,
  CrossPostResult,
  LinkedInProfile,
  LinkedInConnection,
  LinkedInRecommendation,
  LinkedInShareContent,
} from '../../types/career';
import {
  connectLinkedIn,
  connectTwitter,
  connectInstagram,
  connectTikTok,
  disconnectSocialAccount,
  getSocialAccounts,
  syncLinkedIn,
  getLinkedInProfile,
  getLinkedInConnections,
  getLinkedInRecommendations,
  importLinkedInContacts,
  shareToLinkedIn,
  getSocialPlatformData,
  crossPostContent,
  syncAllSocialPlatforms,
  getTwitterEngagement,
  getInstagramEngagement,
  getTikTokEngagement,
} from '../../api/career';

// OAuth configuration for each platform
const OAUTH_CONFIGS: Record<SocialPlatformType, OAuthConfig> = {
  linkedin: {
    platform: 'linkedin',
    clientId: process.env.EXPO_PUBLIC_LINKEDIN_CLIENT_ID || '',
    redirectUri: AuthSession.makeRedirectUri({ scheme: 'life-navigator' }),
    scopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social', 'r_basicprofile'],
  },
  twitter: {
    platform: 'twitter',
    clientId: process.env.EXPO_PUBLIC_TWITTER_CLIENT_ID || '',
    redirectUri: AuthSession.makeRedirectUri({ scheme: 'life-navigator' }),
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'follows.read'],
  },
  instagram: {
    platform: 'instagram',
    clientId: process.env.EXPO_PUBLIC_INSTAGRAM_CLIENT_ID || '',
    redirectUri: AuthSession.makeRedirectUri({ scheme: 'life-navigator' }),
    scopes: ['user_profile', 'user_media'],
  },
  tiktok: {
    platform: 'tiktok',
    clientId: process.env.EXPO_PUBLIC_TIKTOK_CLIENT_ID || '',
    redirectUri: AuthSession.makeRedirectUri({ scheme: 'life-navigator' }),
    scopes: ['user.info.basic', 'video.list'],
  },
};

WebBrowser.maybeCompleteAuthSession();

class SocialIntegrationService {
  private storageKey = '@life-navigator:social-tokens';

  /**
   * Store OAuth tokens securely
   */
  private async storeTokens(platform: SocialPlatformType, tokens: OAuthToken): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      const allTokens = stored ? JSON.parse(stored) : {};
      allTokens[platform] = tokens;
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(allTokens));
    } catch (error) {
      console.error('Error storing tokens:', error);
    }
  }

  /**
   * Get stored OAuth tokens
   */
  private async getStoredTokens(platform: SocialPlatformType): Promise<OAuthToken | null> {
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      if (!stored) return null;
      const allTokens = JSON.parse(stored);
      return allTokens[platform] || null;
    } catch (error) {
      console.error('Error getting stored tokens:', error);
      return null;
    }
  }

  /**
   * Clear stored tokens for platform
   */
  private async clearTokens(platform: SocialPlatformType): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      if (!stored) return;
      const allTokens = JSON.parse(stored);
      delete allTokens[platform];
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(allTokens));
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }

  /**
   * Connect LinkedIn account via OAuth
   */
  async connectLinkedInAccount(): Promise<SocialPlatformData | null> {
    try {
      const config = OAUTH_CONFIGS.linkedin;
      const discovery = {
        authorizationEndpoint: 'https://www.linkedin.com/oauth/v2/authorization',
        tokenEndpoint: 'https://www.linkedin.com/oauth/v2/accessToken',
      };

      const [request, response, promptAsync] = AuthSession.useAuthRequest(
        {
          clientId: config.clientId,
          scopes: config.scopes,
          redirectUri: config.redirectUri,
        },
        discovery
      );

      const result = await promptAsync();

      if (result.type === 'success' && result.params.code) {
        const response = await connectLinkedIn(result.params.code);
        if (response.success && response.data) {
          return response.data;
        }
      }

      return null;
    } catch (error) {
      console.error('Error connecting LinkedIn:', error);
      throw error;
    }
  }

  /**
   * Connect Twitter account via OAuth
   */
  async connectTwitterAccount(): Promise<SocialPlatformData | null> {
    try {
      const config = OAUTH_CONFIGS.twitter;
      const discovery = {
        authorizationEndpoint: 'https://twitter.com/i/oauth2/authorize',
        tokenEndpoint: 'https://api.twitter.com/2/oauth2/token',
      };

      const [request, response, promptAsync] = AuthSession.useAuthRequest(
        {
          clientId: config.clientId,
          scopes: config.scopes,
          redirectUri: config.redirectUri,
          usePKCE: true,
        },
        discovery
      );

      const result = await promptAsync();

      if (result.type === 'success' && result.params.code) {
        const response = await connectTwitter(result.params.code);
        if (response.success && response.data) {
          return response.data;
        }
      }

      return null;
    } catch (error) {
      console.error('Error connecting Twitter:', error);
      throw error;
    }
  }

  /**
   * Connect Instagram account via OAuth
   */
  async connectInstagramAccount(): Promise<SocialPlatformData | null> {
    try {
      const config = OAUTH_CONFIGS.instagram;
      const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${config.clientId}&redirect_uri=${config.redirectUri}&scope=${config.scopes.join(',')}&response_type=code`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, config.redirectUri);

      if (result.type === 'success' && result.url) {
        const code = new URL(result.url).searchParams.get('code');
        if (code) {
          const response = await connectInstagram(code);
          if (response.success && response.data) {
            return response.data;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error connecting Instagram:', error);
      throw error;
    }
  }

  /**
   * Connect TikTok account via OAuth
   */
  async connectTikTokAccount(): Promise<SocialPlatformData | null> {
    try {
      const config = OAUTH_CONFIGS.tiktok;
      const authUrl = `https://www.tiktok.com/auth/authorize/?client_key=${config.clientId}&scope=${config.scopes.join(',')}&response_type=code&redirect_uri=${config.redirectUri}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, config.redirectUri);

      if (result.type === 'success' && result.url) {
        const code = new URL(result.url).searchParams.get('code');
        if (code) {
          const response = await connectTikTok(code);
          if (response.success && response.data) {
            return response.data;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error connecting TikTok:', error);
      throw error;
    }
  }

  /**
   * Connect any platform
   */
  async connectPlatform(platform: SocialPlatformType): Promise<SocialPlatformData | null> {
    switch (platform) {
      case 'linkedin':
        return this.connectLinkedInAccount();
      case 'twitter':
        return this.connectTwitterAccount();
      case 'instagram':
        return this.connectInstagramAccount();
      case 'tiktok':
        return this.connectTikTokAccount();
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Disconnect platform
   */
  async disconnectPlatform(accountId: string, platform: SocialPlatformType): Promise<void> {
    try {
      await disconnectSocialAccount(accountId);
      await this.clearTokens(platform);
    } catch (error) {
      console.error(`Error disconnecting ${platform}:`, error);
      throw error;
    }
  }

  /**
   * Get all connected social accounts
   */
  async getConnectedAccounts(): Promise<SocialPlatformData[]> {
    try {
      const accounts = await getSocialAccounts();
      // Map old SocialAccount type to new SocialPlatformData type
      // This is a temporary mapping until backend is updated
      return accounts.map((account) => ({
        id: account.id,
        platform: account.platform,
        username: account.username,
        displayName: account.username,
        profileUrl: `https://${account.platform}.com/${account.username}`,
        isConnected: account.connected,
        lastSynced: account.lastSynced,
        stats: {
          followers: account.followers,
          following: 0,
          posts: 0,
          engagement: {
            likes: 0,
            comments: 0,
            shares: 0,
            engagementRate: account.engagement,
          },
          recentGrowth: {
            followers: 0,
            engagementRate: 0,
          },
        },
      })) as SocialPlatformData[];
    } catch (error) {
      console.error('Error getting connected accounts:', error);
      throw error;
    }
  }

  /**
   * Sync LinkedIn data
   */
  async syncLinkedInData(): Promise<void> {
    try {
      await syncLinkedIn();
    } catch (error) {
      console.error('Error syncing LinkedIn data:', error);
      throw error;
    }
  }

  /**
   * Sync all platforms
   */
  async syncAllPlatforms(): Promise<string[]> {
    try {
      const response = await syncAllSocialPlatforms();
      return response.data?.synced || [];
    } catch (error) {
      console.error('Error syncing all platforms:', error);
      throw error;
    }
  }

  /**
   * Get LinkedIn profile
   */
  async getLinkedInProfileData(): Promise<LinkedInProfile> {
    try {
      return await getLinkedInProfile();
    } catch (error) {
      console.error('Error getting LinkedIn profile:', error);
      throw error;
    }
  }

  /**
   * Get LinkedIn connections
   */
  async getLinkedInConnectionsList(
    limit?: number,
    offset?: number
  ): Promise<{ connections: LinkedInConnection[]; total: number }> {
    try {
      return await getLinkedInConnections(limit, offset);
    } catch (error) {
      console.error('Error getting LinkedIn connections:', error);
      throw error;
    }
  }

  /**
   * Get LinkedIn connection recommendations
   */
  async getLinkedInConnectionRecommendations(): Promise<LinkedInRecommendation[]> {
    try {
      return await getLinkedInRecommendations();
    } catch (error) {
      console.error('Error getting LinkedIn recommendations:', error);
      throw error;
    }
  }

  /**
   * Import LinkedIn contacts
   */
  async importContactsFromLinkedIn(connectionIds?: string[]): Promise<number> {
    try {
      const response = await importLinkedInContacts(connectionIds);
      return response.data?.imported || 0;
    } catch (error) {
      console.error('Error importing LinkedIn contacts:', error);
      throw error;
    }
  }

  /**
   * Share to LinkedIn
   */
  async shareContentToLinkedIn(
    content: LinkedInShareContent
  ): Promise<{ postId: string; postUrl: string } | null> {
    try {
      const response = await shareToLinkedIn(content);
      return response.data || null;
    } catch (error) {
      console.error('Error sharing to LinkedIn:', error);
      throw error;
    }
  }

  /**
   * Cross-post content to multiple platforms
   */
  async crossPost(content: CrossPostContent): Promise<CrossPostResult[]> {
    try {
      return await crossPostContent(content);
    } catch (error) {
      console.error('Error cross-posting content:', error);
      throw error;
    }
  }

  /**
   * Get platform data
   */
  async getPlatformData(platform: SocialPlatformType): Promise<SocialPlatformData> {
    try {
      return await getSocialPlatformData(platform);
    } catch (error) {
      console.error(`Error getting ${platform} data:`, error);
      throw error;
    }
  }

  /**
   * Get platform engagement metrics
   */
  async getPlatformEngagement(
    platform: SocialPlatformType,
    days?: number
  ): Promise<SocialPlatformData> {
    try {
      switch (platform) {
        case 'twitter':
          return await getTwitterEngagement(days);
        case 'instagram':
          return await getInstagramEngagement(days);
        case 'tiktok':
          return await getTikTokEngagement(days);
        default:
          return await getSocialPlatformData(platform);
      }
    } catch (error) {
      console.error(`Error getting ${platform} engagement:`, error);
      throw error;
    }
  }

  /**
   * Check if platform is connected
   */
  async isPlatformConnected(platform: SocialPlatformType): Promise<boolean> {
    try {
      const accounts = await this.getConnectedAccounts();
      return accounts.some((account) => account.platform === platform && account.isConnected);
    } catch (error) {
      console.error(`Error checking if ${platform} is connected:`, error);
      return false;
    }
  }

  /**
   * Get platform connection status
   */
  async getPlatformStatus(platform: SocialPlatformType): Promise<{
    isConnected: boolean;
    lastSynced?: string;
    username?: string;
  }> {
    try {
      const accounts = await this.getConnectedAccounts();
      const account = accounts.find((acc) => acc.platform === platform);

      if (account && account.isConnected) {
        return {
          isConnected: true,
          lastSynced: account.lastSynced,
          username: account.username,
        };
      }

      return { isConnected: false };
    } catch (error) {
      console.error(`Error getting ${platform} status:`, error);
      return { isConnected: false };
    }
  }
}

export default new SocialIntegrationService();
