"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import StatusTag from "@/components/ui/StatusTag";
import { useInbox } from "@/lib/hooks/useInbox";
import type { InboxDM, InboxFilters, InboxStats } from "@/lib/hooks/useInbox";
import type { DMStatus } from "@/lib/constants";

// ============================================================
// InboxPanel — DM inbox list and filtering UI component
// ============================================================

export interface InboxPanelProps {
  onSelectDM?: (dm: InboxDM) => void;
  selectedDMId?: string | null;
  pollingEnabled?: boolean;
}

// ----- Filter Tabs -----

interface FilterTab {
  label: string;
  value: string | undefined;
  countKey: keyof InboxStats | null;
}

const FILTER_TABS: FilterTab[] = [
  { label: "All", value: undefined, countKey: "total" },
  { label: "New", value: "new", countKey: "new" },
  { label: "Drafted", value: "drafted", countKey: "drafted" },
  { label: "Sent", value: "sent", countKey: "sent" },
  { label: "Escalated", value: "escalated", countKey: "escalated" },
];

// ----- Sort Options -----

type SortByOption = "timestamp" | "priority" | "confidenceScore" | "slaDeadline";

interface SortOption {
  label: string;
  value: SortByOption;
}

const SORT_OPTIONS: SortOption[] = [
  { label: "Newest", value: "timestamp" },
  { label: "Priority", value: "priority" },
  { label: "Confidence", value: "confidenceScore" },
  { label: "SLA Deadline", value: "slaDeadline" },
];

// ----- Platform Icons -----

function FacebookIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-4 h-4 text-blue-600 flex-shrink-0"
      aria-label="Facebook"
    >
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-4 h-4 text-pink-500 flex-shrink-0"
      aria-label="Instagram"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function PlatformIcon({ platform }: { platform: string }) {
  if (platform.toLowerCase() === "facebook") {
    return <FacebookIcon />;
  }
  if (platform.toLowerCase() === "instagram") {
    return <InstagramIcon />;
  }
  return (
    <span className="w-4 h-4 rounded-full bg-gray-300 flex-shrink-0 inline-block" />
  );
}

// ----- Search Icon -----

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-4 h-4 text-gray-400"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
      />
    </svg>
  );
}

// ----- SLA Breach Badge -----

function SLABreachBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 border border-red-200 px-1.5 py-0.5 text-2xs font-medium text-red-600">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        fill="currentColor"
        className="w-3 h-3"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
          clipRule="evenodd"
        />
      </svg>
      SLA
    </span>
  );
}

// ----- Timestamp Formatter -----

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return "Just now";
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
}

// ----- Message Preview -----

function truncateMessage(content: string, maxLength: number = 80): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.substring(0, maxLength).trimEnd() + "…";
}

// ----- Stats Summary -----

function StatsSummary({ stats }: { stats: InboxStats }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200 text-caption text-gray-500">
      <span>
        <span className="font-semibold text-gray-700">{stats.total}</span> total
      </span>
      <span className="text-gray-300">|</span>
      <span>
        <span className="font-semibold text-blue-600">{stats.new}</span> new
      </span>
      {stats.highPriority > 0 && (
        <>
          <span className="text-gray-300">|</span>
          <span>
            <span className="font-semibold text-orange-600">{stats.highPriority}</span> high priority
          </span>
        </>
      )}
      {stats.slaBreached > 0 && (
        <>
          <span className="text-gray-300">|</span>
          <span>
            <span className="font-semibold text-red-600">{stats.slaBreached}</span> SLA breached
          </span>
        </>
      )}
    </div>
  );
}

// ----- Loading Skeleton -----

function InboxItemSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-gray-100 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-24 bg-gray-200 rounded" />
          <div className="h-3 w-12 bg-gray-200 rounded" />
        </div>
        <div className="h-3 w-full bg-gray-200 rounded" />
        <div className="h-3 w-2/3 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

// ----- Empty State -----

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1}
        stroke="currentColor"
        className="w-12 h-12 text-gray-300 mb-3"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21.75 9v.906a2.25 2.25 0 0 1-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 0 0 1.183 1.981l6.478 3.488m8.839 2.51-4.66-2.51m0 0-1.023-.55a2.25 2.25 0 0 0-2.134 0l-1.022.55m0 0-4.661 2.51m16.5 1.615a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V8.844a2.25 2.25 0 0 1 1.183-1.981l7.5-4.039a2.25 2.25 0 0 1 2.134 0l7.5 4.039a2.25 2.25 0 0 1 1.183 1.98V19.5Z"
        />
      </svg>
      <p className="text-body-sm font-medium text-gray-500">
        {hasFilters ? "No messages match your filters" : "No messages yet"}
      </p>
      <p className="text-caption text-gray-400 mt-1">
        {hasFilters
          ? "Try adjusting your search or filter criteria"
          : "Incoming DMs will appear here"}
      </p>
    </div>
  );
}

