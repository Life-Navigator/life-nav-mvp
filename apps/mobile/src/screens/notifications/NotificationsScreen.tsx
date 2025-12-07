/**
 * Life Navigator - Notifications Screen
 *
 * Elite-level smart notifications center
 * Categorized alerts, action items, priority inbox, and notification management
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Switch,
  Modal,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles } from '../../utils/typography';
import { Card } from '../../components/common/Card';

// Types
interface Notification {
  id: string;
  type: 'medication' | 'appointment' | 'budget' | 'goal' | 'insight' | 'document' | 'family' | 'career';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  read: boolean;
  actionable: boolean;
  actions?: NotificationAction[];
  metadata?: {
    relatedId?: string;
    relatedType?: string;
    timestamp: string;
    expiresAt?: string;
  };
  createdAt: string;
}

interface NotificationAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
}

interface NotificationPreferences {
  enabled: boolean;
  doNotDisturb: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
  channels: {
    medications: boolean;
    appointments: boolean;
    budgets: boolean;
    goals: boolean;
    aiInsights: boolean;
    documents: boolean;
    family: boolean;
    career: boolean;
  };
  digestMode: {
    enabled: boolean;
    frequency: 'daily' | 'weekly';
    time: string;
  };
}

export function NotificationsScreen() {
  const queryClient = useQueryClient();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch notifications
  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications', selectedFilter, showArchived],
    queryFn: async () => {
      // TODO: Replace with actual API call
      return mockNotifications.filter((n) => {
        if (selectedFilter !== 'all' && n.priority !== selectedFilter) return false;
        return true;
      });
    },
  });

  // Fetch preferences
  const { data: preferences, refetch: refetchPreferences } = useQuery<NotificationPreferences>({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      return mockPreferences;
    },
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      // TODO: API call to mark as read
      console.log('Marking as read:', notificationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      // TODO: API call to delete notification
      console.log('Deleting notification:', notificationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      // TODO: API call to mark all as read
      console.log('Marking all as read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      // TODO: API call to update preferences
      console.log('Updating preferences:', updates);
    },
    onSuccess: () => {
      refetchPreferences();
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    setRefreshing(false);
  }, [queryClient]);

  const handleNotificationAction = (notificationId: string, actionId: string) => {
    console.log('Action triggered:', { notificationId, actionId });
    // TODO: Implement action handling
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return colors.error;
      case 'medium':
        return colors.warning;
      case 'low':
        return colors.info;
      default:
        return colors.gray[500];
    }
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      medication: '💊',
      appointment: '📅',
      budget: '💰',
      goal: '🎯',
      insight: '💡',
      document: '📄',
      family: '👨‍👩‍👧‍👦',
      career: '💼',
    };
    return icons[type] || '🔔';
  };

  const renderNotificationCard = (notification: Notification) => (
    <Card
      key={notification.id}
      style={[styles.notificationCard, !notification.read && styles.unreadCard]}
      shadow="sm"
    >
      <View style={styles.notificationHeader}>
        <Text style={styles.typeIcon}>{getTypeIcon(notification.type)}</Text>
        <View style={styles.notificationInfo}>
          <View style={styles.titleRow}>
            <Text style={[styles.notificationTitle, !notification.read && styles.unreadTitle]}>
              {notification.title}
            </Text>
            {!notification.read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notificationType}>{notification.type.toUpperCase()}</Text>
        </View>
        <View style={[styles.priorityIndicator, { backgroundColor: getPriorityColor(notification.priority) }]} />
      </View>

      <Text style={styles.notificationMessage}>{notification.message}</Text>

      <View style={styles.notificationMeta}>
        <Text style={styles.timestamp}>{formatTimestamp(notification.createdAt)}</Text>
        {notification.metadata?.expiresAt && (
          <Text style={styles.expiresText}>Expires: {formatTimestamp(notification.metadata.expiresAt)}</Text>
        )}
      </View>

      {notification.actions && notification.actions.length > 0 && (
        <View style={styles.actionsContainer}>
          {notification.actions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={[
                styles.actionButton,
                action.type === 'primary' && styles.primaryAction,
                action.type === 'danger' && styles.dangerAction,
              ]}
              onPress={() => handleNotificationAction(notification.id, action.id)}
            >
              <Text
                style={[
                  styles.actionText,
                  action.type === 'primary' && styles.primaryActionText,
                  action.type === 'danger' && styles.dangerActionText,
                ]}
              >
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.notificationActions}>
        {!notification.read && (
          <TouchableOpacity
            style={styles.actionLink}
            onPress={() => markAsReadMutation.mutate(notification.id)}
          >
            <Text style={styles.actionLinkText}>Mark as read</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.actionLink}
          onPress={() => deleteNotificationMutation.mutate(notification.id)}
        >
          <Text style={[styles.actionLinkText, styles.deleteText]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  const renderPreferencesModal = () => (
    <Modal
      visible={showPreferences}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowPreferences(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Notification Preferences</Text>
          <TouchableOpacity onPress={() => setShowPreferences(false)}>
            <Text style={styles.closeButton}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Master Toggle */}
          <Card style={styles.preferenceSection}>
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceInfo}>
                <Text style={styles.preferenceTitle}>Enable Notifications</Text>
                <Text style={styles.preferenceDescription}>Receive all app notifications</Text>
              </View>
              <Switch
                value={preferences?.enabled}
                onValueChange={(value) =>
                  updatePreferencesMutation.mutate({ enabled: value })
                }
              />
            </View>
          </Card>

          {/* Do Not Disturb */}
          <Card style={styles.preferenceSection}>
            <Text style={styles.sectionTitle}>Do Not Disturb</Text>
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceInfo}>
                <Text style={styles.preferenceTitle}>Quiet Hours</Text>
                <Text style={styles.preferenceDescription}>
                  {preferences?.doNotDisturb.enabled
                    ? `${preferences.doNotDisturb.startTime} - ${preferences.doNotDisturb.endTime}`
                    : 'Disabled'}
                </Text>
              </View>
              <Switch
                value={preferences?.doNotDisturb.enabled}
                onValueChange={(value) =>
                  updatePreferencesMutation.mutate({
                    doNotDisturb: { ...preferences!.doNotDisturb, enabled: value },
                  })
                }
              />
            </View>
          </Card>

          {/* Digest Mode */}
          <Card style={styles.preferenceSection}>
            <Text style={styles.sectionTitle}>Digest Mode</Text>
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceInfo}>
                <Text style={styles.preferenceTitle}>Daily/Weekly Summary</Text>
                <Text style={styles.preferenceDescription}>
                  {preferences?.digestMode.enabled
                    ? `${preferences.digestMode.frequency} at ${preferences.digestMode.time}`
                    : 'Disabled'}
                </Text>
              </View>
              <Switch
                value={preferences?.digestMode.enabled}
                onValueChange={(value) =>
                  updatePreferencesMutation.mutate({
                    digestMode: { ...preferences!.digestMode, enabled: value },
                  })
                }
              />
            </View>
          </Card>

          {/* Channel Preferences */}
          <Card style={styles.preferenceSection}>
            <Text style={styles.sectionTitle}>Notification Channels</Text>
            {Object.entries(preferences?.channels || {}).map(([channel, enabled]) => (
              <View key={channel} style={styles.preferenceRow}>
                <View style={styles.preferenceInfo}>
                  <Text style={styles.preferenceTitle}>
                    {channel.charAt(0).toUpperCase() + channel.slice(1).replace(/([A-Z])/g, ' $1')}
                  </Text>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={(value) =>
                    updatePreferencesMutation.mutate({
                      channels: { ...preferences!.channels, [channel]: value },
                    })
                  }
                />
              </View>
            ))}
          </Card>
        </ScrollView>
      </View>
    </Modal>
  );

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={styles.unreadCount}>{unreadCount} unread</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => setShowPreferences(true)}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Action Bar */}
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.actionBarButton}
            onPress={() => markAllAsReadMutation.mutate()}
            disabled={unreadCount === 0}
          >
            <Text style={[styles.actionBarText, unreadCount === 0 && styles.disabledText]}>
              Mark all read
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBarButton}
            onPress={() => setShowArchived(!showArchived)}
          >
            <Text style={styles.actionBarText}>
              {showArchived ? 'Hide archived' : 'Show archived'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
        {['all', 'high', 'medium', 'low'].map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filter, selectedFilter === filter && styles.filterActive]}
            onPress={() => setSelectedFilter(filter as any)}
          >
            <Text style={[styles.filterText, selectedFilter === filter && styles.filterTextActive]}>
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
            {filter !== 'all' && (
              <View
                style={[
                  styles.filterIndicator,
                  { backgroundColor: getPriorityColor(filter) },
                ]}
              />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Notifications List */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {notifications && notifications.length > 0 ? (
          notifications.map(renderNotificationCard)
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptyDescription}>You're all caught up!</Text>
          </View>
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Preferences Modal */}
      {renderPreferencesModal()}
    </View>
  );
}

