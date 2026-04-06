import { NextRequest, NextResponse } from "next/server";
import { getLead, updateLead } from "@/lib/services/lead-manager";
import type { LeadUpdatePayload } from "@/lib/services/lead-manager";
import auditLogger from "@/lib/services/audit-logger";

// ============================================================
// GET /api/leads/[leadId] — Retrieve lead details by ID
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { leadId: string } }
): Promise<NextResponse> {
  const { leadId } = params;

  if (!leadId || leadId.trim().length === 0) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: "Lead ID is required",
      },
      { status: 400 }
    );
  }

  try {
    const lead = await getLead(leadId);

    if (!lead) {
      await auditLogger.logEvent(
        "API_GET_LEAD_NOT_FOUND",
        "system",
        leadId,
        JSON.stringify({ leadId })
      );

      return NextResponse.json(
        {
          success: false,
          data: null,
          error: "Lead not found",
        },
        { status: 404 }
      );
    }

    await auditLogger.logEvent(
      "API_GET_LEAD",
      "system",
      leadId,
      JSON.stringify({
        leadId,
        status: lead.status,
        priority: lead.priority,
      })
    );

    return NextResponse.json(
      {
        success: true,
        data: lead,
        error: null,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error retrieving lead";

    await auditLogger.logEvent(
      "API_GET_LEAD_ERROR",
      "system",
      leadId,
      JSON.stringify({ leadId, error: errorMessage })
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

// ============================================================
// PATCH /api/leads/[leadId] — Update lead fields
// ============================================================

const ALLOWED_UPDATE_FIELDS: readonly string[] = [
  "name",
  "email",
  "company",
  "budget",
  "budgetCurrency",
  "location",
  "intent",
  "priority",
  "status",
  "tags",
  "notes",
  "confirmedBy",
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: { leadId: string } }
): Promise<NextResponse> {
  const { leadId } = params;

  if (!leadId || leadId.trim().length === 0) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: "Lead ID is required",
      },
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: "Invalid JSON in request body",
      },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: "Request body must be a JSON object",
      },
      { status: 400 }
    );
  }

  // Filter to only allowed fields
  const updates: LeadUpdatePayload = {};
  const receivedFields: string[] = [];

  for (const key of Object.keys(body)) {
    if (ALLOWED_UPDATE_FIELDS.includes(key)) {
      receivedFields.push(key);
      (updates as Record<string, unknown>)[key] = body[key];
    }
  }

  if (receivedFields.length === 0) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: "No valid update fields provided. Allowed fields: " + ALLOWED_UPDATE_FIELDS.join(", "),
      },
      { status: 400 }
    );
  }

  // Validate specific field types
  if (updates.budget !== undefined && typeof updates.budget !== "number") {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: "Field 'budget' must be a number",
      },
      { status: 400 }
    );
  }

  if (updates.priority !== undefined) {
    const validPriorities = ["high", "medium", "low"];
    if (typeof updates.priority !== "string" || !validPriorities.includes(updates.priority)) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: "Field 'priority' must be one of: high, medium, low",
        },
        { status: 400 }
      );
    }
  }

  if (updates.status !== undefined) {
    const validStatuses = ["new", "drafted", "sent", "escalated"];
    if (typeof updates.status !== "string" || !validStatuses.includes(updates.status)) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: "Field 'status' must be one of: new, drafted, sent, escalated",
        },
        { status: 400 }
      );
    }
  }

  if (updates.tags !== undefined && !Array.isArray(updates.tags)) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: "Field 'tags' must be an array of strings",
      },
      { status: 400 }
    );
  }

  try {
    const updatedLead = await updateLead(leadId, updates);

    if (!updatedLead) {
      await auditLogger.logEvent(
        "API_PATCH_LEAD_NOT_FOUND",
        updates.confirmedBy || "system",
        leadId,
        JSON.stringify({ leadId, updatedFields: receivedFields })
      );

      return NextResponse.json(
        {
          success: false,
          data: null,
          error: "Lead not found",
        },
        { status: 404 }
      );
    }

    await auditLogger.logEvent(
      "API_PATCH_LEAD",
      updates.confirmedBy || "system",
      leadId,
      JSON.stringify({
        leadId,
        updatedFields: receivedFields,
        newStatus: updatedLead.status,
        newPriority: updatedLead.priority,
      })
    );

    return NextResponse.json(
      {
        success: true,
        data: updatedLead,
        error: null,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error updating lead";

    await auditLogger.logEvent(
      "API_PATCH_LEAD_ERROR",
      updates.confirmedBy || "system",
      leadId,
      JSON.stringify({ leadId, error: errorMessage })
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