import { v4 as uuidv4 } from "uuid";
import type {
  LeadData,
  ExtractedLeadFields,
  SalesforceLeadPayload,
  APIResponse,
} from "@/lib/types";
import { LeadStatus } from "@/lib/types";
import { leadStore } from "@/lib/stores/lead-store";
import type { Lead } from "@/lib/stores/lead-store";
import auditLogger from "@/lib/services/audit-logger";
import { scrubPII } from "@/lib/services/pii-scrubber";
import {
  validateLeadScoring,
  scrubForLLM,
} from "@/lib/compliance/compliance-guardrails";

// ============================================================
// Lead Manager — CRUD operations and Salesforce integration
// ============================================================

export interface LeadFilters {
  status?: string;
  priority?: string;
  platform?: string;
  slaBreached?: boolean;
  search?: string;
}

export interface LeadUpdatePayload {
  name?: string;
  email?: string;
  company?: string;
  budget?: number;
  budgetCurrency?: string;
  location?: string;
  intent?: string;
  priority?: string;
  status?: string;
  tags?: string[];
  notes?: string;
  confirmedBy?: string;
}

/**
 * Creates a new lead from extracted DM fields.
 *
 * @param extractedFields - The fields extracted from a DM
 * @param dmId - The ID of the source DM
 * @returns The created LeadData
 */
export async function createLead(
  extractedFields: ExtractedLeadFields,
  dmId: string
): Promise<LeadData> {
  if (!dmId || dmId.trim().length === 0) {
    throw new Error("dmId is required to create a lead");
  }

  // Validate lead scoring data for compliance (no demographic bias)
  const complianceViolations = validateLeadScoring({
    name: extractedFields.name,
    contact: extractedFields.contact,
    budget: extractedFields.budget,
    location: extractedFields.location,
    intent: extractedFields.intent,
    confidence: extractedFields.confidence,
  });

  if (complianceViolations.some((v) => v.severity === "critical")) {
    const criticalMessages = complianceViolations
      .filter((v) => v.severity === "critical")
      .map((v) => v.message)
      .join("; ");
    throw new Error(`Compliance violation: ${criticalMessages}`);
  }

  const leadId = `lead-${uuidv4()}`;
  const now = new Date().toISOString();

  const priorityFlag =
    extractedFields.confidence >= 0.8 ||
    (extractedFields.intent?.toLowerCase().includes("urgent") ?? false);

  const leadData: LeadData = {
    id: leadId,
    name: extractedFields.name || "Unknown",
    contact: extractedFields.contact || "",
    budget: extractedFields.budget,
    location: extractedFields.location,
    intent: extractedFields.intent,
    source: "social_dm",
    status: LeadStatus.EXTRACTED,
    priorityFlag,
    dmId,
    createdAt: now,
  };

  // Persist to lead store
  leadStore.add({
    id: leadData.id,
    name: leadData.name,
    email: leadData.contact,
    company: "",
    platform: "social_dm",
    handle: "",
    budget: leadData.budget ? parseInt(leadData.budget, 10) || 0 : 0,
    budgetCurrency: "AUD",
    location: leadData.location || "",
    intent: leadData.intent || "",
    priority: priorityFlag ? "high" : "medium",
    confidenceScore: extractedFields.confidence,
    status: "new",
    tags: [],
    firstContactAt: now,
    lastMessageAt: now,
    messageCount: 1,
    slaBreached: false,
    notes: "",
    dmId,
    priorityFlag,
  });

  await auditLogger.logEvent(
    "LEAD_CREATED",
    "system",
    leadId,
    JSON.stringify({
      dmId,
      confidence: extractedFields.confidence,
      priorityFlag,
      status: LeadStatus.EXTRACTED,
    })
  );

  return leadData;
}

/**
 * Retrieves a lead by its ID.
 *
 * @param id - The lead ID
 * @returns The lead data or null if not found
 */
export async function getLead(id: string): Promise<Lead | null> {
  if (!id || id.trim().length === 0) {
    throw new Error("Lead ID is required");
  }

  const lead = leadStore.getById(id);

  if (!lead) {
    return null;
  }

  await auditLogger.logEvent(
    "LEAD_ACCESSED",
    "system",
    id,
    JSON.stringify({ leadId: id })
  );

  return lead;
}