// Helper function
const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

// Mock data
const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'medication',
    title: 'Time for your medication',
    message: 'Take 1 Lisinopril 10mg tablet',
    priority: 'high',
    read: false,
    actionable: true,
    actions: [
      { id: 'taken', label: 'Mark as taken', type: 'primary' },
      { id: 'snooze', label: 'Snooze 30m', type: 'secondary' },
    ],
    metadata: {
      timestamp: new Date(Date.now() - 300000).toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
    createdAt: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: '2',
    type: 'appointment',
    title: 'Upcoming appointment',
    message: 'Dr. Smith - Annual checkup tomorrow at 2:00 PM',
    priority: 'medium',
    read: false,
    actionable: true,
    actions: [
      { id: 'confirm', label: 'Confirm', type: 'primary' },
      { id: 'reschedule', label: 'Reschedule', type: 'secondary' },
    ],
    metadata: {
      timestamp: new Date(Date.now() - 7200000).toISOString(),
    },
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: '3',
    type: 'budget',
    title: 'Budget alert',
    message: 'You've spent 85% of your grocery budget this month',
    priority: 'medium',
    read: true,
    actionable: false,
    metadata: {
      timestamp: new Date(Date.now() - 86400000).toISOString(),
    },
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: '4',
    type: 'goal',
    title: 'Goal milestone reached',
    message: 'You've saved 50% towards your vacation fund!',
    priority: 'low',
    read: true,
    actionable: false,
    metadata: {
      timestamp: new Date(Date.now() - 172800000).toISOString(),
    },
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: '5',
    type: 'insight',
    title: 'New AI insight available',
    message: "We've detected a new spending pattern you should review",
    priority: 'low',
    read: false,
    actionable: true,
    actions: [{ id: 'view', label: 'View insight', type: 'primary' }],
    metadata: {
      timestamp: new Date(Date.now() - 259200000).toISOString(),
    },
    createdAt: new Date(Date.now() - 259200000).toISOString(),
  },
];

