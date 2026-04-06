import { NextRequest, NextResponse } from "next/server";
import {
  getInbox,
  getInboxStats,
  searchInbox,
  type InboxFilters,
} from "@/lib/services/inbox-service";
import auditLogger from "@/lib/services/audit-logger";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status") || undefined;
    const platform = searchParams.get("platform") || undefined;
    const priority = searchParams.get("priority") || undefined;
    const intent = searchParams.get("intent") || undefined;
    const communityName = searchParams.get("communityName") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const search = searchParams.get("search") || undefined;
    const sortBy = searchParams.get("sortBy") as InboxFilters["sortBy"] || undefined;
    const sortOrder = searchParams.get("sortOrder") as InboxFilters["sortOrder"] || undefined;

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
    const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 20)) : 20;
    const offset = (page - 1) * limit;

    // Validate status if provided
    if (status) {
      const validStatuses = ["new", "drafted", "sent", "escalated"];
      if (!validStatuses.includes(status.toLowerCase())) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: `Invalid status: ${status}. Must be one of: ${validStatuses.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Validate platform if provided
    if (platform) {
      const validPlatforms = ["facebook", "instagram"];
      if (!validPlatforms.includes(platform.toLowerCase())) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: `Invalid platform: ${platform}. Must be one of: ${validPlatforms.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Validate priority if provided
    if (priority) {
      const validPriorities = ["high", "medium", "low"];
      if (!validPriorities.includes(priority.toLowerCase())) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: `Invalid priority: ${priority}. Must be one of: ${validPriorities.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Validate sortBy if provided
    if (sortBy) {
      const validSortFields = ["timestamp", "priority", "confidenceScore", "slaDeadline"];
      if (!validSortFields.includes(sortBy)) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: `Invalid sortBy: ${sortBy}. Must be one of: ${validSortFields.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Validate sortOrder if provided
    if (sortOrder) {
      const validSortOrders = ["asc", "desc"];
      if (!validSortOrders.includes(sortOrder)) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: `Invalid sortOrder: ${sortOrder}. Must be one of: ${validSortOrders.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Validate date params if provided
    if (startDate) {
      const parsed = new Date(startDate);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: "Invalid startDate format. Must be ISO8601.",
          },
          { status: 400 }
        );
      }
    }

    if (endDate) {
      const parsed = new Date(endDate);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: "Invalid endDate format. Must be ISO8601.",
          },
          { status: 400 }
        );
      }
    }

    // If search query is provided, use searchInbox for full-text search
    // then apply pagination manually
    if (search && search.trim().length > 0) {
      const searchResults = await searchInbox(search);

      const total = searchResults.length;
      const paged = searchResults.slice(offset, offset + limit);
      const totalPages = Math.ceil(total / limit);

      const stats = await getInboxStats();

      return NextResponse.json(
        {
          success: true,
          data: {
            items: paged,
            total,
            page,
            limit,
            totalPages,
            stats,
          },
          error: null,
        },
        { status: 200 }
      );
    }

    // Build filters for inbox query
    const filters: InboxFilters = {
      status: status?.toLowerCase(),
      platform: platform?.toLowerCase(),
      priority: priority?.toLowerCase(),
      intent: intent?.toLowerCase(),
      communityName,
      startDate,
      endDate,
      sortBy,
      sortOrder: sortOrder || "desc",
      limit,
      offset,
    };

    const inboxResult = await getInbox(filters);
    const stats = await getInboxStats();

    const totalPages = Math.ceil(inboxResult.total / limit);

    return NextResponse.json(
      {
        success: true,
        data: {
          items: inboxResult.items,
          total: inboxResult.total,
          page,
          limit,
          totalPages,
          stats,
        },
        error: null,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";

    await auditLogger.logEvent(
      "INBOX_API_ERROR",
      "system",
      "inbox",
      JSON.stringify({
        error: errorMessage,
        method: "GET",
        path: "/api/dm/inbox",
      })
    );

    return NextResponse.json(
      {
        success: false,
        data: null,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}