/**
 * Updates lead fields after officer review.
 *
 * @param id - The lead ID
 * @param updates - The fields to update
 * @returns The updated lead or null if not found
 */
export async function updateLead(
  id: string,
  updates: LeadUpdatePayload
): Promise<Lead | null> {
  if (!id || id.trim().length === 0) {
    throw new Error("Lead ID is required");
  }

  const existing = leadStore.getById(id);
  if (!existing) {
    return null;
  }

  const storeUpdates: Partial<Omit<Lead, "id">> = {};

  if (updates.name !== undefined) {
    storeUpdates.name = updates.name;
  }
  if (updates.email !== undefined) {
    storeUpdates.email = updates.email;
  }
  if (updates.company !== undefined) {
    storeUpdates.company = updates.company;
  }
  if (updates.budget !== undefined) {
    storeUpdates.budget = updates.budget;
  }
  if (updates.budgetCurrency !== undefined) {
    storeUpdates.budgetCurrency = updates.budgetCurrency;
  }
  if (updates.location !== undefined) {
    storeUpdates.location = updates.location;
  }
  if (updates.intent !== undefined) {
    storeUpdates.intent = updates.intent;
  }
  if (updates.priority !== undefined) {
    storeUpdates.priority = updates.priority;
    storeUpdates.priorityFlag = updates.priority === "high";
  }
  if (updates.status !== undefined) {
    storeUpdates.status = updates.status;
  }
  if (updates.tags !== undefined) {
    storeUpdates.tags = updates.tags;
  }
  if (updates.notes !== undefined) {
    storeUpdates.notes = updates.notes;
  }
  if (updates.confirmedBy !== undefined) {
    storeUpdates.confirmedBy = updates.confirmedBy;
  }

  storeUpdates.lastMessageAt = new Date().toISOString();

  const updated = leadStore.update(id, storeUpdates);

  if (!updated) {
    return null;
  }

  await auditLogger.logEvent(
    "LEAD_UPDATED",
    updates.confirmedBy || "system",
    id,
    JSON.stringify({
      leadId: id,
      updatedFields: Object.keys(updates),
    })
  );

  return updated;
}

/**
 * Returns a filtered list of leads.
 *
 * @param filters - Optional filters to apply
 * @returns Array of matching leads
 */
export async function listLeads(filters?: LeadFilters): Promise<Lead[]> {
  let leads: Lead[];

  if (filters?.status) {
    leads = leadStore.getByStatus(filters.status);
  } else {
    leads = leadStore.getAll();
  }

  if (filters?.priority) {
    const priority = filters.priority;
    leads = leads.filter((lead) => lead.priority === priority);
  }

  if (filters?.platform) {
    const platform = filters.platform;
    leads = leads.filter((lead) => lead.platform === platform);
  }

  if (filters?.slaBreached !== undefined) {
    const slaBreached = filters.slaBreached;
    leads = leads.filter((lead) => lead.slaBreached === slaBreached);
  }

  if (filters?.search && filters.search.trim().length > 0) {
    const searchLower = filters.search.toLowerCase().trim();
    leads = leads.filter((lead) => {
      const name = lead.name.toLowerCase();
      const email = lead.email.toLowerCase();
      const company = lead.company.toLowerCase();
      const intent = lead.intent.toLowerCase();
      const handle = lead.handle.toLowerCase();

      return (
        name.includes(searchLower) ||
        email.includes(searchLower) ||
        company.includes(searchLower) ||
        intent.includes(searchLower) ||
        handle.includes(searchLower)
      );
    });
  }

  return leads;
}

/**
 * Sends lead data to Salesforce integration and updates status.
 *
 * @param leadId - The lead ID to push to Salesforce
 * @param confirmedBy - The user who confirmed the lead for Salesforce creation
 * @returns API response with Salesforce status
 */
