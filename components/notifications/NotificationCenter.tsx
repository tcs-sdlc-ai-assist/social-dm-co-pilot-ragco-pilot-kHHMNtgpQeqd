"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNotifications } from "@/lib/hooks/useNotifications";
import type { Notification } from "@/lib/types";
import { NotificationType } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

// ============================================================
// NotificationCenter — Dropdown panel for alerts and SLA breaches
// ============================================================

export interface NotificationCenterProps {
  recipientId: string;
  onNavigateToDM?: (dmId: string) => void;
  onNavigateToLead?: (leadId: string) => void;
}

type FilterType = "all" | "high_priority" | "sla_breach";

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "high_priority", label: "High Priority" },
  { value: "sla_breach", label: "SLA Breach" },
];

function getNotificationTypeFilter(filter: FilterType): ((n: Notification) => boolean) {
  switch (filter) {
    case "high_priority":
      return (n) =>
        n.type === NotificationType.HIGH_PRIORITY_LEAD ||
        n.type === NotificationType.ESCALATION;
    case "sla_breach":
      return (n) => n.type === NotificationType.SLA_BREACH;
    case "all":
    default:
      return () => true;
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
          className="w-5 h-5 text-red-500 flex-shrink-0"
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
          className="w-5 h-5 text-orange-500 flex-shrink-0"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
            clipRule="evenodd"
          />
        </svg>
      );
    case NotificationType.ESCALATION:
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-5 h-5 text-purple-500 flex-shrink-0"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z"
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
          className="w-5 h-5 text-green-500 flex-shrink-0"
          aria-hidden="true"
        >
          <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
        </svg>
      );
    default:
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-5 h-5 text-gray-400 flex-shrink-0"
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

function isSLABreachMessage(notification: Notification): boolean {
  return notification.type === NotificationType.SLA_BREACH;
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onNavigateToDM,
  onNavigateToLead,
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onNavigateToDM?: (dmId: string) => void;
  onNavigateToLead?: (leadId: string) => void;
}) {
  const isUnread = notification.status !== "read";
  const isSLABreach = isSLABreachMessage(notification);

  const handleClick = useCallback(() => {
    if (isUnread) {
      onMarkAsRead(notification.id);
    }

    if (isSLABreach && onNavigateToDM && notification.leadId) {
      onNavigateToDM(notification.leadId);
    } else if (onNavigateToLead && notification.leadId) {
      onNavigateToLead(notification.leadId);
    }
  }, [isUnread, isSLABreach, notification.id, notification.leadId, onMarkAsRead, onNavigateToDM, onNavigateToLead]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors duration-200 hover:bg-gray-50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
        isUnread ? "bg-blue-50/50" : "bg-white"
      }`}
      aria-label={`${isUnread ? "Unread notification" : "Notification"}: ${notification.message}`}
    >
      <div className="mt-0.5">
        <NotificationTypeIcon type={notification.type} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-body-sm leading-snug ${
            isUnread ? "font-semibold text-gray-900" : "font-normal text-gray-700"
          }`}
        >
          {notification.message}
        </p>
        {isSLABreach && (
          <p className="text-2xs text-orange-600 font-medium mt-0.5">
            No response in 1 hour — SLA breach
          </p>
        )}
        <p className="text-2xs text-gray-400 mt-1">
          {formatTimestamp(notification.timestamp)}
        </p>
      </div>
      {isUnread && (
        <span
          className="mt-2 w-2 h-2 rounded-full bg-brand-500 flex-shrink-0"
          aria-label="Unread"
        />
      )}
    </button>
  );
}

export default function NotificationCenter({
  recipientId,
  onNavigateToDM,
  onNavigateToLead,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    refreshNotifications,
  } = useNotifications({
    recipientId,
    enabled: true,
  });

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close panel on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const togglePanel = useCallback(() => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      refreshNotifications();
    }
  }, [isOpen, refreshNotifications]);

  const handleMarkAsRead = useCallback(
    async (id: string) => {
      await markAsRead(id);
    },
    [markAsRead]
  );

  const filteredNotifications = notifications.filter(
    getNotificationTypeFilter(activeFilter)
  );

  const displayCount = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div className="relative inline-block">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={togglePanel}
        aria-label={
          unreadCount > 0
            ? `Notifications: ${unreadCount} unread`
            : "Notifications: none"
        }
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="relative inline-flex items-center justify-center rounded-lg p-2 text-gray-500 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-6 w-6"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>

        {unreadCount > 0 && (
          <span
            className={`absolute -right-0.5 -top-0.5 inline-flex items-center justify-center rounded-full bg-red-500 text-white shadow-sm ${
              unreadCount > 99
                ? "min-w-[1.375rem] px-1 py-0.5 text-2xs"
                : "min-w-[1.125rem] px-1 py-0.5 text-2xs"
            }`}
            aria-hidden="true"
          >
            {displayCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notification center"
          className="absolute right-0 top-full mt-2 w-96 max-h-[32rem] rounded-xl border border-gray-200 bg-white shadow-dropdown animate-fade-in z-50 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-heading-4 text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-2xs font-medium text-red-600">
                {unreadCount} unread
              </span>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100 bg-gray-50/50">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setActiveFilter(option.value)}
                className={`px-3 py-1 rounded-full text-2xs font-medium transition-colors duration-200 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 ${
                  activeFilter === option.value
                    ? "bg-brand-500 text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {loading && notifications.length === 0 && (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5 text-gray-400"
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
                  <p className="text-body-sm text-gray-400">Loading notifications…</p>
                </div>
              </div>
            )}

            {error && (
              <div className="px-4 py-6 text-center">
                <p className="text-body-sm text-red-500">
                  Failed to load notifications
                </p>
                <button
                  type="button"
                  onClick={refreshNotifications}
                  className="mt-2 text-2xs text-brand-500 hover:text-brand-600 font-medium transition-colors duration-200"
                >
                  Try again
                </button>
              </div>
            )}

            {!loading && !error && filteredNotifications.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-10 h-10 text-gray-300 mb-2"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
                  />
                </svg>
                <p className="text-body-sm text-gray-400">
                  {activeFilter === "all"
                    ? "No notifications yet"
                    : `No ${activeFilter === "high_priority" ? "high priority" : "SLA breach"} notifications`}
                </p>
              </div>
            )}

            {!error &&
              filteredNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                  onNavigateToDM={onNavigateToDM}
                  onNavigateToLead={onNavigateToLead}
                />
              ))}
          </div>

          {/* Footer */}
          {filteredNotifications.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-2 bg-gray-50/50">
              <p className="text-2xs text-gray-400 text-center">
                Showing {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { NotificationCenter };
export type { FilterType };