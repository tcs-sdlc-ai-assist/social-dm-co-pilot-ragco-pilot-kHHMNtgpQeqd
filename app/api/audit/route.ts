import { NextRequest, NextResponse } from "next/server";
import auditLogger from "@/lib/services/audit-logger";
import type { AuditLogFilters } from "@/lib/services/audit-logger";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const filters: AuditLogFilters = {};

    const action = searchParams.get("action");
    if (action && action.trim().length > 0) {
      filters.action = action.trim();
    }

    const actor = searchParams.get("actor");
    if (actor && actor.trim().length > 0) {
      filters.actor = actor.trim();
    }

    const entityRef = searchParams.get("entityRef");
    if (entityRef && entityRef.trim().length > 0) {
      filters.entityRef = entityRef.trim();
    }

    const startDate = searchParams.get("startDate");
    if (startDate && startDate.trim().length > 0) {
      const parsed = new Date(startDate.trim());
      if (!isNaN(parsed.getTime())) {
        filters.startDate = startDate.trim();
      } else {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: "Invalid startDate format. Must be a valid ISO8601 date string.",
          },
          { status: 400 }
        );
      }
    }

    const endDate = searchParams.get("endDate");
    if (endDate && endDate.trim().length > 0) {
      const parsed = new Date(endDate.trim());
      if (!isNaN(parsed.getTime())) {
        filters.endDate = endDate.trim();
      } else {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: "Invalid endDate format. Must be a valid ISO8601 date string.",
          },
          { status: 400 }
        );
      }
    }

    const hasFilters = Object.keys(filters).length > 0;
    const entries = await auditLogger.getAuditLogs(hasFilters ? filters : undefined);

    return NextResponse.json(
      {
        success: true,
        data: entries,
        error: null,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error retrieving audit logs";

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