const mockPreferences: NotificationPreferences = {
  enabled: true,
  doNotDisturb: {
    enabled: true,
    startTime: '10:00 PM',
    endTime: '7:00 AM',
  },
  channels: {
    medications: true,
    appointments: true,
    budgets: true,
    goals: true,
    aiInsights: true,
    documents: false,
    family: true,
    career: true,
  },
  digestMode: {
    enabled: false,
    frequency: 'daily',
    time: '8:00 AM',
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
  },
  loadingText: {
    ...textStyles.body,
    color: colors.gray[600],
    marginTop: spacing[2],
  },
  header: {
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    paddingTop: spacing[6],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  headerTitle: {
    ...textStyles.h2,
    color: colors.gray[900],
  },
  unreadCount: {
    ...textStyles.body,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing[1],
  },
  settingsIcon: {
    fontSize: 24,
  },
  actionBar: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  actionBarButton: {
    flex: 1,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  actionBarText: {
    ...textStyles.body,
    color: colors.primary,
    fontWeight: '600',
  },
  disabledText: {
    color: colors.gray[400],
  },
  filters: {
    backgroundColor: colors.light.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
  },
  filter: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    marginRight: spacing[2],
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  filterActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    ...textStyles.body,
    color: colors.gray[600],
    fontWeight: '600',
  },
  filterTextActive: {
    color: colors.light.primary,
  },
  filterIndicator: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
  },
  content: {
    flex: 1,
    padding: spacing[4],
  },
  notificationCard: {
    marginBottom: spacing[3],
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing[2],
  },
  typeIcon: {
    fontSize: 24,
    marginRight: spacing[2],
  },
  notificationInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  notificationTitle: {
    ...textStyles.h4,
    color: colors.gray[900],
  },
  unreadTitle: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  notificationType: {
    ...textStyles.caption,
    color: colors.gray[600],
    marginTop: spacing[1],
  },
  priorityIndicator: {
    width: 4,
    height: 24,
    borderRadius: borderRadius.sm,
  },
  notificationMessage: {
    ...textStyles.body,
    color: colors.gray[700],
    marginBottom: spacing[2],
    lineHeight: 22,
  },
  notificationMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  timestamp: {
    ...textStyles.caption,
    color: colors.gray[500],
  },
  expiresText: {
    ...textStyles.caption,
    color: colors.warning,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray[300],
    alignItems: 'center',
  },
  primaryAction: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dangerAction: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  actionText: {
    ...textStyles.body,
    color: colors.gray[700],
    fontWeight: '600',
  },
  primaryActionText: {
    color: colors.light.primary,
  },
  dangerActionText: {
    color: colors.light.primary,
  },
  notificationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    paddingTop: spacing[2],
  },
  actionLink: {
    padding: spacing[1],
  },
  actionLinkText: {
    ...textStyles.body,
    color: colors.primary,
    fontWeight: '600',
  },
  deleteText: {
    color: colors.error,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[8],
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing[3],
  },
  emptyTitle: {
    ...textStyles.h3,
    color: colors.gray[900],
    marginBottom: spacing[2],
  },
  emptyDescription: {
    ...textStyles.body,
    color: colors.gray[600],
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    paddingTop: spacing[6],
    backgroundColor: colors.light.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  modalTitle: {
    ...textStyles.h3,
    color: colors.gray[900],
  },
  closeButton: {
    ...textStyles.body,
    color: colors.primary,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: spacing[4],
  },
  preferenceSection: {
    marginBottom: spacing[3],
  },
  sectionTitle: {
    ...textStyles.h4,
    color: colors.gray[900],
    marginBottom: spacing[3],
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  preferenceInfo: {
    flex: 1,
    marginRight: spacing[2],
  },
  preferenceTitle: {
    ...textStyles.body,
    color: colors.gray[900],
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  preferenceDescription: {
    ...textStyles.caption,
    color: colors.gray[600],
  },
  bottomPadding: {
    height: spacing[8],
  },
});
