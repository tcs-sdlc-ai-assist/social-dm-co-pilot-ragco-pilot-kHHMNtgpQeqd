import { dmStore, DMRecord } from "@/lib/stores/dm-store";
import { draftStore } from "@/lib/stores/draft-store";
import { leadStore, Lead } from "@/lib/stores/lead-store";
import { DraftResponse } from "@/lib/types";
import auditLogger from "@/lib/services/audit-logger";

// ============================================================
// Inbox Service — DM aggregation, filtering, and status management
// ============================================================

export interface InboxFilters {
  status?: string;
  platform?: string;
  priority?: string;
  intent?: string;
  communityName?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: "timestamp" | "priority" | "confidenceScore" | "slaDeadline";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

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

export interface InboxResult {
  items: InboxDM[];
  total: number;
  offset: number;
  limit: number;
}

const PRIORITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function isSLABreached(slaDeadline: string): boolean {
  const deadline = new Date(slaDeadline).getTime();
  const now = Date.now();
  return now > deadline;
}

function enrichDM(dm: DMRecord): InboxDM {
  const draft = draftStore.getByDmId(dm.id);
  const lead = leadStore.getByDmId(dm.id);

  return {
    ...dm,
    draft: draft ?? undefined,
    lead: lead ?? undefined,
    slaBreached: isSLABreached(dm.slaDeadline),
  };
}

function applyFilters(dms: DMRecord[], filters: InboxFilters): DMRecord[] {
  let results = [...dms];

  if (filters.status) {
    const status = filters.status.toLowerCase();
    results = results.filter((dm) => dm.status.toLowerCase() === status);
  }

  if (filters.platform) {
    const platform = filters.platform.toLowerCase();
    results = results.filter((dm) => dm.platform.toLowerCase() === platform);
  }

  if (filters.priority) {
    const priority = filters.priority.toLowerCase();
    results = results.filter((dm) => dm.priority.toLowerCase() === priority);
  }

  if (filters.intent) {
    const intent = filters.intent.toLowerCase();
    results = results.filter((dm) => dm.intent.toLowerCase() === intent);
  }

  if (filters.communityName) {
    const communityName = filters.communityName.toLowerCase();
    results = results.filter(
      (dm) =>
        dm.metadata.communityName !== null &&
        dm.metadata.communityName.toLowerCase() === communityName
    );
  }

  if (filters.startDate) {
    const startTime = new Date(filters.startDate).getTime();
    results = results.filter(
      (dm) => new Date(dm.timestamp).getTime() >= startTime
    );
  }

  if (filters.endDate) {
    const endTime = new Date(filters.endDate).getTime();
    results = results.filter(
      (dm) => new Date(dm.timestamp).getTime() <= endTime
    );
  }

  return results;
}

function applySorting(
  dms: DMRecord[],
  sortBy: InboxFilters["sortBy"],
  sortOrder: InboxFilters["sortOrder"]
): DMRecord[] {
  const order = sortOrder === "asc" ? 1 : -1;
  const field = sortBy || "timestamp";

  return [...dms].sort((a, b) => {
    switch (field) {
      case "timestamp":
        return (
          (new Date(a.timestamp).getTime() -
            new Date(b.timestamp).getTime()) *
          order
        );
      case "slaDeadline":
        return (
          (new Date(a.slaDeadline).getTime() -
            new Date(b.slaDeadline).getTime()) *
          order
        );
      case "confidenceScore":
        return (a.confidenceScore - b.confidenceScore) * order;
      case "priority": {
        const aPriority = PRIORITY_ORDER[a.priority.toLowerCase()] ?? 3;
        const bPriority = PRIORITY_ORDER[b.priority.toLowerCase()] ?? 3;
        return (aPriority - bPriority) * order;
      }
      default:
        return 0;
    }
  });
}

/**
 * Returns a filtered and sorted list of DMs with status tags,
 * enriched with associated draft and lead data.
 */
export async function getInbox(filters?: InboxFilters): Promise<InboxResult> {
  const allDMs = dmStore.getAll();

  let filtered = filters ? applyFilters(allDMs, filters) : allDMs;

  const sortBy = filters?.sortBy || "timestamp";
  const sortOrder = filters?.sortOrder || "desc";
  filtered = applySorting(filtered, sortBy, sortOrder);

  const total = filtered.length;
  const offset = filters?.offset ?? 0;
  const limit = filters?.limit ?? total;

  const paged = filtered.slice(offset, offset + limit);
  const items = paged.map(enrichDM);

  await auditLogger.logEvent(
    "INBOX_QUERY",
    "system",
    "inbox",
    JSON.stringify({
      filters: filters ?? {},
      totalResults: total,
      returnedResults: items.length,
    })
  );

  return {
    items,
    total,
    offset,
    limit,
  };
}

/**
 * Returns a single DM by ID, enriched with associated draft and lead data.
 * Returns null if the DM is not found.
 */
export async function getDMById(id: string): Promise<InboxDM | null> {
  const dm = dmStore.getById(id);

  if (!dm) {
    await auditLogger.logEvent(
      "INBOX_GET_DM",
      "system",
      id,
      JSON.stringify({ found: false })
    );
    return null;
  }

  const enriched = enrichDM(dm);

  await auditLogger.logEvent(
    "INBOX_GET_DM",
    "system",
    id,
    JSON.stringify({
      found: true,
      status: enriched.status,
      slaBreached: enriched.slaBreached,
      hasDraft: !!enriched.draft,
      hasLead: !!enriched.lead,
    })
  );

  return enriched;
}

/**
 * Updates the status of a DM and logs the change via the audit logger.
 * Returns the updated DM or null if not found.
 */
export async function updateDMStatus(
  id: string,
  status: string,
  actor: string = "system"
): Promise<InboxDM | null> {
  const existing = dmStore.getById(id);

  if (!existing) {
    await auditLogger.logEvent(
      "INBOX_UPDATE_STATUS",
      actor,
      id,
      JSON.stringify({ error: "DM not found", requestedStatus: status })
    );
    return null;
  }

  const previousStatus = existing.status;
  const updated = dmStore.updateStatus(id, status);

  if (!updated) {
    return null;
  }

  const enriched = enrichDM(updated);

  await auditLogger.logEvent(
    "INBOX_UPDATE_STATUS",
    actor,
    id,
    JSON.stringify({
      previousStatus,
      newStatus: status,
      slaBreached: enriched.slaBreached,
    })
  );

  return enriched;
}

/**
 * Returns aggregate counts of DMs by status, plus SLA breach and high priority counts.
 */
export async function getInboxStats(): Promise<InboxStats> {
  const allDMs = dmStore.getAll();

  const stats: InboxStats = {
    total: allDMs.length,
    new: 0,
    drafted: 0,
    sent: 0,
    escalated: 0,
    slaBreached: 0,
    highPriority: 0,
  };

  for (const dm of allDMs) {
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

    if (isSLABreached(dm.slaDeadline)) {
      stats.slaBreached++;
    }

    if (dm.priority.toLowerCase() === "high") {
      stats.highPriority++;
    }
  }

  await auditLogger.logEvent(
    "INBOX_STATS_QUERY",
    "system",
    "inbox",
    JSON.stringify(stats)
  );

  return stats;
}

/**
 * Full-text search across sender name, sender handle, content, and community name.
 * Returns enriched DMs sorted by timestamp descending.
 */
export async function searchInbox(query: string): Promise<InboxDM[]> {
  if (!query || query.trim().length === 0) {
    const allDMs = dmStore.getAll();
    const enriched = allDMs.map(enrichDM);

    await auditLogger.logEvent(
      "INBOX_SEARCH",
      "system",
      "inbox",
      JSON.stringify({ query: "", resultCount: enriched.length })
    );

    return enriched;
  }

  const results = dmStore.search(query);
  const enriched = results.map(enrichDM);

  await auditLogger.logEvent(
    "INBOX_SEARCH",
    "system",
    "inbox",
    JSON.stringify({ query, resultCount: enriched.length })
  );

  return enriched;
}