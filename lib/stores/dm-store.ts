import { DMStatus } from "@/lib/types";
import sampleDMs from "@/data/sample-dms.json";

export interface DMSender {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string;
}

export interface DMMetadata {
  communityName: string | null;
  propertyType: string | null;
  bedrooms: number | null;
}

export interface DMRecord {
  id: string;
  platform: string;
  conversationId: string;
  sender: DMSender;
  content: string;
  timestamp: string;
  intent: string;
  status: string;
  priority: string;
  confidenceScore: number;
  slaDeadline: string;
  draftResponse?: string;
  sentAt?: string;
  escalationReason?: string;
  metadata: DMMetadata;
}

class DMStore {
  private dms: Map<string, DMRecord>;

  constructor() {
    this.dms = new Map();
    this.loadSampleData();
  }

  private loadSampleData(): void {
    for (const dm of sampleDMs) {
      const record: DMRecord = {
        id: dm.id,
        platform: dm.platform,
        conversationId: dm.conversationId,
        sender: {
          id: dm.sender.id,
          name: dm.sender.name,
          handle: dm.sender.handle,
          avatarUrl: dm.sender.avatarUrl,
        },
        content: dm.content,
        timestamp: dm.timestamp,
        intent: dm.intent,
        status: dm.status,
        priority: dm.priority,
        confidenceScore: dm.confidenceScore,
        slaDeadline: dm.slaDeadline,
        metadata: {
          communityName: dm.metadata.communityName,
          propertyType: dm.metadata.propertyType,
          bedrooms: dm.metadata.bedrooms,
        },
      };

      if ("draftResponse" in dm && typeof dm.draftResponse === "string") {
        record.draftResponse = dm.draftResponse;
      }

      if ("sentAt" in dm && typeof dm.sentAt === "string") {
        record.sentAt = dm.sentAt;
      }

      if ("escalationReason" in dm && typeof dm.escalationReason === "string") {
        record.escalationReason = dm.escalationReason;
      }

      this.dms.set(record.id, record);
    }
  }

  getAll(): DMRecord[] {
    const allDMs = Array.from(this.dms.values());
    return allDMs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  getById(id: string): DMRecord | null {
    return this.dms.get(id) ?? null;
  }

  add(dm: DMRecord): DMRecord {
    this.dms.set(dm.id, { ...dm });
    return this.dms.get(dm.id)!;
  }

  updateStatus(id: string, status: string): DMRecord | null {
    const dm = this.dms.get(id);
    if (!dm) {
      return null;
    }
    const updated: DMRecord = { ...dm, status };
    this.dms.set(id, updated);
    return updated;
  }

  getByStatus(status: string): DMRecord[] {
    const filtered = Array.from(this.dms.values()).filter(
      (dm) => dm.status === status
    );
    return filtered.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  search(query: string): DMRecord[] {
    if (!query || query.trim().length === 0) {
      return this.getAll();
    }

    const lowerQuery = query.toLowerCase().trim();

    const results = Array.from(this.dms.values()).filter((dm) => {
      const senderName = dm.sender.name.toLowerCase();
      const senderHandle = dm.sender.handle.toLowerCase();
      const content = dm.content.toLowerCase();
      const communityName = dm.metadata.communityName?.toLowerCase() ?? "";

      return (
        senderName.includes(lowerQuery) ||
        senderHandle.includes(lowerQuery) ||
        content.includes(lowerQuery) ||
        communityName.includes(lowerQuery)
      );
    });

    return results.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }
}

const globalForDMStore = globalThis as unknown as {
  __dmStore: DMStore | undefined;
};

export const dmStore: DMStore =
  globalForDMStore.__dmStore ?? new DMStore();

if (process.env.NODE_ENV !== "production") {
  globalForDMStore.__dmStore = dmStore;
}

export { DMStore };