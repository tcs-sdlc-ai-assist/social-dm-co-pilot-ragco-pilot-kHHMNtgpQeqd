import { NextRequest, NextResponse } from "next/server";
import { extractLead } from "@/lib/services/lead-extraction-service";
import auditLogger from "@/lib/services/audit-logger";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    const { dmId } = body as { dmId?: string };

    if (!dmId || typeof dmId !== "string" || dmId.trim().length === 0) {
      await auditLogger.logEvent(
        "LEAD_EXTRACT_API_VALIDATION_ERROR",
        "system",
        "n/a",
        JSON.stringify({ error: "Missing or invalid dmId", receivedDmId: dmId ?? null })
      );

      return NextResponse.json(
        {
          success: false,
          data: null,
          error: "Missing required field: dmId",
        },
        { status: 400 }
      );
    }

    const trimmedDmId = dmId.trim();

    await auditLogger.logEvent(
      "LEAD_EXTRACT_API_REQUEST",
      "system",
      trimmedDmId,
      JSON.stringify({ dmId: trimmedDmId })
    );

    const extractedFields = await extractLead(trimmedDmId);

    await auditLogger.logEvent(
      "LEAD_EXTRACT_API_SUCCESS",
      "system",
      trimmedDmId,
      JSON.stringify({
        dmId: trimmedDmId,
        confidence: extractedFields.confidence,
        fieldsPresent: {
          name: extractedFields.name !== null,
          contact: extractedFields.contact !== null,
          budget: extractedFields.budget !== null,
          location: extractedFields.location !== null,
          intent: extractedFields.intent !== null,
        },
      })
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          dmId: trimmedDmId,
          fields: {
            name: extractedFields.name,
            contact: extractedFields.contact,
            budget: extractedFields.budget,
            location: extractedFields.location,
            intent: extractedFields.intent,
          },
          confidence: extractedFields.confidence,
          fieldConfidence: {
            name: extractedFields.name !== null ? 1.0 : 0.0,
            contact: extractedFields.contact !== null ? 1.0 : 0.0,
            budget: extractedFields.budget !== null ? 1.0 : 0.0,
            location: extractedFields.location !== null ? 1.0 : 0.0,
            intent: extractedFields.intent !== null ? 1.0 : 0.0,
          },
        },
        error: null,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error during lead extraction";

    const isDmNotFound = errorMessage.includes("DM not found");
    const isComplianceViolation = errorMessage.includes("Compliance violation");

    if (isDmNotFound) {
      await auditLogger.logEvent(
        "LEAD_EXTRACT_API_NOT_FOUND",
        "system",
        "n/a",
        JSON.stringify({ error: errorMessage })
      );

      return NextResponse.json(
        {
          success: false,
          data: null,
          error: errorMessage,
        },
        { status: 404 }
      );
    }

    if (isComplianceViolation) {
      await auditLogger.logEvent(
        "LEAD_EXTRACT_API_COMPLIANCE_ERROR",
        "system",
        "n/a",
        JSON.stringify({ error: errorMessage })
      );

      return NextResponse.json(
        {
          success: false,
          data: null,
          error: errorMessage,
        },
        { status: 403 }
      );
    }

    await auditLogger.logEvent(
      "LEAD_EXTRACT_API_ERROR",
      "system",
      "n/a",
      JSON.stringify({ error: errorMessage })
    );

    return NextResponse.json(
      {
        success: false,
        data: null,
        error: `Lead extraction failed: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}