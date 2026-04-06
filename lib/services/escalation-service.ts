import { v4 as uuidv4 } from "uuid";
import { leadStore } from "@/lib/stores/lead-store";
import { dmStore } from "@/lib/stores/dm-store";
import { notificationStore } from "@/lib/stores/notification-store";
import { NotificationType } from "@/lib/types";
import type { Notification, AuditLogEntry } from "@/lib/types";
import {
  HIGH_PRIORITY_THRESHOLD,
  SLA_BREACH_THRESHOLD_MS,
} from "@/lib/constants";
import auditLogger from "@/lib/services/audit-logger";

// ============================================================
// Escalation Service
// Lead escalation and SLA breach detection service.
// Evaluates lead priority based on intent and engagement signals.
// No demographic scoring per NFR-004 (bias mitigation).
// ============================================================

// ----- Types -----

export interface EscalationResult {
  leadId: string;
  escalated: boolean;
  reason: string | null;
  escalatedAt: string | null;
  notificationId: string | null;
}

export interface SLABreachResult {
  dmId: string;
  senderName: string;
  platform: string;
  slaDeadline: string;
  breachedAt: string;
  notificationId: string;
}

export interface EscalationHistoryEntry {
  id: string;
  leadId: string;
  action: string;
  reason: string;
  timestamp: string;
  actor: string;
}

// ----- Intent Keywords for Escalation -----

const HIGH_INTENT_KEYWORDS: string[] = [
  "urgent",
  "asap",
  "immediately",
  "today",
  "ready to buy",
  "ready to purchase",
  "deposit",
  "contract",
  "sign",
  "settlement",
  "finance approved",
  "pre-approved",
  "pre-approval",
  "book",
  "inspection",
  "visit",
  "appointment",
];

const BUDGET_THRESHOLD = 1000000;

// ----- Internal Helpers -----

/**
 * Evaluates whether a lead should be escalated based on intent,
 * engagement signals, confidence score, and budget.
 * Does NOT use any demographic fields (age, gender, ethnicity, etc.)
 * per NFR-004 bias mitigation requirements.
 */
function shouldEscalate(lead: {
  intent: string;
  confidenceScore: number;
  budget: number;
  messageCount: number;
  priority: string;
  status: string;
  slaBreached: boolean;
  priorityFlag?: boolean;
}): { shouldEscalate: boolean; reason: string | null } {
  // Already escalated — skip
  if (lead.status === "escalated") {
    return { shouldEscalate: false, reason: null };
  }

  // Manual flag by officer
  if (lead.priorityFlag && lead.status !== "escalated") {
    return {
      shouldEscalate: true,
      reason: "Manually flagged as high priority by officer",
    };
  }

  // SLA breach
  if (lead.slaBreached) {
    return {
      shouldEscalate: true,
      reason: "SLA breach detected — response time exceeded threshold",
    };
  }

  // High intent keyword detection
  const intentLower = (lead.intent || "").toLowerCase();
  for (const keyword of HIGH_INTENT_KEYWORDS) {
    if (intentLower.includes(keyword)) {
      return {
        shouldEscalate: true,
        reason: `High intent detected: "${keyword}" found in lead intent`,
      };
    }
  }

  // High confidence score
  if (lead.confidenceScore >= HIGH_PRIORITY_THRESHOLD) {
    return {
      shouldEscalate: true,
      reason: `High confidence score (${lead.confidenceScore.toFixed(2)}) exceeds threshold (${HIGH_PRIORITY_THRESHOLD})`,
    };
  }

  // High budget
  if (lead.budget && lead.budget > BUDGET_THRESHOLD) {
    return {
      shouldEscalate: true,
      reason: `High budget ($${lead.budget.toLocaleString()}) exceeds threshold ($${BUDGET_THRESHOLD.toLocaleString()})`,
    };
  }

  // High engagement (message count)
  if (lead.messageCount >= 10) {
    return {
      shouldEscalate: true,
      reason: `High engagement: ${lead.messageCount} messages exchanged`,
    };
  }

  return { shouldEscalate: false, reason: null };
}

/**
 * Creates an escalation notification for the assigned Sales Consultant.
 */
function createEscalationNotification(
  leadId: string,
  leadName: string,
  reason: string,
  recipientId: string = "sales-consultant-default"
): Notification {
  const notification: Notification = {
    id: uuidv4(),
    leadId,
    recipientId,
    type: NotificationType.ESCALATION,
    timestamp: new Date().toISOString(),
    status: "unread",
    message: `Lead "${leadName}" has been escalated. Reason: ${reason}`,
  };

  notificationStore.add(notification);
  return notification;
}

/**
 * Creates an SLA breach notification.
 */
function createSLABreachNotification(
  leadId: string,
  senderName: string,
  platform: string,
  recipientId: string = "sales-consultant-default"
): Notification {
  const notification: Notification = {
    id: uuidv4(),
    leadId,
    recipientId,
    type: NotificationType.SLA_BREACH,
    timestamp: new Date().toISOString(),
    status: "unread",
    message: `SLA breach: No response sent to "${senderName}" on ${platform} within the required timeframe.`,
  };

  notificationStore.add(notification);
  return notification;
}

// ============================================================
// Public API
// ============================================================

/**
 * Evaluates a lead for escalation based on declared intent and
 * engagement signals. If escalation criteria are met, flags the
 * lead as high priority and creates a notification for the
 * assigned Sales Consultant.
 *
 * Does NOT use demographic fields (NFR-004 compliance).
 *
 * @param leadId - The ID of the lead to evaluate
 * @returns EscalationResult with escalation outcome
 */
