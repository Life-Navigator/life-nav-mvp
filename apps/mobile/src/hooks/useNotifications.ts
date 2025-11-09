/**
 * Life Navigator - Notifications Hooks
 *
 * React Query hooks for notification management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface Notification {
  id: string;
  type: 'medication' | 'appointment' | 'budget' | 'goal' | 'insight' | 'document' | 'family' | 'career';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  read: boolean;
  actionable: boolean;
  actions?: NotificationAction[];
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface NotificationAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
}

export interface NotificationPreferences {
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

/**
 * Query Keys for cache management
 */
export const notificationsKeys = {
  all: ['notifications'] as const,
  list: (filter?: string, archived?: boolean) => [...notificationsKeys.all, 'list', filter, archived] as const,
  preferences: () => [...notificationsKeys.all, 'preferences'] as const,
  unreadCount: () => [...notificationsKeys.all, 'unread-count'] as const,
};

/**
 * Fetch notifications
 */
export const useNotifications = (
  filter?: 'all' | 'high' | 'medium' | 'low',
  archived?: boolean
) => {
  return useQuery<Notification[]>({
    queryKey: notificationsKeys.list(filter, archived),
    queryFn: async () => {
      // TODO: Replace with actual API call
      const params = new URLSearchParams();
      if (filter && filter !== 'all') params.append('priority', filter);
      if (archived) params.append('archived', 'true');

      const response = await fetch(`/api/v1/notifications?${params}`);
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return response.json();
    },
  });
};

/**
 * Fetch notification preferences
 */
export const useNotificationPreferences = () => {
  return useQuery<NotificationPreferences>({
    queryKey: notificationsKeys.preferences(),
    queryFn: async () => {
      // TODO: Replace with actual API call
      const response = await fetch('/api/v1/notifications/preferences');
      if (!response.ok) throw new Error('Failed to fetch preferences');
      return response.json();
    },
  });
};

/**
 * Fetch unread count
 */
export const useUnreadCount = () => {
  return useQuery<number>({
    queryKey: notificationsKeys.unreadCount(),
    queryFn: async () => {
      // TODO: Replace with actual API call
      const response = await fetch('/api/v1/notifications/unread-count');
      if (!response.ok) throw new Error('Failed to fetch unread count');
      const data = await response.json();
      return data.count;
    },
  });
};

/**
 * Mark notification as read
 */
export const useMarkAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      // TODO: Replace with actual API call
      const response = await fetch(`/api/v1/notifications/${notificationId}/read`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to mark as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
};

/**
 * Mark all notifications as read
 */
export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // TODO: Replace with actual API call
      const response = await fetch('/api/v1/notifications/mark-all-read', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to mark all as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
};

/**
 * Delete notification
 */
export const useDeleteNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      // TODO: Replace with actual API call
      const response = await fetch(`/api/v1/notifications/${notificationId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete notification');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
};

/**
 * Update notification preferences
 */
export const useUpdatePreferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: Partial<NotificationPreferences>) => {
      // TODO: Replace with actual API call
      const response = await fetch('/api/v1/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });
      if (!response.ok) throw new Error('Failed to update preferences');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.preferences() });
    },
  });
};

/**
 * Handle notification action
 */
export const useNotificationAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      notificationId,
      actionId,
    }: {
      notificationId: string;
      actionId: string;
    }) => {
      // TODO: Replace with actual API call
      const response = await fetch(`/api/v1/notifications/${notificationId}/actions/${actionId}`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to execute action');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
};

export default {
  useNotifications,
  useNotificationPreferences,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  useUpdatePreferences,
  useNotificationAction,
};
