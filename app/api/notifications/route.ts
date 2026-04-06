import { NextRequest, NextResponse } from "next/server";
import {
  getNotifications,
  markAsRead,
  getUnreadCount,
} from "@/lib/services/notification-service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const recipientId = searchParams.get("recipientId");

    if (!recipientId || recipientId.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: "Missing required query parameter: recipientId",
        },
        { status: 400 }
      );
    }

    const notifications = getNotifications(recipientId);
    const unreadCount = getUnreadCount(recipientId);

    return NextResponse.json(
      {
        success: true,
        data: {
          notifications,
          unreadCount,
          total: notifications.length,
        },
        error: null,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        data: null,
        error: `Failed to retrieve notifications: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { notificationId } = body as { notificationId?: string };

    if (!notificationId || notificationId.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: "Missing required field: notificationId",
        },
        { status: 400 }
      );
    }

    markAsRead(notificationId);

    return NextResponse.json(
      {
        success: true,
        data: {
          notificationId,
          status: "read",
        },
        error: null,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        data: null,
        error: `Failed to update notification: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}