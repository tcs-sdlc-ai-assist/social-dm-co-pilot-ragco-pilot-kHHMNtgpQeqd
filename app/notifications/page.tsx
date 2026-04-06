"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useNotifications } from "@/lib/hooks/useNotifications";
import type { Notification } from "@/lib/types";
import { NotificationType } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

// ============================================================
// Notifications Page — /notifications
// Full-page listing with filtering, bulk actions, and navigation
// ============================================================

type FilterType = "all" | "high_priority" | "sla_breach" | "lead_created" | "escalation";
type ReadFilter = "all" | "unread" | "read";

interface FilterState {
  type: FilterType;
  readStatus: ReadFilter;
  startDate: string;
  endDate: string;
}

const TYPE_FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "high_priority", label: "High Priority" },
  { value: "sla_breach", label: "SLA Breach" },
  { value: "lead_created", label: "Lead Created" },
  { value: "escalation", label: "Escalation" },
];

const READ_FILTER_OPTIONS: { value: ReadFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];

function getNotificationTypeFromFilter(filter: FilterType): NotificationType | null {
  switch (filter) {
    case "high_priority":
      return NotificationType.HIGH_PRIORITY_LEAD;
    case "sla_breach":
      return NotificationType.SLA_BREACH;
    case "lead_created":
      return NotificationType.LEAD_CREATED;
    case "escalation":
      return NotificationType.ESCALATION;
    case "all":
    default:
      return null;
  }
}

function getNotificationTypeLabel(type: NotificationType): string {
  switch (type) {
    case NotificationType.HIGH_PRIORITY_LEAD:
      return "High Priority";
    case NotificationType.SLA_BREACH:
      return "SLA Breach";
    case NotificationType.LEAD_CREATED:
      return "Lead Created";
    case NotificationType.ESCALATION:
      return "Escalation";
    default:
      return "Notification";
  }
}

function getNotificationTypeColors(type: NotificationType): {
  text: string;
  bg: string;
  border: string;
  icon: string;
} {
  switch (type) {
    case NotificationType.HIGH_PRIORITY_LEAD:
      return {
        text: "text-red-700",
        bg: "bg-red-50",
        border: "border-red-200",
        icon: "text-red-500",
      };
    case NotificationType.SLA_BREACH:
      return {
        text: "text-orange-700",
        bg: "bg-orange-50",
        border: "border-orange-200",
        icon: "text-orange-500",
      };
    case NotificationType.LEAD_CREATED:
      return {
        text: "text-green-700",
        bg: "bg-green-50",
        border: "border-green-200",
        icon: "text-green-500",
      };
    case NotificationType.ESCALATION:
      return {
        text: "text-purple-700",
        bg: "bg-purple-50",
        border: "border-purple-200",
        icon: "text-purple-500",
      };
    default:
      return {
        text: "text-gray-700",
        bg: "bg-gray-50",
        border: "border-gray-200",
        icon: "text-gray-500",
      };
  }
}

function NotificationTypeIcon({ type }: { type: NotificationType }) {
  switch (type) {
    case NotificationType.HIGH_PRIORITY_LEAD:
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-5 h-5"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      );
    case NotificationType.SLA_BREACH:
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-5 h-5"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
            clipRule="evenodd"
          />
        </svg>
      );
    case NotificationType.LEAD_CREATED:
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-5 h-5"
          aria-hidden="true"
        >
          <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
        </svg>
      );
    case NotificationType.ESCALATION:
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-5 h-5"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z"
            clipRule="evenodd"
          />
        </svg>
      );
    default:
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-5 h-5"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 2a6 6 0 00-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 00.515 1.076 32.91 32.91 0 003.256.508 3.5 3.5 0 006.972 0 32.903 32.903 0 003.256-.508.75.75 0 00.515-1.076A11.448 11.448 0 0116 8a6 6 0 00-6-6zM8.05 14.943a33.54 33.54 0 003.9 0 2 2 0 01-3.9 0z"
            clipRule="evenodd"
          />
        </svg>
      );
  }
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return "";
    }
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "";
  }
}

function formatFullDate(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// ----- Loading Skeleton -----

function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-4 px-6 py-4 border-b border-gray-100 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-4 w-20 bg-gray-200 rounded" />
          <div className="h-3 w-16 bg-gray-200 rounded" />
        </div>
        <div className="h-4 w-full bg-gray-200 rounded" />
        <div className="h-3 w-1/3 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

// ----- Empty State -----

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1}
        stroke="currentColor"
        className="w-16 h-16 text-gray-300 mb-4"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
        />
      </svg>
      <p className="text-body font-medium text-gray-500">
        {hasFilters ? "No notifications match your filters" : "No notifications yet"}
      </p>
      <p className="text-body-sm text-gray-400 mt-1">
        {hasFilters
          ? "Try adjusting your filter criteria to see more results"
          : "Notifications for high-priority leads, SLA breaches, and escalations will appear here"}
      </p>
    </div>
  );
}

