"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

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
  loading: boolean;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (notificationId: string) => void;
  clearAll: () => void;
  refresh: () => void;
}

interface ApiNotification {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  actionUrl: string | null;
  read: boolean;
  timestamp: string;
}

export function useNotifications(): UseNotificationsResult {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await apiClient.get<{ notifications: ApiNotification[] }>("/notifications");
      const list: NotificationItem[] = (res.data?.notifications || []).map((n) => ({
        id: n.id,
        type: (n.type as NotificationType) || 'info',
        priority: (n.priority as NotificationPriority) || 'medium',
        title: n.title,
        message: n.message,
        read: n.read === true,
        timestamp: new Date(n.timestamp),
        actionUrl: n.actionUrl || undefined,
      }));
      setNotifications(list);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)));
    apiClient.post(`/notifications/${notificationId}/read`, {}).catch(() => {});
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    apiClient.post(`/notifications/read-all`, {}).catch(() => {});
  }, []);

  const deleteNotification = useCallback((notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    apiClient.delete(`/notifications/${notificationId}`).catch(() => {});
  }, []);

  const clearAll = useCallback(() => {
    setNotifications((current) => {
      current.forEach((n) => apiClient.delete(`/notifications/${n.id}`).catch(() => {}));
      return [];
    });
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification, clearAll, refresh };
}
