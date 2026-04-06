import { v4 as uuidv4 } from "uuid";
import { notificationStore } from "@/lib/stores/notification-store";
import { NotificationType } from "@/lib/types";
import type { Notification } from "@/lib/types";

/**
 * Creates a notification and stores it in the notification store.
 *
 * @param type - The type of notification
 * @param leadId - The associated lead ID
 * @param recipientId - The recipient user ID
 * @param message - The notification message
 * @returns The created notification
 */
export function createNotification(
  type: NotificationType,
  leadId: string,
  recipientId: string,
  message: string
): Notification {
  const notification: Notification = {
    id: uuidv4(),
    leadId,
    recipientId,
    type,
    timestamp: new Date().toISOString(),
    status: "unread",
    message,
  };

  notificationStore.add(notification);

  return notification;
}

/**
 * Returns all notifications for a given recipient.
 *
 * @param recipientId - The recipient user ID
 * @returns Array of notifications for the recipient
 */
export function getNotifications(recipientId: string): Notification[] {
  return notificationStore.getByRecipient(recipientId);
}

/**
 * Returns the count of unread notifications for a given recipient.
 *
 * @param recipientId - The recipient user ID
 * @returns The number of unread notifications
 */
export function getUnreadCount(recipientId: string): number {
  const unread = notificationStore.getUnread(recipientId);
  return unread.length;
}

/**
 * Marks a notification as read by its ID.
 *
 * @param notificationId - The notification ID to mark as read
 */
export function markAsRead(notificationId: string): void {
  notificationStore.markAsRead(notificationId);
}

/**
 * Creates a high-priority lead notification for a sales consultant.
 *
 * @param leadId - The associated lead ID
 * @param consultantId - The sales consultant recipient ID
 * @returns The created notification
 */
export function triggerHighPriorityAlert(
  leadId: string,
  consultantId: string
): Notification {
  const message = `High-priority lead detected (Lead ID: ${leadId}). Immediate follow-up recommended.`;

  return createNotification(
    NotificationType.HIGH_PRIORITY_LEAD,
    leadId,
    consultantId,
    message
  );
}

/**
 * Creates an SLA breach notification for a DM that has exceeded the response time threshold.
 * The notification is sent to the "system" recipient by default, as SLA breaches
 * are system-level alerts that should be visible to all relevant users.
 *
 * @param dmId - The DM ID that has breached SLA
 * @returns The created notification
 */
export function triggerSLABreachAlert(dmId: string): Notification {
  const message = `SLA breach detected for DM (ID: ${dmId}). Response time has exceeded the configured threshold.`;

  return createNotification(
    NotificationType.SLA_BREACH,
    dmId,
    "system",
    message
  );
}