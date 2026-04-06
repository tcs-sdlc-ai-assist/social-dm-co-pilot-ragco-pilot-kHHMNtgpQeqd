import { useState, useEffect, useCallback, useRef } from "react";
import type { DMRecord } from "@/lib/stores/dm-store";
import type { DraftResponse } from "@/lib/types";
import type { Lead } from "@/lib/stores/lead-store";
import { POLLING_INTERVAL_MS, API_ROUTES } from "@/lib/constants";

// ============================================================
// useInbox — Custom hook for inbox data fetching & state management
// ============================================================

export interface InboxDM extends DMRecord {
  draft?: DraftResponse | undefined;
  lead?: Lead | undefined;
  slaBreached: boolean;
}

export interface InboxStats {
  total: number;
  new: number;
  drafted: number;
  sent: number;
  escalated: number;
  slaBreached: number;
  highPriority: number;
}

export interface InboxFilters {
  status?: string;
  platform?: string;
  priority?: string;
  intent?: string;
  communityName?: string;
  search?: string;
  sortBy?: "timestamp" | "priority" | "confidenceScore" | "slaDeadline";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface UseInboxResult {
  dms: InboxDM[];
  loading: boolean;
  error: string | null;
  filters: InboxFilters;
  setFilters: (filters: InboxFilters | ((prev: InboxFilters) => InboxFilters)) => void;
  refreshInbox: () => Promise<void>;
  stats: InboxStats;
  total: number;
  hasMore: boolean;
  loadMore: () => void;
}

const DEFAULT_FILTERS: InboxFilters = {
  sortBy: "timestamp",
  sortOrder: "desc",
  limit: 50,
  offset: 0,
};

const DEFAULT_STATS: InboxStats = {
  total: 0,
  new: 0,
  drafted: 0,
  sent: 0,
  escalated: 0,
  slaBreached: 0,
  highPriority: 0,
};

function buildQueryString(filters: InboxFilters): string {
  const params = new URLSearchParams();

  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.platform) {
    params.set("platform", filters.platform);
  }
  if (filters.priority) {
    params.set("priority", filters.priority);
  }
  if (filters.intent) {
    params.set("intent", filters.intent);
  }
  if (filters.communityName) {
    params.set("communityName", filters.communityName);
  }
  if (filters.search) {
    params.set("search", filters.search);
  }
  if (filters.sortBy) {
    params.set("sortBy", filters.sortBy);
  }
  if (filters.sortOrder) {
    params.set("sortOrder", filters.sortOrder);
  }
  if (filters.limit !== undefined) {
    params.set("limit", String(filters.limit));
  }
  if (filters.offset !== undefined) {
    params.set("offset", String(filters.offset));
  }

  const qs = params.toString();
  return qs.length > 0 ? `?${qs}` : "";
}

function computeStats(dms: InboxDM[]): InboxStats {
  const stats: InboxStats = {
    total: dms.length,
    new: 0,
    drafted: 0,
    sent: 0,
    escalated: 0,
    slaBreached: 0,
    highPriority: 0,
  };

  for (const dm of dms) {
    const statusKey = dm.status.toLowerCase();
    if (statusKey === "new") {
      stats.new++;
    } else if (statusKey === "drafted") {
      stats.drafted++;
    } else if (statusKey === "sent") {
      stats.sent++;
    } else if (statusKey === "escalated") {
      stats.escalated++;
    }

    if (dm.slaBreached) {
      stats.slaBreached++;
    }

    if (dm.priority.toLowerCase() === "high") {
      stats.highPriority++;
    }
  }

  return stats;
}

/**
 * Custom React hook for inbox data management.
 *
 * Provides DM list, loading/error states, filters, stats, and
 * auto-polling at the configured interval.
 *
 * @param initialFilters - Optional initial filter values
 * @param pollingEnabled - Whether to enable auto-polling (default: true)
 * @returns UseInboxResult with DMs, stats, filters, and control functions
 */
export function useInbox(
  initialFilters?: Partial<InboxFilters>,
  pollingEnabled: boolean = true
): UseInboxResult {
  const [dms, setDms] = useState<InboxDM[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<InboxFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  });
  const [stats, setStats] = useState<InboxStats>(DEFAULT_STATS);
  const [total, setTotal] = useState<number>(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const fetchInbox = useCallback(
    async (currentFilters: InboxFilters, isPolling: boolean = false): Promise<void> => {
      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (!isPolling) {
        setLoading(true);
      }
      setError(null);

      try {
        const queryString = buildQueryString(currentFilters);
        const url = `${API_ROUTES.CONVERSATIONS}${queryString}`;

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });

        if (!isMountedRef.current) {
          return;
        }

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "Unknown error");
          throw new Error(
            `Failed to fetch inbox: ${response.status} ${errorBody}`
          );
        }

        const data = await response.json();

        if (!isMountedRef.current) {
          return;
        }

        // Handle both array response and paginated response shapes
        let items: InboxDM[];
        let totalCount: number;

        if (Array.isArray(data)) {
          items = data;
          totalCount = data.length;
        } else if (data && Array.isArray(data.items)) {
          items = data.items;
          totalCount = data.total ?? data.items.length;
        } else if (data && data.data && Array.isArray(data.data)) {
          items = data.data;
          totalCount = data.total ?? data.data.length;
        } else {
          items = [];
          totalCount = 0;
        }

        // Ensure slaBreached is computed for each DM
        const enrichedItems: InboxDM[] = items.map((dm) => ({
          ...dm,
          slaBreached:
            dm.slaBreached !== undefined
              ? dm.slaBreached
              : new Date(dm.slaDeadline).getTime() < Date.now(),
        }));

        setDms(enrichedItems);
        setTotal(totalCount);
        setStats(computeStats(enrichedItems));
      } catch (err: unknown) {
        if (!isMountedRef.current) {
          return;
        }

        // Ignore abort errors
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : "An unexpected error occurred";
        setError(errorMessage);
      } finally {
        if (isMountedRef.current && !isPolling) {
          setLoading(false);
        }
      }
    },
    []
  );

  const refreshInbox = useCallback(async (): Promise<void> => {
    await fetchInbox(filters, false);
  }, [fetchInbox, filters]);

  const loadMore = useCallback((): void => {
    setFilters((prev) => ({
      ...prev,
      offset: (prev.offset ?? 0) + (prev.limit ?? 50),
    }));
  }, []);

  const hasMore = total > (filters.offset ?? 0) + dms.length;

  // Fetch on mount and when filters change
  useEffect(() => {
    isMountedRef.current = true;

    fetchInbox(filters, false);

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [filters, fetchInbox]);

  // Polling
  useEffect(() => {
    if (!pollingEnabled) {
      return;
    }

    pollingTimerRef.current = setInterval(() => {
      if (isMountedRef.current) {
        fetchInbox(filters, true);
      }
    }, POLLING_INTERVAL_MS);

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [pollingEnabled, filters, fetchInbox]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
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
  };
}

export default useInbox;