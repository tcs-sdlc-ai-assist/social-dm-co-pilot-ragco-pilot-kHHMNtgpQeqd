import { NextRequest, NextResponse } from "next/server";
import { generateDraft } from "@/lib/services/draft-generation-service";
import auditLogger from "@/lib/services/audit-logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const dmId = body.dmId || body.dm_id;

    if (!dmId || typeof dmId !== "string" || dmId.trim().length === 0) {
      await auditLogger.logEvent(
        "DRAFT_GENERATION_REQUEST_INVALID",
        "system",
        "n/a",
        JSON.stringify({
          error: "Missing required field: dmId",
          receivedKeys: Object.keys(body),
        })
      );

      return NextResponse.json(
        { success: false, data: null, error: "Missing required field: dmId" },
        { status: 400 }
      );
    }

    await auditLogger.logEvent(
      "DRAFT_GENERATION_REQUEST",
      "system",
      dmId,
      JSON.stringify({ dmId })
    );

    const result = await generateDraft(dmId);

    await auditLogger.logEvent(
      "DRAFT_GENERATION_SUCCESS",
      "system",
      dmId,
      JSON.stringify({
        draftId: result.draft.id,
        dmId: result.draft.dmId,
        confidence: result.draft.confidence,
        contextEntries: result.context.length,
      })
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          draft_id: result.draft.id,
          dm_id: result.draft.dmId,
          draft_text: result.draft.content,
          confidence: result.draft.confidence,
          context: result.context.map((entry) => ({
            id: entry.id,
            category: entry.category,
            question: entry.question,
            answer: entry.answer,
            relevanceScore: entry.relevanceScore,
            propertyInfo: entry.propertyInfo,
          })),
          reviewed_by: result.draft.reviewedBy,
          approved: result.draft.approved,
          edited_content: result.draft.editedContent,
        },
        error: null,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error during draft generation";

    const isDMNotFound = errorMessage.includes("DM not found");
    const isAlreadyApproved = errorMessage.includes("already been approved");

    const statusCode = isDMNotFound ? 404 : isAlreadyApproved ? 409 : 500;

    await auditLogger.logEvent(
      "DRAFT_GENERATION_ERROR",
      "system",
      "n/a",
      JSON.stringify({
        error: errorMessage,
        statusCode,
      })
    );

    return NextResponse.json(
      {
        success: false,
        data: null,
        error: errorMessage,
      },
      { status: statusCode }
    );
  }
}