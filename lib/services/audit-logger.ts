import { v4 as uuidv4 } from "uuid";
import type { AuditLogEntry } from "@/lib/types";
import { scrubPII } from "@/lib/services/pii-scrubber";

export interface AuditLogFilters {
  action?: string;
  actor?: string;
  entityRef?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditLogStorage {
  append(entry: AuditLogEntry): Promise<void>;
  query(filters?: AuditLogFilters): Promise<ReadonlyArray<AuditLogEntry>>;
}

class InMemoryAuditLogStorage implements AuditLogStorage {
  private readonly logs: AuditLogEntry[] = [];

  async append(entry: AuditLogEntry): Promise<void> {
    this.logs.push(Object.freeze({ ...entry }));
  }

  async query(filters?: AuditLogFilters): Promise<ReadonlyArray<AuditLogEntry>> {
    let results: AuditLogEntry[] = [...this.logs];

    if (!filters) {
      return Object.freeze(results);
    }

    if (filters.action) {
      const action = filters.action;
      results = results.filter((entry) => entry.action === action);
    }

    if (filters.actor) {
      const actor = filters.actor;
      results = results.filter((entry) => entry.actor === actor);
    }

    if (filters.entityRef) {
      const entityRef = filters.entityRef;
      results = results.filter((entry) => entry.entityRef === entityRef);
    }

    if (filters.startDate) {
      const startTime = new Date(filters.startDate).getTime();
      results = results.filter(
        (entry) => new Date(entry.timestamp).getTime() >= startTime
      );
    }

    if (filters.endDate) {
      const endTime = new Date(filters.endDate).getTime();
      results = results.filter(
        (entry) => new Date(entry.timestamp).getTime() <= endTime
      );
    }

    return Object.freeze(results);
  }
}

export class AuditLogger {
  private readonly storage: AuditLogStorage;

  constructor(storage?: AuditLogStorage) {
    this.storage = storage ?? new InMemoryAuditLogStorage();
  }

  async logEvent(
    action: string,
    actor: string,
    entityRef: string,
    details: string
  ): Promise<AuditLogEntry> {
    const scrubbedDetails = scrubPII(details);

    const entry: AuditLogEntry = Object.freeze({
      id: uuidv4(),
      action,
      actor,
      timestamp: new Date().toISOString(),
      entityRef,
      details: scrubbedDetails,
    });

    await this.storage.append(entry);

    return entry;
  }

  async getAuditLogs(
    filters?: AuditLogFilters
  ): Promise<ReadonlyArray<AuditLogEntry>> {
    return this.storage.query(filters);
  }
}

const auditLogger = new AuditLogger();

export default auditLogger;