"use client";

export type NotificationType =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'ab_test'
  | 'performance';

export type NotificationPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  read: boolean;
  timestamp: Date;
  actionLabel?: string;
  actionUrl?: string;
  metadata?: {
    percentage?: number;
    value?: number;
  };
}

interface UseNotificationsResult {
  notifications: NotificationItem[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (notificationId: string) => void;
  clearAll: () => void;
}

export function useNotifications(): UseNotificationsResult {
  return {
    notifications: [],
    unreadCount: 0,
    markAsRead: () => {},
    markAllAsRead: () => {},
    deleteNotification: () => {},
    clearAll: () => {},
  };
}


