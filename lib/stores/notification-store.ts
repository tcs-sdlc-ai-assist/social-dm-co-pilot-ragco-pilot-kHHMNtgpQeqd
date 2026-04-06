import { Notification } from "@/lib/types";

class NotificationStore {
  private notifications: Notification[] = [];

  getAll(): Notification[] {
    return [...this.notifications];
  }

  getByRecipient(recipientId: string): Notification[] {
    return this.notifications.filter(
      (notification) => notification.recipientId === recipientId
    );
  }

  add(notification: Notification): void {
    this.notifications.push(notification);
  }

  markAsRead(id: string): void {
    const notification = this.notifications.find((n) => n.id === id);
    if (notification) {
      notification.status = "read";
    }
  }

  getUnread(recipientId: string): Notification[] {
    return this.notifications.filter(
      (notification) =>
        notification.recipientId === recipientId &&
        notification.status !== "read"
    );
  }
}

export const notificationStore = new NotificationStore();
export { NotificationStore };