export async function createLeadInSalesforce(
  leadId: string,
  confirmedBy?: string
): Promise<APIResponse<{ leadId: string; salesforceStatus: string }>> {
  if (!leadId || leadId.trim().length === 0) {
    return {
      success: false,
      data: null,
      error: "Lead ID is required",
    };
  }

  const lead = leadStore.getById(leadId);
  if (!lead) {
    return {
      success: false,
      data: null,
      error: "Lead not found",
    };
  }

  // Build Salesforce payload
  const nameParts = lead.name.trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : firstName;

  const salesforcePayload: SalesforceLeadPayload = {
    FirstName: firstName,
    LastName: lastName,
    Company: lead.company || "Unknown",
    Email: lead.email || undefined,
    LeadSource: `Social DM - ${lead.platform}`,
    Description: scrubPII(lead.intent || ""),
    Status: "New",
  };

  if (lead.location) {
    salesforcePayload.City = lead.location;
  }

  try {
    // Update lead status to indicate Salesforce creation is pending
    leadStore.update(leadId, {
      salesforceStatus: "pending",
      confirmedBy: confirmedBy || undefined,
    });

    await auditLogger.logEvent(
      "SALESFORCE_LEAD_CREATION_INITIATED",
      confirmedBy || "system",
      leadId,
      JSON.stringify({
        leadId,
        salesforcePayload: {
          FirstName: salesforcePayload.FirstName,
          LastName: salesforcePayload.LastName,
          Company: salesforcePayload.Company,
          LeadSource: salesforcePayload.LeadSource,
          Status: salesforcePayload.Status,
        },
      })
    );

    // Check if Salesforce credentials are configured
    const sfInstanceUrl = process.env.SALESFORCE_INSTANCE_URL;
    const sfClientId = process.env.SALESFORCE_CLIENT_ID;
    const sfClientSecret = process.env.SALESFORCE_CLIENT_SECRET;
    const sfUsername = process.env.SALESFORCE_USERNAME;
    const sfPassword = process.env.SALESFORCE_PASSWORD;

    if (!sfInstanceUrl || !sfClientId || !sfClientSecret || !sfUsername || !sfPassword) {
      // Salesforce not configured — mark as pending for manual sync
      leadStore.update(leadId, {
        salesforceStatus: "pending_manual",
        status: "drafted",
      });

      await auditLogger.logEvent(
        "SALESFORCE_NOT_CONFIGURED",
        confirmedBy || "system",
        leadId,
        JSON.stringify({
          leadId,
          message: "Salesforce credentials not configured. Lead marked for manual sync.",
        })
      );

      return {
        success: true,
        data: {
          leadId,
          salesforceStatus: "pending_manual",
        },
        error: null,
      };
    }

    // Attempt Salesforce OAuth2 token acquisition
    const tokenUrl = `${sfInstanceUrl}/services/oauth2/token`;
    const tokenParams = new URLSearchParams({
      grant_type: "password",
      client_id: sfClientId,
      client_secret: sfClientSecret,
      username: sfUsername,
      password: sfPassword,
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      leadStore.update(leadId, {
        salesforceStatus: "auth_failed",
      });

      await auditLogger.logEvent(
        "SALESFORCE_AUTH_FAILED",
        confirmedBy || "system",
        leadId,
        JSON.stringify({
          leadId,
          statusCode: tokenResponse.status,
        })
      );

      return {
        success: false,
        data: null,
        error: "Salesforce authentication failed",
      };
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      instance_url: string;
    };

    // Create lead in Salesforce
    const createUrl = `${tokenData.instance_url}/services/data/v58.0/sobjects/Lead`;
    const createResponse = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(salesforcePayload),
    });

    if (!createResponse.ok) {
      leadStore.update(leadId, {
        salesforceStatus: "creation_failed",
      });

      await auditLogger.logEvent(
        "SALESFORCE_LEAD_CREATION_FAILED",
        confirmedBy || "system",
        leadId,
        JSON.stringify({
          leadId,
          statusCode: createResponse.status,
        })
      );

      return {
        success: false,
        data: null,
        error: "Failed to create lead in Salesforce",
      };
    }

    // Success
    leadStore.update(leadId, {
      salesforceStatus: "created",
      status: "sent",
    });

    await auditLogger.logEvent(
      "SALESFORCE_LEAD_CREATED",
      confirmedBy || "system",
      leadId,
      JSON.stringify({
        leadId,
        salesforceStatus: "created",
      })
    );

    return {
      success: true,
      data: {
        leadId,
        salesforceStatus: "created",
      },
      error: null,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    leadStore.update(leadId, {
      salesforceStatus: "error",
    });

    await auditLogger.logEvent(
      "SALESFORCE_LEAD_CREATION_ERROR",
      confirmedBy || "system",
      leadId,
      JSON.stringify({
        leadId,
        error: errorMessage,
      })
    );

    return {
      success: false,
      data: null,
      error: `Salesforce integration error: ${errorMessage}`,
    };
  }
}

