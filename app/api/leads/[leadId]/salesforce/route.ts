import { NextRequest, NextResponse } from "next/server";
import { createLeadInSalesforce } from "@/lib/services/lead-manager";
import auditLogger from "@/lib/services/audit-logger";

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const { leadId } = params;

  if (!leadId || leadId.trim().length === 0) {
    return NextResponse.json(
      { error: "Lead ID is required" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const confirmedBy = (body as { confirmed_by?: string }).confirmed_by || undefined;

    await auditLogger.logEvent(
      "SALESFORCE_API_REQUEST",
      confirmedBy || "anonymous",
      leadId,
      JSON.stringify({
        leadId,
        confirmedBy: confirmedBy || null,
        endpoint: "POST /api/leads/[leadId]/salesforce",
      })
    );

    const result = await createLeadInSalesforce(leadId, confirmedBy);

    if (!result.success) {
      const statusCode = result.error?.includes("not found") ? 404 : 502;

      await auditLogger.logEvent(
        "SALESFORCE_API_ERROR",
        confirmedBy || "anonymous",
        leadId,
        JSON.stringify({
          leadId,
          error: result.error,
          statusCode,
        })
      );

      return NextResponse.json(
        { error: result.error },
        { status: statusCode }
      );
    }

    await auditLogger.logEvent(
      "SALESFORCE_API_SUCCESS",
      confirmedBy || "anonymous",
      leadId,
      JSON.stringify({
        leadId,
        salesforceStatus: result.data?.salesforceStatus,
      })
    );

    return NextResponse.json(
      {
        lead_id: result.data?.leadId,
        salesforce_status: result.data?.salesforceStatus,
      },
      { status: 202 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await auditLogger.logEvent(
      "SALESFORCE_API_UNHANDLED_ERROR",
      "system",
      leadId,
      JSON.stringify({
        leadId,
        error: errorMessage,
      })
    );

    return NextResponse.json(
      { error: `Salesforce integration error: ${errorMessage}` },
      { status: 500 }
    );
  }
}