export async function evaluateAndEscalate(
  leadId: string
): Promise<EscalationResult> {
  const lead = leadStore.getById(leadId);

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const evaluation = shouldEscalate({
    intent: lead.intent,
    confidenceScore: lead.confidenceScore,
    budget: lead.budget,
    messageCount: lead.messageCount,
    priority: lead.priority,
    status: lead.status,
    slaBreached: lead.slaBreached,
    priorityFlag: lead.priorityFlag,
  });

  if (!evaluation.shouldEscalate || !evaluation.reason) {
    await auditLogger.logEvent(
      "ESCALATION_EVALUATED",
      "system",
      leadId,
      JSON.stringify({
        leadId,
        escalated: false,
        reason: "No escalation criteria met",
      })
    );

    return {
      leadId,
      escalated: false,
      reason: null,
      escalatedAt: null,
      notificationId: null,
    };
  }

  // Flag the lead for escalation
  const updatedLead = leadStore.flagForEscalation(leadId);
  if (!updatedLead) {
    throw new Error(`Failed to escalate lead: ${leadId}`);
  }

  // Update escalation reason
  leadStore.update(leadId, {
    escalationReason: evaluation.reason,
  });

  // Create notification for Sales Consultant
  const notification = createEscalationNotification(
    leadId,
    lead.name,
    evaluation.reason
  );

  // Audit log
  await auditLogger.logEvent(
    "LEAD_ESCALATED",
    "system",
    leadId,
    JSON.stringify({
      leadId,
      leadName: lead.name,
      reason: evaluation.reason,
      notificationId: notification.id,
      escalatedAt: updatedLead.escalatedAt,
    })
  );

  return {
    leadId,
    escalated: true,
    reason: evaluation.reason,
    escalatedAt: updatedLead.escalatedAt || new Date().toISOString(),
    notificationId: notification.id,
  };
}

/**
 * Scans all DMs for SLA breaches (no response within the configured
 * threshold). Creates SLA breach notifications for any breached DMs.
 *
 * @returns Array of SLABreachResult for all detected breaches
 */
export async function checkSLABreaches(): Promise<SLABreachResult[]> {
  const allDMs = dmStore.getAll();
  const now = Date.now();
  const breaches: SLABreachResult[] = [];

  for (const dm of allDMs) {
    // Only check DMs that are still "new" (no response drafted or sent)
    if (dm.status !== "new") {
      continue;
    }

    const slaDeadline = new Date(dm.slaDeadline).getTime();

    // Check if SLA deadline has passed
    if (now > slaDeadline) {
      const breachedAt = new Date().toISOString();

      // Create SLA breach notification
      const notification = createSLABreachNotification(
        dm.id,
        dm.sender.name,
        dm.platform
      );

      // Update DM status to escalated
      dmStore.updateStatus(dm.id, "escalated");

      // Check if there's a linked lead and escalate it too
      const linkedLead = leadStore.getAll().find(
        (lead) => lead.dmId === dm.id
      );
      if (linkedLead) {
        leadStore.update(linkedLead.id, {
          slaBreached: true,
          priority: "high",
          priorityFlag: true,
        });
      }

      // Audit log
      await auditLogger.logEvent(
        "SLA_BREACH_DETECTED",
        "system",
        dm.id,
        JSON.stringify({
          dmId: dm.id,
          senderName: dm.sender.name,
          platform: dm.platform,
          slaDeadline: dm.slaDeadline,
          breachedAt,
          notificationId: notification.id,
          linkedLeadId: linkedLead?.id || null,
        })
      );

      breaches.push({
        dmId: dm.id,
        senderName: dm.sender.name,
        platform: dm.platform,
        slaDeadline: dm.slaDeadline,
        breachedAt,
        notificationId: notification.id,
      });
    }
  }

  if (breaches.length > 0) {
    await auditLogger.logEvent(
      "SLA_BREACH_SCAN_COMPLETE",
      "system",
      "sla-scan",
      JSON.stringify({
        totalDMsScanned: allDMs.length,
        breachesDetected: breaches.length,
        breachedDMIds: breaches.map((b) => b.dmId),
      })
    );
  }

  return breaches;
}

/**
 * Returns escalation history events for a given lead by querying
 * the audit log for escalation-related actions.
 *
 * @param leadId - The ID of the lead to get escalation history for
 * @returns Array of EscalationHistoryEntry sorted by timestamp descending
 */
export async function getEscalationHistory(
  leadId: string
): Promise<EscalationHistoryEntry[]> {
  const lead = leadStore.getById(leadId);
  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const auditLogs = await auditLogger.getAuditLogs({
    entityRef: leadId,
  });

  const escalationActions = [
    "LEAD_ESCALATED",
    "ESCALATION_EVALUATED",
    "SLA_BREACH_DETECTED",
  ];

  const history: EscalationHistoryEntry[] = auditLogs
    .filter((entry) => escalationActions.includes(entry.action))
    .map((entry) => {
      let reason = "";
      try {
        const details = JSON.parse(entry.details);
        reason = details.reason || details.escalationReason || entry.action;
      } catch {
        reason = entry.action;
      }

      return {
        id: entry.id,
        leadId,
        action: entry.action,
        reason,
        timestamp: entry.timestamp,
        actor: entry.actor,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

  return history;
}