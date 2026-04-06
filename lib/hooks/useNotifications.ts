import { useState, useEffect, useCallback, useRef } from "react";
import type { Notification } from "@/lib/types";
import { POLLING_INTERVAL_MS } from "@/lib/constants";

// ============================================================
// useNotifications — Notification data fetching and management hook
// ============================================================
// Provides notification list, unread count, loading state,
// markAsRead, and refresh capabilities. Polls at configured interval.
// ============================================================

export interface UseNotificationsOptions {
  recipientId: string;
  pollingInterval?: number;
  enabled?: boolean;
}

export interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markAsRead: (id: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

async function fetchNotifications(
  recipientId: string
): Promise<Notification[]> {
  const params = new URLSearchParams({ recipientId });
  const response = await fetch(`/api/notifications?${params.toString()}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch notifications: ${response.status} ${errorText}`
    );
  }

  const data = await response.json();

  if (Array.isArray(data)) {
    return data as Notification[];
  }

  if (data && Array.isArray(data.data)) {
    return data.data as Notification[];
  }

  if (data && Array.isArray(data.notifications)) {
    return data.notifications as Notification[];
  }

  return [];
}

async function markNotificationAsRead(id: string): Promise<void> {
  const response = await fetch(`/api/notifications/${id}/read`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to mark notification as read: ${response.status} ${errorText}`
    );
  }
}

export function useNotifications(
  options: UseNotificationsOptions
): UseNotificationsResult {
  const {
    recipientId,
    pollingInterval = POLLING_INTERVAL_MS,
    enabled = true,
  } = options;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef<boolean>(true);

  const computeUnreadCount = useCallback(
    (items: Notification[]): number => {
      return items.filter(
        (n) => n.status !== "read" && n.recipientId === recipientId
      ).length;
    },
    [recipientId]
  );

  const refreshNotifications = useCallback(async (): Promise<void> => {
    if (!recipientId || recipientId.trim().length === 0) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await fetchNotifications(recipientId);

      if (!mountedRef.current) {
        return;
      }

      const filtered = data.filter((n) => n.recipientId === recipientId);
      const sorted = filtered.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setNotifications(sorted);
      setUnreadCount(computeUnreadCount(sorted));
    } catch (err) {
      if (!mountedRef.current) {
        return;
      }

      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch notifications";
      setError(errorMessage);
      console.error("[useNotifications] Error fetching notifications:", err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [recipientId, computeUnreadCount]);

  const markAsRead = useCallback(
    async (id: string): Promise<void> => {
      if (!id || id.trim().length === 0) {
        return;
      }

      // Optimistic update
      setNotifications((prev) => {
        const updated = prev.map((n) =>
          n.id === id ? { ...n, status: "read" } : n
        );
        setUnreadCount(computeUnreadCount(updated));
        return updated;
      });

      try {
        await markNotificationAsRead(id);
      } catch (err) {
        // Revert optimistic update on failure
        if (mountedRef.current) {
          console.error(
            "[useNotifications] Error marking notification as read:",
            err
          );
          await refreshNotifications();
        }
      }
    },
    [computeUnreadCount, refreshNotifications]
  );

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;

    if (enabled && recipientId && recipientId.trim().length > 0) {
      setLoading(true);
      refreshNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
    }

    return () => {
      mountedRef.current = false;
    };
  }, [enabled, recipientId, refreshNotifications]);

  // Polling
  useEffect(() => {
    if (!enabled || !recipientId || recipientId.trim().length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        refreshNotifications();
      }
    }, pollingInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, recipientId, pollingInterval, refreshNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    refreshNotifications,
  };
}

export default useNotifications;