/**
 * Flags a lead as high-priority and triggers escalation.
 *
 * @param leadId - The lead ID to escalate
 * @param reason - Optional reason for escalation
 * @returns The escalated lead or null if not found
 */
export async function escalateLead(
  leadId: string,
  reason?: string
): Promise<Lead | null> {
  if (!leadId || leadId.trim().length === 0) {
    throw new Error("Lead ID is required for escalation");
  }

  const existing = leadStore.getById(leadId);
  if (!existing) {
    return null;
  }

  // Check if already escalated
  if (existing.status === "escalated") {
    await auditLogger.logEvent(
      "LEAD_ESCALATION_SKIPPED",
      "system",
      leadId,
      JSON.stringify({
        leadId,
        reason: "Lead is already escalated",
      })
    );
    return existing;
  }

  const escalatedLead = leadStore.flagForEscalation(leadId);

  if (!escalatedLead) {
    return null;
  }

  if (reason) {
    leadStore.update(leadId, {
      escalationReason: reason,
    });
  }

  await auditLogger.logEvent(
    "LEAD_ESCALATED",
    "system",
    leadId,
    JSON.stringify({
      leadId,
      reason: reason || "Manual escalation",
      previousStatus: existing.status,
      newStatus: "escalated",
      escalatedAt: escalatedLead.escalatedAt,
    })
  );

  return leadStore.getById(leadId) || escalatedLead;
}

/**
 * Evaluates whether a lead should be automatically escalated based on rules.
 * Rule-based scoring for pilot — no demographic fields used.
 *
 * @param lead - The lead to evaluate
 * @returns true if the lead should be escalated
 */
export function shouldAutoEscalate(lead: Lead): boolean {
  // High confidence score
  if (lead.confidenceScore >= 0.9) {
    return true;
  }

  // Urgent intent keywords
  if (lead.intent) {
    const intentLower = lead.intent.toLowerCase();
    const urgentKeywords = ["urgent", "asap", "immediately", "today", "right now"];
    if (urgentKeywords.some((keyword) => intentLower.includes(keyword))) {
      return true;
    }
  }

  // High budget threshold
  if (lead.budget && lead.budget > 1000000) {
    return true;
  }

  // SLA breached
  if (lead.slaBreached) {
    return true;
  }

  // Already flagged as high priority
  if (lead.priorityFlag && lead.priority === "high") {
    return true;
  }

  return false;
}

/**
 * Processes all new leads and auto-escalates those matching escalation rules.
 *
 * @returns Array of escalated lead IDs
 */
export async function processAutoEscalations(): Promise<string[]> {
  const newLeads = leadStore.getByStatus("new");
  const escalatedIds: string[] = [];

  for (const lead of newLeads) {
    if (shouldAutoEscalate(lead)) {
      const escalated = await escalateLead(
        lead.id,
        "Auto-escalated by rule-based scoring"
      );
      if (escalated) {
        escalatedIds.push(lead.id);
      }
    }
  }

  if (escalatedIds.length > 0) {
    await auditLogger.logEvent(
      "AUTO_ESCALATION_BATCH",
      "system",
      "batch",
      JSON.stringify({
        processedCount: newLeads.length,
        escalatedCount: escalatedIds.length,
        escalatedIds,
      })
    );
  }

  return escalatedIds;
}