// ----- Error State -----

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-12 h-12 text-red-400 mb-4"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
        />
      </svg>
      <p className="text-body font-medium text-red-600 mb-1">
        Failed to load notifications
      </p>
      <p className="text-body-sm text-gray-500 mb-4">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 text-body-sm font-medium text-white shadow-sm hover:bg-brand-600 transition-colors duration-200 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        Retry
      </button>
    </div>
  );
}

// ----- Notification Row -----

function NotificationRow({
  notification,
  selected,
  onToggleSelect,
  onMarkAsRead,
  onNavigate,
}: {
  notification: Notification;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onMarkAsRead: (id: string) => void;
  onNavigate: (notification: Notification) => void;
}) {
  const isUnread = notification.status !== "read";
  const colors = getNotificationTypeColors(notification.type);
  const typeLabel = getNotificationTypeLabel(notification.type);

  const handleClick = useCallback(() => {
    if (isUnread) {
      onMarkAsRead(notification.id);
    }
    onNavigate(notification);
  }, [isUnread, notification, onMarkAsRead, onNavigate]);

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      onToggleSelect(notification.id);
    },
    [notification.id, onToggleSelect]
  );

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      className={`flex items-start gap-4 px-6 py-4 border-b border-gray-100 transition-colors duration-150 cursor-pointer hover:bg-gray-50 ${
        isUnread ? "bg-blue-50/40" : "bg-white"
      } ${selected ? "ring-2 ring-inset ring-brand-500/20 bg-brand-50/30" : ""}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`${isUnread ? "Unread" : "Read"} notification: ${notification.message}`}
    >
      {/* Checkbox */}
      <div className="flex-shrink-0 pt-1" onClick={handleCheckboxClick}>
        <input
          type="checkbox"
          checked={selected}
          onChange={handleCheckboxChange}
          className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 focus:ring-offset-0 cursor-pointer"
          aria-label={`Select notification ${notification.id}`}
        />
      </div>

      {/* Icon */}
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${colors.bg} ${colors.icon}`}
      >
        <NotificationTypeIcon type={notification.type} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium ${colors.text} ${colors.bg} ${colors.border}`}
          >
            {typeLabel}
          </span>
          <span className="text-2xs text-gray-400">
            {formatTimestamp(notification.timestamp)}
          </span>
          {isUnread && (
            <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" aria-label="Unread" />
          )}
        </div>
        <p
          className={`text-body-sm leading-snug ${
            isUnread ? "font-semibold text-gray-900" : "font-normal text-gray-700"
          }`}
        >
          {notification.message}
        </p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-2xs text-gray-400">
            {formatFullDate(notification.timestamp)}
          </span>
          {notification.leadId && (
            <span className="text-2xs text-gray-400">
              Ref: {notification.leadId}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-1">
        {isUnread && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMarkAsRead(notification.id);
            }}
            className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-150"
            aria-label="Mark as read"
            title="Mark as read"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
        {notification.leadId && (
          <a
            href={
              notification.type === NotificationType.SLA_BREACH
                ? `/inbox?dm=${notification.leadId}`
                : `/leads?id=${notification.leadId}`
            }
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors duration-150"
            aria-label={
              notification.type === NotificationType.SLA_BREACH
                ? "View DM"
                : "View Lead"
            }
            title={
              notification.type === NotificationType.SLA_BREACH
                ? "View DM"
                : "View Lead"
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5zm4.943-.53a.75.75 0 01.53-.22h5.5a.75.75 0 01.75.75v5.5a.75.75 0 01-1.5 0V7.06l-5.22 5.22a.75.75 0 11-1.06-1.06l5.22-5.22H9.723a.75.75 0 01-.53-1.28z"
                clipRule="evenodd"
              />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}

// ============================================================
// NotificationsPage Component
// ============================================================

const RECIPIENT_ID = "sales-consultant-default";

export default function NotificationsPage() {
  const [filters, setFilters] = useState<FilterState>({
    type: "all",
    readStatus: "all",
    startDate: "",
    endDate: "",
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    refreshNotifications,
  } = useNotifications({
    recipientId: RECIPIENT_ID,
    enabled: true,
  });

  // ----- Filtering -----

  const filteredNotifications = useMemo(() => {
    let result = [...notifications];

    // Filter by type
    const targetType = getNotificationTypeFromFilter(filters.type);
    if (targetType !== null) {
      result = result.filter((n) => n.type === targetType);
    }

    // Filter by read status
    if (filters.readStatus === "unread") {
      result = result.filter((n) => n.status !== "read");
    } else if (filters.readStatus === "read") {
      result = result.filter((n) => n.status === "read");
    }

    // Filter by start date
    if (filters.startDate) {
      const startTime = new Date(filters.startDate).getTime();
      if (!isNaN(startTime)) {
        result = result.filter(
          (n) => new Date(n.timestamp).getTime() >= startTime
        );
      }
    }

    // Filter by end date
    if (filters.endDate) {
      const endTime = new Date(filters.endDate).getTime() + 24 * 60 * 60 * 1000; // Include full end day
      if (!isNaN(endTime)) {
        result = result.filter(
          (n) => new Date(n.timestamp).getTime() <= endTime
        );
      }
    }

    // Sort by timestamp descending
    result.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return result;
  }, [notifications, filters]);

  const hasActiveFilters =
    filters.type !== "all" ||
    filters.readStatus !== "all" ||
    filters.startDate !== "" ||
    filters.endDate !== "";

  // ----- Selection -----

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredNotifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNotifications.map((n) => n.id)));
    }
  }, [selectedIds.size, filteredNotifications]);

  const allSelected =
    filteredNotifications.length > 0 &&
    selectedIds.size === filteredNotifications.length;

  const someSelected = selectedIds.size > 0 && !allSelected;

  // ----- Bulk Mark as Read -----

  const handleBulkMarkAsRead = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setBulkActionLoading(true);

    const promises: Promise<void>[] = [];
    for (const id of selectedIds) {
      const notification = notifications.find((n) => n.id === id);
      if (notification && notification.status !== "read") {
        promises.push(markAsRead(id));
      }
    }

    await Promise.all(promises);
    setSelectedIds(new Set());
    setBulkActionLoading(false);
  }, [selectedIds, notifications, markAsRead]);

  // ----- Mark Single as Read -----

  const handleMarkAsRead = useCallback(
    async (id: string) => {
      await markAsRead(id);
    },
    [markAsRead]
  );

  // ----- Navigation -----

  const handleNavigate = useCallback((notification: Notification) => {
    if (!notification.leadId) return;

    if (notification.type === NotificationType.SLA_BREACH) {
      window.location.href = `/inbox?dm=${notification.leadId}`;
    } else {
      window.location.href = `/leads?id=${notification.leadId}`;
    }
  }, []);

  // ----- Filter Handlers -----

  const handleTypeFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setFilters((prev) => ({
        ...prev,
        type: e.target.value as FilterType,
      }));
      setSelectedIds(new Set());
    },
    []
  );

  const handleReadFilterChange = useCallback(
    (value: ReadFilter) => {
      setFilters((prev) => ({
        ...prev,
        readStatus: value,
      }));
      setSelectedIds(new Set());
    },
    []
  );

  const handleStartDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilters((prev) => ({
        ...prev,
        startDate: e.target.value,
      }));
      setSelectedIds(new Set());
    },
    []
  );

  const handleEndDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilters((prev) => ({
        ...prev,
        endDate: e.target.value,
      }));
      setSelectedIds(new Set());
    },
    []
  );

  const handleClearFilters = useCallback(() => {
    setFilters({
      type: "all",
      readStatus: "all",
      startDate: "",
      endDate: "",
    });
    setSelectedIds(new Set());
  }, []);

  // ----- Stats -----

  const stats = useMemo(() => {
    const counts: Record<string, number> = {
      total: notifications.length,
      unread: 0,
      high_priority: 0,
      sla_breach: 0,
      lead_created: 0,
      escalation: 0,
    };

    for (const n of notifications) {
      if (n.status !== "read") counts.unread++;
      if (n.type === NotificationType.HIGH_PRIORITY_LEAD) counts.high_priority++;
      if (n.type === NotificationType.SLA_BREACH) counts.sla_breach++;
      if (n.type === NotificationType.LEAD_CREATED) counts.lead_created++;
      if (n.type === NotificationType.ESCALATION) counts.escalation++;
    }

    return counts;
  }, [notifications]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div>
              <h1 className="text-heading-2 text-gray-900">Notifications</h1>
              <p className="text-body-sm text-gray-500 mt-1">
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
                  : "All caught up — no unread notifications"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={refreshNotifications}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-body-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
                  />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <p className="text-2xs font-medium text-gray-500 uppercase tracking-wide">Total</p>
            <p className="text-heading-3 text-gray-900 mt-1">{stats.total}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-2xs font-medium text-blue-600 uppercase tracking-wide">Unread</p>
            <p className="text-heading-3 text-blue-700 mt-1">{stats.unread}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-2xs font-medium text-red-600 uppercase tracking-wide">High Priority</p>
            <p className="text-heading-3 text-red-700 mt-1">{stats.high_priority}</p>
          </div>
          <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
            <p className="text-2xs font-medium text-orange-600 uppercase tracking-wide">SLA Breach</p>
            <p className="text-heading-3 text-orange-700 mt-1">{stats.sla_breach}</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
            <p className="text-2xs font-medium text-green-600 uppercase tracking-wide">Lead Created</p>
            <p className="text-heading-3 text-green-700 mt-1">{stats.lead_created}</p>
          </div>
          <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
            <p className="text-2xs font-medium text-purple-600 uppercase tracking-wide">Escalation</p>
            <p className="text-heading-3 text-purple-700 mt-1">{stats.escalation}</p>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 mb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="notification-type-filter"
                className="text-body-sm font-medium text-gray-700 whitespace-nowrap"
              >
                Type
              </label>
              <select
                id="notification-type-filter"
                value={filters.type}
                onChange={handleTypeFilterChange}
                className="rounded-lg border border-gray-300 bg-white py-1.5 pl-3 pr-8 text-body-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {TYPE_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Read Status Filter */}
            <div className="flex items-center gap-1">
              {READ_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleReadFilterChange(option.value)}
                  className={`px-3 py-1.5 rounded-full text-2xs font-medium transition-colors duration-150 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 ${
                    filters.readStatus === option.value
                      ? "bg-brand-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="notification-start-date"
                className="text-body-sm font-medium text-gray-700 whitespace-nowrap"
              >
                From
              </label>
              <input
                id="notification-start-date"
                type="date"
                value={filters.startDate}
                onChange={handleStartDateChange}
                className="rounded-lg border border-gray-300 bg-white py-1.5 px-3 text-body-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label
                htmlFor="notification-end-date"
                className="text-body-sm font-medium text-gray-700 whitespace-nowrap"
              >
                To
              </label>
              <input
                id="notification-end-date"
                type="date"
                value={filters.endDate}
                onChange={handleEndDateChange}
                className="rounded-lg border border-gray-300 bg-white py-1.5 px-3 text-body-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-body-sm text-brand-600 hover:text-brand-700 font-medium transition-colors duration-150"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 mb-4 flex items-center justify-between animate-fade-in">
            <p className="text-body-sm font-medium text-brand-700">
              {selectedIds.size} notification{selectedIds.size !== 1 ? "s" : ""} selected
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBulkMarkAsRead}
                disabled={bulkActionLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-body-sm font-medium text-white shadow-sm hover:bg-brand-600 transition-colors duration-200 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkActionLoading ? (
                  <>
                    <svg
                      className="animate-spin h-3.5 w-3.5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Marking…
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-3.5 h-3.5"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Mark as Read
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="inline-flex items-center rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-body-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors duration-200 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                Deselect All
              </button>
            </div>
          </div>
        )}

        {/* Notification List */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          {/* List Header */}
          <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex-shrink-0">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) {
                    el.indeterminate = someSelected;
                  }
                }}
                onChange={handleSelectAll}
                disabled={filteredNotifications.length === 0}
                className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 focus:ring-offset-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Select all notifications"
              />
            </div>
            <div className="flex-1 flex items-center justify-between">
              <p className="text-caption font-medium text-gray-500">
                {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? "s" : ""}
                {hasActiveFilters ? " (filtered)" : ""}
              </p>
              {filteredNotifications.length > 0 && (
                <p className="text-2xs text-gray-400">
                  Sorted by most recent
                </p>
              )}
            </div>
          </div>

          {/* Error State */}
          {error && !loading && (
            <ErrorState message={error} onRetry={refreshNotifications} />
          )}

          {/* Loading State */}
          {loading && notifications.length === 0 && !error && (
            <div>
              {Array.from({ length: 6 }).map((_, i) => (
                <NotificationSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filteredNotifications.length === 0 && (
            <EmptyState hasFilters={hasActiveFilters} />
          )}

          {/* Notification Items */}
          {!error &&
            filteredNotifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                selected={selectedIds.has(notification.id)}
                onToggleSelect={handleToggleSelect}
                onMarkAsRead={handleMarkAsRead}
                onNavigate={handleNavigate}
              />
            ))}
        </div>

        {/* Footer */}
        {filteredNotifications.length > 0 && (
          <div className="mt-3 text-center">
            <p className="text-2xs text-gray-400">
              Showing {filteredNotifications.length} of {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}