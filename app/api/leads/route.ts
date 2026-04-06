import { NextRequest, NextResponse } from "next/server";
import { listLeads, createLead } from "@/lib/services/lead-manager";
import { extractLead } from "@/lib/services/lead-extraction-service";
import auditLogger from "@/lib/services/audit-logger";

/**
 * GET /api/leads
 *
 * Returns a filtered list of leads.
 *
 * Query Parameters:
 *   - status: Filter by lead status (e.g., "new", "drafted", "sent", "escalated")
 *   - priority: Filter by priority (e.g., "high", "medium", "low")
 *   - platform: Filter by source platform (e.g., "facebook", "instagram")
 *   - slaBreached: Filter by SLA breach status ("true" or "false")
 *   - search: Full-text search across lead fields
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status") || undefined;
    const priority = searchParams.get("priority") || undefined;
    const platform = searchParams.get("platform") || undefined;
    const slaBreachedParam = searchParams.get("slaBreached");
    const search = searchParams.get("search") || undefined;

    let slaBreached: boolean | undefined;
    if (slaBreachedParam === "true") {
      slaBreached = true;
    } else if (slaBreachedParam === "false") {
      slaBreached = false;
    }

    const leads = await listLeads({
      status,
      priority,
      platform,
      slaBreached,
      search,
    });

    await auditLogger.logEvent(
      "API_LIST_LEADS",
      "system",
      "leads",
      JSON.stringify({
        filters: { status, priority, platform, slaBreached, search },
        resultCount: leads.length,
      })
    );

    return NextResponse.json(
      {
        success: true,
        data: leads,
        error: null,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error listing leads";

    await auditLogger.logEvent(
      "API_LIST_LEADS_ERROR",
      "system",
      "leads",
      JSON.stringify({ error: errorMessage })
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

/**
 * POST /api/leads
 *
 * Creates a new lead from extracted DM data or directly provided fields.
 *
 * Request Body:
 *   - dm_id (required): The source DM ID
 *   - extracted_data (optional): Pre-extracted lead fields
 *     - name: string
 *     - contact: string
 *     - budget: string
 *     - location: string
 *     - intent: string
 *     - confidence: number
 *   - source_platform (optional): The source platform identifier
 *
 * If extracted_data is not provided, the service will attempt to extract
 * lead fields from the DM content automatically.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    const dmId = body.dm_id || body.dmId;

    if (!dmId || typeof dmId !== "string" || dmId.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: "Missing required field: dm_id",
        },
        { status: 400 }
      );
    }

    let extractedFields = body.extracted_data || body.extractedData;

    if (!extractedFields) {
      try {
        extractedFields = await extractLead(dmId);
      } catch (extractError) {
        const extractErrorMessage =
          extractError instanceof Error
            ? extractError.message
            : "Failed to extract lead data from DM";

        await auditLogger.logEvent(
          "API_CREATE_LEAD_EXTRACTION_FAILED",
          "system",
          dmId,
          JSON.stringify({ error: extractErrorMessage })
        );

        return NextResponse.json(
          {
            success: false,
            data: null,
            error: extractErrorMessage,
          },
          { status: 400 }
        );
      }
    } else {
      // Normalize extracted_data to match ExtractedLeadFields interface
      extractedFields = {
        name: extractedFields.name || null,
        contact: extractedFields.contact || null,
        budget: extractedFields.budget || null,
        location: extractedFields.location || null,
        intent: extractedFields.intent || null,
        confidence:
          typeof extractedFields.confidence === "number"
            ? extractedFields.confidence
            : 0.5,
      };
    }

    const leadData = await createLead(extractedFields, dmId);

    await auditLogger.logEvent(
      "API_CREATE_LEAD",
      "system",
      leadData.id,
      JSON.stringify({
        leadId: leadData.id,
        dmId,
        status: leadData.status,
        priorityFlag: leadData.priorityFlag,
      })
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          lead_id: leadData.id,
          status: leadData.status,
          lead: leadData,
        },
        error: null,
      },
      { status: 201 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error creating lead";

    await auditLogger.logEvent(
      "API_CREATE_LEAD_ERROR",
      "system",
      "leads",
      JSON.stringify({ error: errorMessage })
    );

    // Check for compliance violations
    if (errorMessage.includes("Compliance violation")) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: errorMessage,
        },
        { status: 422 }
      );
    }

    // Check for not found errors
    if (errorMessage.includes("not found")) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: errorMessage,
        },
        { status: 404 }
      );
    }

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