// ----- Error State -----

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-10 h-10 text-red-400 mb-3"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
        />
      </svg>
      <p className="text-body-sm font-medium text-red-600 mb-1">
        Failed to load inbox
      </p>
      <p className="text-caption text-gray-500 mb-3">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center rounded-md bg-brand-500 px-3 py-1.5 text-body-sm font-medium text-white shadow-sm hover:bg-brand-600 transition-colors duration-200 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        Retry
      </button>
    </div>
  );
}

// ----- Inbox Item -----

interface InboxItemProps {
  dm: InboxDM;
  isSelected: boolean;
  onClick: (dm: InboxDM) => void;
}

function InboxItem({ dm, isSelected, onClick }: InboxItemProps) {
  const handleClick = useCallback(() => {
    onClick(dm);
  }, [dm, onClick]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick(dm);
      }
    },
    [dm, onClick]
  );

  const isNew = dm.status.toLowerCase() === "new";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-selected={isSelected}
      className={`flex items-start gap-3 px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors duration-150 ${
        isSelected
          ? "bg-brand-50 border-l-2 border-l-brand-500"
          : "hover:bg-gray-50 border-l-2 border-l-transparent"
      } ${isNew ? "bg-white" : "bg-gray-50/30"}`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <img
          src={dm.sender.avatarUrl}
          alt={dm.sender.name}
          className="w-10 h-10 rounded-full object-cover"
          loading="lazy"
        />
        <span className="absolute -bottom-0.5 -right-0.5">
          <PlatformIcon platform={dm.platform} />
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header Row */}
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`text-body-sm truncate ${
                isNew ? "font-semibold text-gray-900" : "font-medium text-gray-700"
              }`}
            >
              {dm.sender.name}
            </span>
            <span className="text-caption text-gray-400 truncate">
              @{dm.sender.handle}
            </span>
          </div>
          <span className="text-2xs text-gray-400 flex-shrink-0 whitespace-nowrap">
            {formatTimestamp(dm.timestamp)}
          </span>
        </div>

        {/* Message Preview */}
        <p
          className={`text-body-sm mb-1.5 ${
            isNew ? "text-gray-800" : "text-gray-500"
          }`}
        >
          {truncateMessage(dm.content)}
        </p>

        {/* Footer Row */}
        <div className="flex items-center gap-2 flex-wrap">
          <StatusTag
            status={dm.status.toLowerCase() as DMStatus}
            size="sm"
          />
          {dm.priority.toLowerCase() === "high" && (
            <span className="inline-flex items-center rounded-full bg-orange-50 border border-orange-200 px-1.5 py-0.5 text-2xs font-medium text-orange-600">
              High Priority
            </span>
          )}
          {dm.slaBreached && <SLABreachBadge />}
          {dm.metadata.communityName && (
            <span className="text-2xs text-gray-400">
              {dm.metadata.communityName}
            </span>
          )}
        </div>
      </div>

      {/* Unread indicator */}
      {isNew && (
        <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-2" />
      )}
    </div>
  );
}

// ============================================================
// InboxPanel Component
// ============================================================

