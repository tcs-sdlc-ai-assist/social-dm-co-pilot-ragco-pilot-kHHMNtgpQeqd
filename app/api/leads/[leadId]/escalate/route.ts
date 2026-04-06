import { NextRequest, NextResponse } from "next/server";
import { evaluateAndEscalate } from "@/lib/services/escalation-service";
import { escalateLead } from "@/lib/services/lead-manager";
import { triggerHighPriorityAlert } from "@/lib/services/notification-service";
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
    let reason: string | undefined;

    try {
      const body = await request.json();
      if (body && typeof body.reason === "string" && body.reason.trim().length > 0) {
        reason = body.reason.trim();
      }
    } catch {
      // Body is optional; proceed without reason
    }

    // Evaluate escalation rules via escalation service
    const escalationResult = await evaluateAndEscalate(leadId);

    // If the rule-based evaluation did not escalate, but a manual reason was provided,
    // perform a manual escalation via lead manager
    if (!escalationResult.escalated && reason) {
      const manualEscalation = await escalateLead(leadId, reason);

      if (!manualEscalation) {
        return NextResponse.json(
          { error: "Lead not found" },
          { status: 404 }
        );
      }

      // Trigger notification to Sales Consultant
      const notification = triggerHighPriorityAlert(
        leadId,
        "sales-consultant-default"
      );

      await auditLogger.logEvent(
        "LEAD_MANUAL_ESCALATION",
        "api",
        leadId,
        JSON.stringify({
          leadId,
          reason,
          escalatedAt: manualEscalation.escalatedAt,
          notificationId: notification.id,
        })
      );

      return NextResponse.json(
        {
          lead_id: leadId,
          escalated: true,
          reason,
          status: "escalated",
          escalated_at: manualEscalation.escalatedAt || new Date().toISOString(),
          notification_id: notification.id,
        },
        { status: 200 }
      );
    }

    // If already escalated (status was already escalated before evaluation)
    if (!escalationResult.escalated && !reason) {
      await auditLogger.logEvent(
        "LEAD_ESCALATION_NOT_REQUIRED",
        "api",
        leadId,
        JSON.stringify({
          leadId,
          escalated: false,
          reason: "No escalation criteria met and no manual reason provided",
        })
      );

      return NextResponse.json(
        {
          lead_id: leadId,
          escalated: false,
          reason: null,
          status: "not_escalated",
          escalated_at: null,
          notification_id: null,
        },
        { status: 200 }
      );
    }

    // Rule-based escalation succeeded — trigger notification if not already done
    if (escalationResult.escalated && !escalationResult.notificationId) {
      const notification = triggerHighPriorityAlert(
        leadId,
        "sales-consultant-default"
      );
      escalationResult.notificationId = notification.id;
    }

    await auditLogger.logEvent(
      "LEAD_ESCALATION_API",
      "api",
      leadId,
      JSON.stringify({
        leadId,
        escalated: escalationResult.escalated,
        reason: escalationResult.reason,
        escalatedAt: escalationResult.escalatedAt,
        notificationId: escalationResult.notificationId,
      })
    );

    return NextResponse.json(
      {
        lead_id: escalationResult.leadId,
        escalated: escalationResult.escalated,
        reason: escalationResult.reason,
        status: "escalated",
        escalated_at: escalationResult.escalatedAt,
        notification_id: escalationResult.notificationId,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Handle "Lead not found" errors
    if (errorMessage.includes("not found")) {
      await auditLogger.logEvent(
        "LEAD_ESCALATION_NOT_FOUND",
        "api",
        leadId,
        JSON.stringify({ leadId, error: errorMessage })
      );

      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    // Handle "already escalated" errors
    if (errorMessage.includes("already escalated")) {
      await auditLogger.logEvent(
        "LEAD_ESCALATION_CONFLICT",
        "api",
        leadId,
        JSON.stringify({ leadId, error: errorMessage })
      );

      return NextResponse.json(
        { error: "Lead already escalated" },
        { status: 409 }
      );
    }

    await auditLogger.logEvent(
      "LEAD_ESCALATION_ERROR",
      "api",
      leadId,
      JSON.stringify({ leadId, error: errorMessage })
    );

    return NextResponse.json(
      { error: `Escalation failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}