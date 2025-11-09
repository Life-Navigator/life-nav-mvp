/**
 * Life Navigator - Social Connections Screen
 *
 * Manage social media platform connections and engagement
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles } from '../../utils/typography';
import { SocialPlatformType, SocialPlatformData, LinkedInProfile } from '../../types/career';
import SocialIntegrationService from '../../services/career/SocialIntegrationService';
import { formatNumber, formatRelativeTime } from '../../utils/formatters';

export function SocialConnectionsScreen() {
  const [platforms, setPlatforms] = useState<SocialPlatformData[]>([]);
  const [linkedInProfile, setLinkedInProfile] = useState<LinkedInProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const platformConfigs: {
    platform: SocialPlatformType;
    name: string;
    color: string;
    icon: string;
  }[] = [
    { platform: 'linkedin', name: 'LinkedIn', color: '#0077B5', icon: 'LI' },
    { platform: 'twitter', name: 'Twitter/X', color: '#1DA1F2', icon: 'X' },
    { platform: 'instagram', name: 'Instagram', color: '#E4405F', icon: 'IG' },
    { platform: 'tiktok', name: 'TikTok', color: '#000000', icon: 'TT' },
  ];

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    setIsLoading(true);
    try {
      const connectedPlatforms = await SocialIntegrationService.getConnectedAccounts();
      setPlatforms(connectedPlatforms);

      // Load LinkedIn profile if connected
      const linkedInConnected = connectedPlatforms.find((p) => p.platform === 'linkedin');
      if (linkedInConnected?.isConnected) {
        try {
          const profile = await SocialIntegrationService.getLinkedInProfileData();
          setLinkedInProfile(profile);
        } catch (error) {
          console.error('Error loading LinkedIn profile:', error);
        }
      }
    } catch (error) {
      console.error('Error loading connections:', error);
      Alert.alert('Error', 'Failed to load social connections');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadConnections();
    setIsRefreshing(false);
  };

  const handleConnect = async (platform: SocialPlatformType) => {
    try {
      const result = await SocialIntegrationService.connectPlatform(platform);
      if (result) {
        Alert.alert('Success', `${platform} connected successfully!`);
        await loadConnections();
      }
    } catch (error) {
      console.error(`Error connecting ${platform}:`, error);
      Alert.alert('Error', `Failed to connect ${platform}`);
    }
  };

  const handleDisconnect = async (accountId: string, platform: SocialPlatformType) => {
    Alert.alert(
      'Disconnect Account',
      `Are you sure you want to disconnect your ${platform} account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await SocialIntegrationService.disconnectPlatform(accountId, platform);
              Alert.alert('Success', `${platform} disconnected`);
              await loadConnections();
            } catch (error) {
              Alert.alert('Error', `Failed to disconnect ${platform}`);
            }
          },
        },
      ]
    );
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const synced = await SocialIntegrationService.syncAllPlatforms();
      Alert.alert('Success', `Synced ${synced.length} platform(s)`);
      await loadConnections();
    } catch (error) {
      Alert.alert('Error', 'Failed to sync platforms');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportLinkedInContacts = async () => {
    try {
      const imported = await SocialIntegrationService.importContactsFromLinkedIn();
      Alert.alert('Success', `Imported ${imported} contacts from LinkedIn`);
    } catch (error) {
      Alert.alert('Error', 'Failed to import LinkedIn contacts');
    }
  };

  const getPlatformData = (platform: SocialPlatformType) => {
    return platforms.find((p) => p.platform === platform);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.domains.career} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Social Connections</Text>
        <TouchableOpacity
          style={styles.syncButton}
          onPress={handleSyncAll}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color={colors.text.light.inverse} />
          ) : (
            <Text style={styles.syncButtonText}>Sync All</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Total Network Reach</Text>
          <Text style={styles.summaryValue}>
            {formatNumber(
              platforms.reduce((sum, p) => sum + (p.stats?.followers || 0), 0)
            )}
          </Text>
          <Text style={styles.summaryLabel}>Followers across all platforms</Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStatItem}>
              <Text style={styles.summaryStatValue}>
                {platforms.filter((p) => p.isConnected).length}
              </Text>
              <Text style={styles.summaryStatLabel}>Connected</Text>
            </View>
            <View style={styles.summaryStatItem}>
              <Text style={styles.summaryStatValue}>
                {(
                  platforms.reduce(
                    (sum, p) => sum + (p.stats?.engagement.engagementRate || 0),
                    0
                  ) / platforms.filter((p) => p.isConnected).length || 0
                ).toFixed(1)}
                %
              </Text>
              <Text style={styles.summaryStatLabel}>Avg Engagement</Text>
            </View>
          </View>
        </View>

        {/* LinkedIn Section */}
        {linkedInProfile && (
          <View style={styles.linkedInSection}>
            <Text style={styles.sectionTitle}>LinkedIn Profile</Text>
            <View style={styles.linkedInProfile}>
              <View style={styles.linkedInHeader}>
                <View style={styles.linkedInAvatar}>
                  <Text style={styles.linkedInAvatarText}>
                    {linkedInProfile.firstName[0]}
                    {linkedInProfile.lastName[0]}
                  </Text>
                </View>
                <View style={styles.linkedInInfo}>
                  <Text style={styles.linkedInName}>
                    {linkedInProfile.firstName} {linkedInProfile.lastName}
                  </Text>
                  <Text style={styles.linkedInHeadline} numberOfLines={2}>
                    {linkedInProfile.headline}
                  </Text>
                  <Text style={styles.linkedInConnections}>
                    {formatNumber(linkedInProfile.connections)} connections
                  </Text>
                </View>
              </View>

              <View style={styles.linkedInActions}>
                <TouchableOpacity
                  style={styles.linkedInButton}
                  onPress={handleImportLinkedInContacts}
                >
                  <Text style={styles.linkedInButtonText}>Import Contacts</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.linkedInButton}>
                  <Text style={styles.linkedInButtonText}>View Recommendations</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Platform Cards */}
        <Text style={styles.sectionTitle}>Platforms</Text>
        {platformConfigs.map((config) => {
          const platformData = getPlatformData(config.platform);
          return (
            <PlatformCard
              key={config.platform}
              config={config}
              data={platformData}
              onConnect={() => handleConnect(config.platform)}
              onDisconnect={() =>
                platformData && handleDisconnect(platformData.id, config.platform)
              }
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

interface PlatformCardProps {
  config: {
    platform: SocialPlatformType;
    name: string;
    color: string;
    icon: string;
  };
  data?: SocialPlatformData;
  onConnect: () => void;
  onDisconnect: () => void;
}

function PlatformCard({ config, data, onConnect, onDisconnect }: PlatformCardProps) {
  const isConnected = data?.isConnected || false;

  return (
    <View style={styles.platformCard}>
      {/* Platform Header */}
      <View style={styles.platformHeader}>
        <View style={[styles.platformIcon, { backgroundColor: config.color }]}>
          <Text style={styles.platformIconText}>{config.icon}</Text>
        </View>
        <View style={styles.platformInfo}>
          <Text style={styles.platformName}>{config.name}</Text>
          {isConnected && data && (
            <>
              <Text style={styles.platformUsername}>@{data.username}</Text>
              <Text style={styles.platformSync}>
                Last synced: {formatRelativeTime(data.lastSynced)}
              </Text>
            </>
          )}
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: isConnected ? colors.semantic.success : colors.gray[300] },
          ]}
        >
          <Text style={styles.statusBadgeText}>
            {isConnected ? 'Connected' : 'Not Connected'}
          </Text>
        </View>
      </View>

      {/* Stats (if connected) */}
      {isConnected && data?.stats && (
        <View style={styles.platformStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatNumber(data.stats.followers)}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatNumber(data.stats.following)}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatNumber(data.stats.posts)}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {data.stats.engagement.engagementRate.toFixed(1)}%
            </Text>
            <Text style={styles.statLabel}>Engagement</Text>
          </View>
        </View>
      )}

      {/* Growth Indicators (if connected) */}
      {isConnected && data?.stats?.recentGrowth && (
        <View style={styles.platformGrowth}>
          <View style={styles.growthItem}>
            <Text
              style={[
                styles.growthValue,
                {
                  color:
                    data.stats.recentGrowth.followers > 0
                      ? colors.semantic.success
                      : colors.semantic.error,
                },
              ]}
            >
              {data.stats.recentGrowth.followers > 0 ? '+' : ''}
              {data.stats.recentGrowth.followers}
            </Text>
            <Text style={styles.growthLabel}>Followers (30d)</Text>
          </View>
          <View style={styles.growthItem}>
            <Text
              style={[
                styles.growthValue,
                {
                  color:
                    data.stats.recentGrowth.engagementRate > 0
                      ? colors.semantic.success
                      : colors.semantic.error,
                },
              ]}
            >
              {data.stats.recentGrowth.engagementRate > 0 ? '+' : ''}
              {data.stats.recentGrowth.engagementRate.toFixed(1)}%
            </Text>
            <Text style={styles.growthLabel}>Engagement (30d)</Text>
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.platformActions}>
        {isConnected ? (
          <>
            <TouchableOpacity style={styles.syncPlatformButton}>
              <Text style={styles.syncPlatformButtonText}>Sync Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.disconnectButton}
              onPress={onDisconnect}
            >
              <Text style={styles.disconnectButtonText}>Disconnect</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.connectButton, { backgroundColor: config.color }]}
            onPress={onConnect}
          >
            <Text style={styles.connectButtonText}>Connect {config.name}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.light.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.light.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  title: {
    ...textStyles.h3,
    color: colors.text.light.primary,
  },
  syncButton: {
    backgroundColor: colors.domains.career,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    minWidth: 80,
    alignItems: 'center',
  },
  syncButtonText: {
    ...textStyles.label,
    color: colors.text.light.inverse,
  },
  content: {
    flex: 1,
    padding: spacing[4],
  },
  summaryCard: {
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
    alignItems: 'center',
    ...shadows.md,
  },
  summaryTitle: {
    ...textStyles.label,
    color: colors.text.light.secondary,
    marginBottom: spacing[2],
  },
  summaryValue: {
    ...textStyles.h1,
    color: colors.domains.career,
    marginBottom: spacing[1],
  },
  summaryLabel: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
    marginBottom: spacing[3],
  },
  summaryStats: {
    flexDirection: 'row',
    gap: spacing[6],
  },
  summaryStatItem: {
    alignItems: 'center',
  },
  summaryStatValue: {
    ...textStyles.h3,
    color: colors.text.light.primary,
    marginBottom: spacing[1],
  },
  summaryStatLabel: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
  },
  linkedInSection: {
    marginBottom: spacing[4],
  },
  sectionTitle: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    marginBottom: spacing[3],
  },
  linkedInProfile: {
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  linkedInHeader: {
    flexDirection: 'row',
    marginBottom: spacing[3],
  },
  linkedInAvatar: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    backgroundColor: '#0077B5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  linkedInAvatarText: {
    ...textStyles.h3,
    color: colors.text.light.inverse,
  },
  linkedInInfo: {
    flex: 1,
  },
  linkedInName: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    marginBottom: spacing[1],
  },
  linkedInHeadline: {
    ...textStyles.body,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
  },
  linkedInConnections: {
    ...textStyles.caption,
    color: '#0077B5',
    fontWeight: '600',
  },
  linkedInActions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  linkedInButton: {
    flex: 1,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.light.tertiary,
    borderWidth: 1,
    borderColor: colors.gray[300],
    alignItems: 'center',
  },
  linkedInButtonText: {
    ...textStyles.label,
    color: colors.text.light.primary,
  },
  platformCard: {
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[3],
    ...shadows.sm,
  },
  platformHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  platformIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  platformIconText: {
    ...textStyles.h4,
    color: colors.text.light.inverse,
    fontWeight: 'bold',
  },
  platformInfo: {
    flex: 1,
  },
  platformName: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    marginBottom: spacing[1],
  },
  platformUsername: {
    ...textStyles.body,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
  },
  platformSync: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
  },
  statusBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  statusBadgeText: {
    ...textStyles.labelSmall,
    color: colors.text.light.inverse,
  },
  platformStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing[3],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.light.border,
    marginBottom: spacing[3],
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    marginBottom: spacing[1],
  },
  statLabel: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
  },
  platformGrowth: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing[3],
  },
  growthItem: {
    alignItems: 'center',
  },
  growthValue: {
    ...textStyles.h4,
    marginBottom: spacing[1],
  },
  growthLabel: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
  },
  platformActions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  connectButton: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  connectButtonText: {
    ...textStyles.label,
    color: colors.text.light.inverse,
    fontWeight: '600',
  },
  syncPlatformButton: {
    flex: 1,
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    backgroundColor: colors.light.tertiary,
    borderWidth: 1,
    borderColor: colors.gray[300],
    alignItems: 'center',
  },
  syncPlatformButtonText: {
    ...textStyles.label,
    color: colors.text.light.primary,
  },
  disconnectButton: {
    flex: 1,
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    backgroundColor: colors.semantic.error,
    alignItems: 'center',
  },
  disconnectButtonText: {
    ...textStyles.label,
    color: colors.text.light.inverse,
  },
});

export default SocialConnectionsScreen;
