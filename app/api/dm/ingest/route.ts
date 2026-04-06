import { NextRequest, NextResponse } from "next/server";
import { ingestDM } from "@/lib/services/dm-ingestion-service";
import type { DMIngestPayload } from "@/lib/services/dm-ingestion-service";
import auditLogger from "@/lib/services/audit-logger";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    const payload: DMIngestPayload = {
      platform: body.platform,
      message_id: body.message_id || body.messageId,
      sender_id: body.sender_id || body.senderId,
      sender_name: body.sender_name || body.senderName,
      sender_handle: body.sender_handle || body.senderHandle,
      sender_avatar_url: body.sender_avatar_url || body.senderAvatarUrl,
      timestamp: body.timestamp,
      content: body.content,
      metadata: body.metadata,
    };

    const result = await ingestDM(payload);

    await auditLogger.logEvent(
      "DM_INGEST_API_SUCCESS",
      "system",
      result.dm_id,
      JSON.stringify({
        dmId: result.dm_id,
        platform: payload.platform,
        senderId: payload.sender_id || payload.senderId || "unknown",
        status: result.status,
      })
    );

    return NextResponse.json(
      {
        status: result.status,
        dm_id: result.dm_id,
        dm: result.dm,
      },
      { status: 201 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error during DM ingestion";

    const isValidationError = errorMessage.startsWith("Validation failed:");

    await auditLogger.logEvent(
      "DM_INGEST_API_ERROR",
      "system",
      "n/a",
      JSON.stringify({
        error: errorMessage,
        isValidationError,
      })
    );

    if (isValidationError) {
      return NextResponse.json(
        {
          error: errorMessage,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error during DM ingestion",
      },
      { status: 500 }
    );
  }
}