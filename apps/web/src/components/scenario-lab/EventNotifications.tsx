'use client';

/**
 * Event Notifications Component
 * =============================================================================
 * Real-time intelligence updates during timeline playback
 * Shows events, milestones, warnings, and achievements
 */

import { useState, useEffect } from 'react';
import type { TimelineNotification } from '@/lib/scenario-lab/types';

interface EventNotificationsProps {
  notifications: TimelineNotification[];
  onClose?: (id: string) => void;
}

export default function EventNotifications({
  notifications,
  onClose,
}: EventNotificationsProps) {
  const [visibleNotifications, setVisibleNotifications] = useState<TimelineNotification[]>([]);

  useEffect(() => {
    setVisibleNotifications(notifications);

    // Auto-close notifications with autoClose=true
    notifications.forEach((notif) => {
      if (notif.autoClose && notif.duration) {
        setTimeout(() => {
          handleClose(notif.id);
        }, notif.duration);
      }
    });
  }, [notifications]);

  const handleClose = (id: string) => {
    setVisibleNotifications((prev) => prev.filter((n) => n.id !== id));
    onClose?.(id);
  };

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm">
      {visibleNotifications.map((notification) => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          onClose={() => handleClose(notification.id)}
        />
      ))}
    </div>
  );
}

function NotificationCard({
  notification,
  onClose,
}: {
  notification: TimelineNotification;
  onClose: () => void;
}) {
  const getNotificationStyles = () => {
    switch (notification.severity) {
      case 'positive':
        return {
          bg: 'bg-green-50 dark:bg-green-900/30',
          border: 'border-green-500',
          text: 'text-green-900 dark:text-green-100',
          iconBg: 'bg-green-500',
        };
      case 'negative':
        return {
          bg: 'bg-red-50 dark:bg-red-900/30',
          border: 'border-red-500',
          text: 'text-red-900 dark:text-red-100',
          iconBg: 'bg-red-500',
        };
      default:
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/30',
          border: 'border-blue-500',
          text: 'text-blue-900 dark:text-blue-100',
          iconBg: 'bg-blue-500',
        };
    }
  };

  const styles = getNotificationStyles();

  const getTypeIcon = () => {
    switch (notification.type) {
      case 'milestone':
        return '🎯';
      case 'achievement':
        return '🏆';
      case 'warning':
        return '⚠️';
      case 'event':
        return notification.icon;
      default:
        return '📢';
    }
  };

  return (
    <div
      className={`${styles.bg} ${styles.border} border-l-4 rounded-lg p-4 shadow-lg animate-slide-in-right relative`}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      <div className="flex items-start space-x-3">
        {/* Icon */}
        <div
          className={`flex-shrink-0 w-10 h-10 ${styles.iconBg} rounded-full flex items-center justify-center text-white text-xl`}
        >
          {getTypeIcon()}
        </div>

        {/* Content */}
        <div className="flex-1 mr-6">
          <h4 className={`text-sm font-bold ${styles.text} mb-1`}>{notification.title}</h4>
          <p className={`text-xs ${styles.text} opacity-90`}>{notification.message}</p>

          {/* Timestamp */}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {notification.timestamp.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>

          {/* Action button (if provided) */}
          {notification.action && (
            <button
              onClick={notification.action.onClick}
              className={`mt-2 px-3 py-1 text-xs font-medium ${styles.iconBg} text-white rounded hover:opacity-90 transition-opacity`}
            >
              {notification.action.label}
            </button>
          )}
        </div>
      </div>

      {/* Animated progress bar for auto-closing notifications */}
      {notification.autoClose && notification.duration && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 overflow-hidden rounded-b-lg">
          <div
            className={`h-full ${styles.iconBg} animate-shrink-width`}
            style={{
              animationDuration: `${notification.duration}ms`,
            }}
          />
        </div>
      )}
    </div>
  );
}

// Add this to your global CSS file (globals.css)
const styles = `
@keyframes slide-in-right {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes shrink-width {
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
}

.animate-slide-in-right {
  animation: slide-in-right 0.3s ease-out;
}

.animate-shrink-width {
  animation: shrink-width linear;
}
`;
