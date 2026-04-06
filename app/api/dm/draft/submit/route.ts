import { NextRequest, NextResponse } from "next/server";
import { submitDraft } from "@/lib/services/draft-generation-service";
import auditLogger from "@/lib/services/audit-logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { draftId, reviewerId, editedContent } = body as {
      draftId?: string;
      reviewerId?: string;
      editedContent?: string;
    };

    // Validate required fields
    if (!draftId || typeof draftId !== "string" || draftId.trim().length === 0) {
      return NextResponse.json(
        { success: false, data: null, error: "Missing required field: draftId" },
        { status: 400 }
      );
    }

    if (!reviewerId || typeof reviewerId !== "string" || reviewerId.trim().length === 0) {
      return NextResponse.json(
        { success: false, data: null, error: "Missing required field: reviewerId" },
        { status: 400 }
      );
    }

    if (editedContent !== undefined && typeof editedContent !== "string") {
      return NextResponse.json(
        { success: false, data: null, error: "editedContent must be a string if provided" },
        { status: 400 }
      );
    }

    const result = await submitDraft(
      draftId.trim(),
      reviewerId.trim(),
      editedContent?.trim() || undefined
    );

    await auditLogger.logEvent(
      "DRAFT_SUBMIT_API",
      reviewerId.trim(),
      draftId.trim(),
      JSON.stringify({
        draftId: result.draft.id,
        dmId: result.dmId,
        sentAt: result.sentAt,
        hasEdits: !!editedContent,
      })
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          status: "submitted",
          draftId: result.draft.id,
          dmId: result.dmId,
          sentAt: result.sentAt,
          draft: {
            id: result.draft.id,
            dmId: result.draft.dmId,
            content: result.draft.content,
            confidence: result.draft.confidence,
            reviewedBy: result.draft.reviewedBy,
            approved: result.draft.approved,
            editedContent: result.draft.editedContent,
          },
        },
        error: null,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Check if this is a compliance violation
    if (errorMessage.startsWith("Compliance violations:")) {
      await auditLogger.logEvent(
        "DRAFT_SUBMIT_API_COMPLIANCE_REJECTED",
        "system",
        "unknown",
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

    // Check for not found errors
    if (
      errorMessage.includes("not found") ||
      errorMessage.includes("Not found")
    ) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: errorMessage,
        },
        { status: 404 }
      );
    }

    await auditLogger.logEvent(
      "DRAFT_SUBMIT_API_ERROR",
      "system",
      "unknown",
      JSON.stringify({ error: errorMessage })
    );

    return NextResponse.json(
      {
        success: false,
        data: null,
        error: `Failed to submit draft: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}