export default function InboxPanel({
  onSelectDM,
  selectedDMId = null,
  pollingEnabled = true,
}: InboxPanelProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<SortByOption>("timestamp");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const initialFilters: Partial<InboxFilters> = useMemo(
    () => ({
      sortBy: "timestamp",
      sortOrder: "desc",
      limit: 50,
      offset: 0,
    }),
    []
  );

  const {
    dms,
    loading,
    error,
    filters,
    setFilters,
    refreshInbox,
    stats,
    total,
    hasMore,
    loadMore,
  } = useInbox(initialFilters, pollingEnabled);

  // ----- Debounced Search -----

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchQuery(value);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        setFilters((prev) => ({
          ...prev,
          search: value.trim().length > 0 ? value.trim() : undefined,
          offset: 0,
        }));
      }, 300);
    },
    [setFilters]
  );

  // ----- Tab Filter -----

  const handleTabChange = useCallback(
    (tabValue: string | undefined) => {
      setActiveTab(tabValue);
      setFilters((prev) => ({
        ...prev,
        status: tabValue,
        offset: 0,
      }));
    },
    [setFilters]
  );

  // ----- Sort -----

  const handleSortChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newSortBy = e.target.value as SortByOption;
      setSortBy(newSortBy);
      setFilters((prev) => ({
        ...prev,
        sortBy: newSortBy,
        offset: 0,
      }));
    },
    [setFilters]
  );

  const handleToggleSortOrder = useCallback(() => {
    const newOrder = sortOrder === "desc" ? "asc" : "desc";
    setSortOrder(newOrder);
    setFilters((prev) => ({
      ...prev,
      sortOrder: newOrder,
      offset: 0,
    }));
  }, [sortOrder, setFilters]);

  // ----- DM Selection -----

  const handleSelectDM = useCallback(
    (dm: InboxDM) => {
      if (onSelectDM) {
        onSelectDM(dm);
      }
    },
    [onSelectDM]
  );

  // ----- Lazy Loading via IntersectionObserver -----

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      {
        root: listContainerRef.current,
        rootMargin: "100px",
        threshold: 0,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loading, loadMore]);

  // ----- Cleanup search timeout -----

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // ----- Determine if filters are active -----

  const hasActiveFilters =
    activeTab !== undefined ||
    (searchQuery.trim().length > 0);

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200">
        <div className="px-4 py-3">
          <h2 className="text-heading-4 text-gray-900">Inbox</h2>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search messages…"
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-body-sm text-gray-900 placeholder-gray-400 transition-colors duration-200 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              aria-label="Search inbox messages"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 px-4 pb-2 overflow-x-auto scrollbar-hidden">
          {FILTER_TABS.map((tab) => {
            const isActive = activeTab === tab.value;
            const count =
              tab.countKey !== null ? stats[tab.countKey] : 0;

            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => handleTabChange(tab.value)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-caption font-medium whitespace-nowrap transition-colors duration-150 ${
                  isActive
                    ? "bg-brand-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                aria-pressed={isActive}
              >
                {tab.label}
                {tab.countKey !== null && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[1.125rem] rounded-full px-1 text-2xs font-semibold ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center justify-between px-4 pb-2">
          <div className="flex items-center gap-2">
            <label htmlFor="inbox-sort" className="text-2xs text-gray-400">
              Sort by
            </label>
            <select
              id="inbox-sort"
              value={sortBy}
              onChange={handleSortChange}
              className="rounded border border-gray-200 bg-white py-0.5 pl-2 pr-6 text-caption text-gray-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleToggleSortOrder}
              className="inline-flex items-center justify-center rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors duration-150"
              aria-label={`Sort ${sortOrder === "desc" ? "ascending" : "descending"}`}
              title={sortOrder === "desc" ? "Sort ascending" : "Sort descending"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className={`w-4 h-4 transition-transform duration-200 ${
                  sortOrder === "asc" ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12"
                />
              </svg>
            </button>
          </div>
          <button
            type="button"
            onClick={refreshInbox}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-caption text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors duration-150 disabled:opacity-50"
            aria-label="Refresh inbox"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
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

      {/* Stats Summary */}
      <StatsSummary stats={stats} />

      {/* DM List */}
      <div
        ref={listContainerRef}
        className="flex-1 overflow-y-auto scrollbar-thin"
        role="listbox"
        aria-label="Direct messages"
      >
        {/* Error State */}
        {error && !loading && (
          <ErrorState message={error} onRetry={refreshInbox} />
        )}

        {/* Loading State (initial) */}
        {loading && dms.length === 0 && !error && (
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <InboxItemSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && dms.length === 0 && (
          <EmptyState hasFilters={hasActiveFilters} />
        )}

        {/* DM Items */}
        {dms.length > 0 &&
          dms.map((dm) => (
            <InboxItem
              key={dm.id}
              dm={dm}
              isSelected={selectedDMId === dm.id}
              onClick={handleSelectDM}
            />
          ))}

        {/* Lazy Loading Sentinel */}
        {hasMore && (
          <div ref={sentinelRef} className="py-4">
            {loading && dms.length > 0 && (
              <div className="flex items-center justify-center gap-2 text-caption text-gray-400">
                <svg
                  className="w-4 h-4 animate-spin"
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
                Loading more…
              </div>
            )}
          </div>
        )}

        {/* End of list indicator */}
        {!hasMore && dms.length > 0 && (
          <div className="py-3 text-center text-2xs text-gray-300">
            {total} message{total !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

export { InboxPanel };
export type { InboxPanelProps };