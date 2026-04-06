import { NextResponse } from "next/server";
import { checkSLABreaches } from "@/lib/services/escalation-service";
import auditLogger from "@/lib/services/audit-logger";

export async function POST() {
  try {
    const breaches = await checkSLABreaches();

    await auditLogger.logEvent(
      "SLA_CHECK_API_CALLED",
      "system",
      "sla-check",
      JSON.stringify({
        breachCount: breaches.length,
        breachedDMIds: breaches.map((b) => b.dmId),
      })
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          breachCount: breaches.length,
          breaches: breaches.map((b) => ({
            dmId: b.dmId,
            senderName: b.senderName,
            platform: b.platform,
            slaDeadline: b.slaDeadline,
            breachedAt: b.breachedAt,
            notificationId: b.notificationId,
          })),
        },
        error: null,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error during SLA check";

    await auditLogger.logEvent(
      "SLA_CHECK_API_ERROR",
      "system",
      "sla-check",
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