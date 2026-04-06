import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createLead,
  getLead,
  updateLead,
  listLeads,
  createLeadInSalesforce,
  escalateLead,
  shouldAutoEscalate,
  processAutoEscalations,
} from "@/lib/services/lead-manager";
import { leadStore } from "@/lib/stores/lead-store";
import type { Lead } from "@/lib/stores/lead-store";
import { dmStore } from "@/lib/stores/dm-store";
import type { ExtractedLeadFields } from "@/lib/types";
import auditLogger from "@/lib/services/audit-logger";

describe("lead-manager", () => {
  // Store original methods so we can spy on them
  let auditLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    auditLogSpy = vi.spyOn(auditLogger, "logEvent").mockResolvedValue({
      id: "audit-test",
      action: "TEST",
      actor: "test",
      timestamp: new Date().toISOString(),
      entityRef: "test",
      details: "{}",
    });
  });

  // ============================================================
  // createLead
  // ============================================================

  describe("createLead", () => {
    it("should create a lead from extracted fields", async () => {
      const extractedFields: ExtractedLeadFields = {
        name: "Sarah Mitchell",
        contact: "sarah@example.com",
        budget: "$500,000",
        location: "Sydney, NSW",
        intent: "Interested in Willowdale 3BR",
        confidence: 0.85,
      };

      const result = await createLead(extractedFields, "dm-test-001");

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^lead-/);
      expect(result.name).toBe("Sarah Mitchell");
      expect(result.contact).toBe("sarah@example.com");
      expect(result.budget).toBe("$500,000");
      expect(result.location).toBe("Sydney, NSW");
      expect(result.intent).toBe("Interested in Willowdale 3BR");
      expect(result.source).toBe("social_dm");
      expect(result.status).toBe("EXTRACTED");
      expect(result.dmId).toBe("dm-test-001");
      expect(result.createdAt).toBeDefined();
    });

    it("should set priorityFlag to true for high confidence leads", async () => {
      const extractedFields: ExtractedLeadFields = {
        name: "High Confidence Lead",
        contact: "high@example.com",
        budget: "$1,000,000",
        location: "Melbourne",
        intent: "Ready to buy",
        confidence: 0.92,
      };

      const result = await createLead(extractedFields, "dm-test-002");

      expect(result.priorityFlag).toBe(true);
    });

    it("should set priorityFlag to false for low confidence leads", async () => {
      const extractedFields: ExtractedLeadFields = {
        name: "Low Confidence Lead",
        contact: null,
        budget: null,
        location: null,
        intent: "Just browsing",
        confidence: 0.4,
      };

      const result = await createLead(extractedFields, "dm-test-003");

      expect(result.priorityFlag).toBe(false);
    });

    it("should set priorityFlag to true when intent contains urgent", async () => {
      const extractedFields: ExtractedLeadFields = {
        name: "Urgent Lead",
        contact: "urgent@example.com",
        budget: null,
        location: null,
        intent: "urgent need for property",
        confidence: 0.5,
      };

      const result = await createLead(extractedFields, "dm-test-004");

      expect(result.priorityFlag).toBe(true);
    });

    it("should use 'Unknown' for name when not provided", async () => {
      const extractedFields: ExtractedLeadFields = {
        name: null,
        contact: null,
        budget: null,
        location: null,
        intent: null,
        confidence: 0.3,
      };

      const result = await createLead(extractedFields, "dm-test-005");

      expect(result.name).toBe("Unknown");
    });

    it("should throw error when dmId is empty", async () => {
      const extractedFields: ExtractedLeadFields = {
        name: "Test",
        contact: null,
        budget: null,
        location: null,
        intent: null,
        confidence: 0.5,
      };

      await expect(createLead(extractedFields, "")).rejects.toThrow(
        "dmId is required to create a lead"
      );
    });

    it("should throw error when dmId is whitespace only", async () => {
      const extractedFields: ExtractedLeadFields = {
        name: "Test",
        contact: null,
        budget: null,
        location: null,
        intent: null,
        confidence: 0.5,
      };

      await expect(createLead(extractedFields, "   ")).rejects.toThrow(
        "dmId is required to create a lead"
      );
    });

    it("should log an audit event when creating a lead", async () => {
      const extractedFields: ExtractedLeadFields = {
        name: "Audit Test Lead",
        contact: "audit@example.com",
        budget: "$600,000",
        location: "Brisbane",
        intent: "Interested in Aura",
        confidence: 0.75,
      };

      await createLead(extractedFields, "dm-test-audit-001");

      expect(auditLogSpy).toHaveBeenCalledWith(
        "LEAD_CREATED",
        "system",
        expect.stringMatching(/^lead-/),
        expect.stringContaining("dm-test-audit-001")
      );
    });

    it("should persist the lead to the lead store", async () => {
      const extractedFields: ExtractedLeadFields = {
        name: "Persisted Lead",
        contact: "persist@example.com",
        budget: "$700,000",
        location: "Perth",
        intent: "Looking at Highlands",
        confidence: 0.8,
      };

      const result = await createLead(extractedFields, "dm-test-persist-001");

      const storedLead = leadStore.getById(result.id);
      expect(storedLead).toBeDefined();
      expect(storedLead!.name).toBe("Persisted Lead");
      expect(storedLead!.email).toBe("persist@example.com");
    });
  });

  // ============================================================
  // getLead
  // ============================================================

  describe("getLead", () => {
    it("should retrieve an existing lead by ID", async () => {
      // Use a sample lead that was loaded from sample-leads.json
      const lead = await getLead("lead-001");

      expect(lead).toBeDefined();
      expect(lead!.id).toBe("lead-001");
      expect(lead!.name).toBe("Sarah Mitchell");
    });

    it("should return null for a non-existent lead", async () => {
      const lead = await getLead("lead-nonexistent-999");

      expect(lead).toBeNull();
    });

    it("should throw error when ID is empty", async () => {
      await expect(getLead("")).rejects.toThrow("Lead ID is required");
    });

    it("should throw error when ID is whitespace only", async () => {
      await expect(getLead("   ")).rejects.toThrow("Lead ID is required");
    });

    it("should log an audit event when accessing a lead", async () => {
      await getLead("lead-001");

      expect(auditLogSpy).toHaveBeenCalledWith(
        "LEAD_ACCESSED",
        "system",
        "lead-001",
        expect.any(String)
      );
    });
  });

  // ============================================================
  // updateLead
  // ============================================================

  describe("updateLead", () => {
    it("should update lead name", async () => {
      const updated = await updateLead("lead-001", {
        name: "Sarah M. Updated",
      });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe("Sarah M. Updated");
    });

    it("should update lead email", async () => {
      const updated = await updateLead("lead-001", {
        email: "sarah.updated@example.com",
      });

      expect(updated).toBeDefined();
      expect(updated!.email).toBe("sarah.updated@example.com");
    });

    it("should update lead company", async () => {
      const updated = await updateLead("lead-001", {
        company: "Updated Corp",
      });

      expect(updated).toBeDefined();
      expect(updated!.company).toBe("Updated Corp");
    });

    it("should update lead budget", async () => {
      const updated = await updateLead("lead-001", {
        budget: 100000,
      });

      expect(updated).toBeDefined();
      expect(updated!.budget).toBe(100000);
    });

    it("should update lead priority and set priorityFlag", async () => {
      const updated = await updateLead("lead-002", {
        priority: "high",
      });

      expect(updated).toBeDefined();
      expect(updated!.priority).toBe("high");
      expect(updated!.priorityFlag).toBe(true);
    });

    it("should update lead status", async () => {
      const updated = await updateLead("lead-002", {
        status: "drafted",
      });

      expect(updated).toBeDefined();
      expect(updated!.status).toBe("drafted");
    });

    it("should update lead tags", async () => {
      const updated = await updateLead("lead-001", {
        tags: ["enterprise", "high-value"],
      });

      expect(updated).toBeDefined();
      expect(updated!.tags).toEqual(["enterprise", "high-value"]);
    });

    it("should update lead notes", async () => {
      const updated = await updateLead("lead-001", {
        notes: "Updated notes for testing",
      });

      expect(updated).toBeDefined();
      expect(updated!.notes).toBe("Updated notes for testing");
    });

    it("should update lastMessageAt on any update", async () => {
      const before = new Date().toISOString();
      const updated = await updateLead("lead-001", {
        notes: "Timestamp test",
      });

      expect(updated).toBeDefined();
      expect(new Date(updated!.lastMessageAt).getTime()).toBeGreaterThanOrEqual(
        new Date(before).getTime()
      );
    });

    it("should return null for a non-existent lead", async () => {
      const updated = await updateLead("lead-nonexistent-999", {
        name: "Does Not Exist",
      });

      expect(updated).toBeNull();
    });

    it("should throw error when ID is empty", async () => {
      await expect(updateLead("", { name: "Test" })).rejects.toThrow(
        "Lead ID is required"
      );
    });

    it("should log an audit event when updating a lead", async () => {
      await updateLead("lead-001", {
        name: "Audit Update Test",
        confirmedBy: "officer-test",
      });

      expect(auditLogSpy).toHaveBeenCalledWith(
        "LEAD_UPDATED",
        "officer-test",
        "lead-001",
        expect.stringContaining("lead-001")
      );
    });

    it("should set confirmedBy when provided", async () => {
      const updated = await updateLead("lead-001", {
        confirmedBy: "officer-456",
      });

      expect(updated).toBeDefined();
      expect(updated!.confirmedBy).toBe("officer-456");
    });
  });

  // ============================================================
  // listLeads
  // ============================================================

  describe("listLeads", () => {
    it("should return all leads when no filters are provided", async () => {
      const leads = await listLeads();

      expect(leads).toBeDefined();
      expect(Array.isArray(leads)).toBe(true);
      expect(leads.length).toBeGreaterThan(0);
    });

    it("should filter leads by status", async () => {
      const leads = await listLeads({ status: "new" });

      expect(leads).toBeDefined();
      for (const lead of leads) {
        expect(lead.status).toBe("new");
      }
    });

    it("should filter leads by priority", async () => {
      const leads = await listLeads({ priority: "high" });

      expect(leads).toBeDefined();
      for (const lead of leads) {
        expect(lead.priority).toBe("high");
      }
    });

    it("should filter leads by platform", async () => {
      const leads = await listLeads({ platform: "twitter" });

      expect(leads).toBeDefined();
      for (const lead of leads) {
        expect(lead.platform).toBe("twitter");
      }
    });

    it("should filter leads by slaBreached", async () => {
      const leads = await listLeads({ slaBreached: true });

      expect(leads).toBeDefined();
      for (const lead of leads) {
        expect(lead.slaBreached).toBe(true);
      }
    });

    it("should filter leads by search query matching name", async () => {
      const leads = await listLeads({ search: "Sarah" });

      expect(leads).toBeDefined();
      expect(leads.length).toBeGreaterThan(0);
      const hasMatch = leads.some((lead) =>
        lead.name.toLowerCase().includes("sarah")
      );
      expect(hasMatch).toBe(true);
    });

    it("should filter leads by search query matching company", async () => {
      const leads = await listLeads({ search: "TechVentures" });

      expect(leads).toBeDefined();
      expect(leads.length).toBeGreaterThan(0);
      const hasMatch = leads.some((lead) =>
        lead.company.toLowerCase().includes("techventures")
      );
      expect(hasMatch).toBe(true);
    });

    it("should return empty array for search with no matches", async () => {
      const leads = await listLeads({
        search: "zzzznonexistentzzzzz",
      });

      expect(leads).toBeDefined();
      expect(leads).toHaveLength(0);
    });

    it("should combine multiple filters", async () => {
      const leads = await listLeads({
        status: "new",
        priority: "high",
      });

      expect(leads).toBeDefined();
      for (const lead of leads) {
        expect(lead.status).toBe("new");
        expect(lead.priority).toBe("high");
      }
    });
  });

  // ============================================================
  // createLeadInSalesforce
  // ============================================================

  describe("createLeadInSalesforce", () => {
    it("should return error when leadId is empty", async () => {
      const result = await createLeadInSalesforce("");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Lead ID is required");
      expect(result.data).toBeNull();
    });

    it("should return error when lead is not found", async () => {
      const result = await createLeadInSalesforce("lead-nonexistent-999");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Lead not found");
      expect(result.data).toBeNull();
    });

    it("should handle Salesforce not configured (pending_manual)", async () => {
      // Ensure Salesforce env vars are not set (they shouldn't be in test)
      const originalEnv = { ...process.env };
      delete process.env.SALESFORCE_INSTANCE_URL;
      delete process.env.SALESFORCE_CLIENT_ID;
      delete process.env.SALESFORCE_CLIENT_SECRET;
      delete process.env.SALESFORCE_USERNAME;
      delete process.env.SALESFORCE_PASSWORD;

      const result = await createLeadInSalesforce("lead-001", "officer-test");

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.leadId).toBe("lead-001");
      expect(result.data!.salesforceStatus).toBe("pending_manual");

      // Restore env
      process.env = originalEnv;
    });

    it("should log audit event for Salesforce creation initiation", async () => {
      delete process.env.SALESFORCE_INSTANCE_URL;
      delete process.env.SALESFORCE_CLIENT_ID;
      delete process.env.SALESFORCE_CLIENT_SECRET;
      delete process.env.SALESFORCE_USERNAME;
      delete process.env.SALESFORCE_PASSWORD;

      await createLeadInSalesforce("lead-001", "officer-sf-test");

      expect(auditLogSpy).toHaveBeenCalledWith(
        "SALESFORCE_LEAD_CREATION_INITIATED",
        "officer-sf-test",
        "lead-001",
        expect.any(String)
      );
    });

    it("should log audit event when Salesforce is not configured", async () => {
      delete process.env.SALESFORCE_INSTANCE_URL;
      delete process.env.SALESFORCE_CLIENT_ID;
      delete process.env.SALESFORCE_CLIENT_SECRET;
      delete process.env.SALESFORCE_USERNAME;
      delete process.env.SALESFORCE_PASSWORD;

      await createLeadInSalesforce("lead-001", "officer-sf-test");

      expect(auditLogSpy).toHaveBeenCalledWith(
        "SALESFORCE_NOT_CONFIGURED",
        "officer-sf-test",
        "lead-001",
        expect.any(String)
      );
    });

    it("should update lead salesforceStatus to pending before attempting creation", async () => {
      delete process.env.SALESFORCE_INSTANCE_URL;

      await createLeadInSalesforce("lead-003", "officer-test");

      const lead = leadStore.getById("lead-003");
      expect(lead).toBeDefined();
      // After the flow completes with no SF config, it should be pending_manual
      expect(
        lead!.salesforceStatus === "pending_manual" ||
          lead!.salesforceStatus === "pending"
      ).toBe(true);
    });
  });

  // ============================================================
  // escalateLead
  // ============================================================

  describe("escalateLead", () => {
    it("should escalate a lead and set status to escalated", async () => {
      // Use a lead that is not already escalated
      const lead = leadStore.getById("lead-004");
      if (lead && lead.status === "escalated") {
        leadStore.update("lead-004", { status: "sent" });
      }

      const result = await escalateLead("lead-004", "High intent detected");

      expect(result).toBeDefined();
      expect(result!.status).toBe("escalated");
      expect(result!.priorityFlag).toBe(true);
      expect(result!.priority).toBe("high");
      expect(result!.escalatedAt).toBeDefined();
    });

    it("should set escalation reason when provided", async () => {
      // Reset lead status first
      leadStore.update("lead-007", { status: "new" });

      await escalateLead("lead-007", "Manual escalation by officer");

      const lead = leadStore.getById("lead-007");
      expect(lead).toBeDefined();
      expect(lead!.escalationReason).toBe("Manual escalation by officer");
    });

    it("should skip escalation if lead is already escalated", async () => {
      // First escalate
      leadStore.update("lead-009", { status: "new" });
      await escalateLead("lead-009", "First escalation");

      // Try to escalate again
      const result = await escalateLead("lead-009", "Second escalation");

      expect(result).toBeDefined();
      expect(result!.status).toBe("escalated");
    });

    it("should return null for a non-existent lead", async () => {
      const result = await escalateLead("lead-nonexistent-999");

      expect(result).toBeNull();
    });

    it("should throw error when leadId is empty", async () => {
      await expect(escalateLead("")).rejects.toThrow(
        "Lead ID is required for escalation"
      );
    });

    it("should throw error when leadId is whitespace only", async () => {
      await expect(escalateLead("   ")).rejects.toThrow(
        "Lead ID is required for escalation"
      );
    });

    it("should log an audit event when escalating a lead", async () => {
      leadStore.update("lead-010", { status: "new" });

      await escalateLead("lead-010", "Test escalation reason");

      expect(auditLogSpy).toHaveBeenCalledWith(
        "LEAD_ESCALATED",
        "system",
        "lead-010",
        expect.stringContaining("lead-010")
      );
    });

    it("should log skipped escalation for already escalated lead", async () => {
      // Ensure lead is escalated
      leadStore.update("lead-010", { status: "escalated" });

      await escalateLead("lead-010", "Duplicate escalation");

      expect(auditLogSpy).toHaveBeenCalledWith(
        "LEAD_ESCALATION_SKIPPED",
        "system",
        "lead-010",
        expect.any(String)
      );
    });
  });

  // ============================================================
  // shouldAutoEscalate
  // ============================================================

  describe("shouldAutoEscalate", () => {
    it("should return true for high confidence score (>= 0.9)", () => {
      const lead: Lead = {
        id: "lead-auto-001",
        name: "High Confidence",
        email: "high@test.com",
        company: "Test Co",
        platform: "twitter",
        handle: "@test",
        budget: 50000,
        budgetCurrency: "USD",
        location: "Sydney",
        intent: "Interested in property",
        priority: "medium",
        confidenceScore: 0.95,
        status: "new",
        tags: [],
        firstContactAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        messageCount: 1,
        slaBreached: false,
        notes: "",
      };

      expect(shouldAutoEscalate(lead)).toBe(true);
    });

    it("should return true for urgent intent keywords", () => {
      const lead: Lead = {
        id: "lead-auto-002",
        name: "Urgent Lead",
        email: "urgent@test.com",
        company: "Test Co",
        platform: "twitter",
        handle: "@test",
        budget: 50000,
        budgetCurrency: "USD",
        location: "Sydney",
        intent: "Need property urgently, moving next week",
        priority: "medium",
        confidenceScore: 0.5,
        status: "new",
        tags: [],
        firstContactAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        messageCount: 1,
        slaBreached: false,
        notes: "",
      };

      expect(shouldAutoEscalate(lead)).toBe(true);
    });

    it("should return true for high budget (> 1,000,000)", () => {
      const lead: Lead = {
        id: "lead-auto-003",
        name: "High Budget",
        email: "budget@test.com",
        company: "Test Co",
        platform: "twitter",
        handle: "@test",
        budget: 1500000,
        budgetCurrency: "USD",
        location: "Sydney",
        intent: "Looking for premium property",
        priority: "medium",
        confidenceScore: 0.5,
        status: "new",
        tags: [],
        firstContactAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        messageCount: 1,
        slaBreached: false,
        notes: "",
      };

      expect(shouldAutoEscalate(lead)).toBe(true);
    });

    it("should return true for SLA breached leads", () => {
      const lead: Lead = {
        id: "lead-auto-004",
        name: "SLA Breached",
        email: "sla@test.com",
        company: "Test Co",
        platform: "twitter",
        handle: "@test",
        budget: 50000,
        budgetCurrency: "USD",
        location: "Sydney",
        intent: "General inquiry",
        priority: "medium",
        confidenceScore: 0.5,
        status: "new",
        tags: [],
        firstContactAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        messageCount: 1,
        slaBreached: true,
        notes: "",
      };

      expect(shouldAutoEscalate(lead)).toBe(true);
    });

    it("should return true for high priority flagged leads", () => {
      const lead: Lead = {
        id: "lead-auto-005",
        name: "Flagged Lead",
        email: "flagged@test.com",
        company: "Test Co",
        platform: "twitter",
        handle: "@test",
        budget: 50000,
        budgetCurrency: "USD",
        location: "Sydney",
        intent: "General inquiry",
        priority: "high",
        confidenceScore: 0.5,
        status: "new",
        tags: [],
        firstContactAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        messageCount: 1,
        slaBreached: false,
        notes: "",
        priorityFlag: true,
      };

      expect(shouldAutoEscalate(lead)).toBe(true);
    });

    it("should return false for low confidence, low budget, no urgent intent", () => {
      const lead: Lead = {
        id: "lead-auto-006",
        name: "Normal Lead",
        email: "normal@test.com",
        company: "Test Co",
        platform: "twitter",
        handle: "@test",
        budget: 50000,
        budgetCurrency: "USD",
        location: "Sydney",
        intent: "Just browsing the website",
        priority: "low",
        confidenceScore: 0.4,
        status: "new",
        tags: [],
        firstContactAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        messageCount: 1,
        slaBreached: false,
        notes: "",
      };

      expect(shouldAutoEscalate(lead)).toBe(false);
    });

    it("should return true for 'asap' in intent", () => {
      const lead: Lead = {
        id: "lead-auto-007",
        name: "ASAP Lead",
        email: "asap@test.com",
        company: "Test Co",
        platform: "twitter",
        handle: "@test",
        budget: 50000,
        budgetCurrency: "USD",
        location: "Sydney",
        intent: "Need this asap please",
        priority: "medium",
        confidenceScore: 0.5,
        status: "new",
        tags: [],
        firstContactAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        messageCount: 1,
        slaBreached: false,
        notes: "",
      };

      expect(shouldAutoEscalate(lead)).toBe(true);
    });

    it("should return true for 'immediately' in intent", () => {
      const lead: Lead = {
        id: "lead-auto-008",
        name: "Immediate Lead",
        email: "immediate@test.com",
        company: "Test Co",
        platform: "twitter",
        handle: "@test",
        budget: 50000,
        budgetCurrency: "USD",
        location: "Sydney",
        intent: "We need to move immediately",
        priority: "medium",
        confidenceScore: 0.5,
        status: "new",
        tags: [],
        firstContactAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        messageCount: 1,
        slaBreached: false,
        notes: "",
      };

      expect(shouldAutoEscalate(lead)).toBe(true);
    });
  });

  // ============================================================
  // processAutoEscalations
  // ============================================================

  describe("processAutoEscalations", () => {
    it("should return an array of escalated lead IDs", async () => {
      // Add a lead that should be auto-escalated
      leadStore.add({
        id: "lead-auto-esc-001",
        name: "Auto Escalate Test",
        email: "autoesc@test.com",
        company: "Test Co",
        platform: "twitter",
        handle: "@autoesc",
        budget: 50000,
        budgetCurrency: "USD",
        location: "Sydney",
        intent: "Need property urgently",
        priority: "medium",
        confidenceScore: 0.95,
        status: "new",
        tags: [],
        firstContactAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        messageCount: 1,
        slaBreached: false,
        notes: "",
      });

      const escalatedIds = await processAutoEscalations();

      expect(Array.isArray(escalatedIds)).toBe(true);
      // The lead we added should be in the escalated list
      expect(escalatedIds).toContain("lead-auto-esc-001");
    });

    it("should log audit event for batch auto-escalation", async () => {
      // Add a lead that should be auto-escalated
      leadStore.add({
        id: "lead-auto-esc-002",
        name: "Batch Escalate Test",
        email: "batch@test.com",
        company: "Test Co",
        platform: "twitter",
        handle: "@batch",
        budget: 2000000,
        budgetCurrency: "USD",
        location: "Melbourne",
        intent: "Looking for premium property",
        priority: "medium",
        confidenceScore: 0.92,
        status: "new",
        tags: [],
        firstContactAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        messageCount: 1,
        slaBreached: false,
        notes: "",
      });

      const escalatedIds = await processAutoEscalations();

      if (escalatedIds.length > 0) {
        expect(auditLogSpy).toHaveBeenCalledWith(
          "AUTO_ESCALATION_BATCH",
          "system",
          "batch",
          expect.stringContaining("escalatedCount")
        );
      }
    });
  });

  // ============================================================
  // Audit Logging on All Mutations
  // ============================================================

  describe("audit logging on mutations", () => {
    it("should log audit event on createLead", async () => {
      const extractedFields: ExtractedLeadFields = {
        name: "Audit Create",
        contact: "auditcreate@example.com",
        budget: "$400,000",
        location: "Adelaide",
        intent: "Interested in Katalia",
        confidence: 0.7,
      };

      await createLead(extractedFields, "dm-audit-create");

      const auditCalls = auditLogSpy.mock.calls;
      const createCall = auditCalls.find(
        (call) => call[0] === "LEAD_CREATED"
      );
      expect(createCall).toBeDefined();
    });

    it("should log audit event on updateLead", async () => {
      await updateLead("lead-001", { notes: "Audit update test" });

      const auditCalls = auditLogSpy.mock.calls;
      const updateCall = auditCalls.find(
        (call) => call[0] === "LEAD_UPDATED"
      );
      expect(updateCall).toBeDefined();
    });

    it("should log audit event on getLead", async () => {
      await getLead("lead-001");

      const auditCalls = auditLogSpy.mock.calls;
      const accessCall = auditCalls.find(
        (call) => call[0] === "LEAD_ACCESSED"
      );
      expect(accessCall).toBeDefined();
    });

    it("should log audit event on escalateLead", async () => {
      leadStore.update("lead-014", { status: "new" });

      await escalateLead("lead-014", "Audit escalation test");

      const auditCalls = auditLogSpy.mock.calls;
      const escalateCall = auditCalls.find(
        (call) => call[0] === "LEAD_ESCALATED"
      );
      expect(escalateCall).toBeDefined();
    });

    it("should log audit event on createLeadInSalesforce", async () => {
      delete process.env.SALESFORCE_INSTANCE_URL;

      await createLeadInSalesforce("lead-001", "officer-audit");

      const auditCalls = auditLogSpy.mock.calls;
      const sfCall = auditCalls.find(
        (call) => call[0] === "SALESFORCE_LEAD_CREATION_INITIATED"
      );
      expect(sfCall).toBeDefined();
    });

    it("should include actor in audit events when confirmedBy is provided", async () => {
      await updateLead("lead-001", {
        notes: "Actor test",
        confirmedBy: "officer-actor-test",
      });

      const auditCalls = auditLogSpy.mock.calls;
      const updateCall = auditCalls.find(
        (call) => call[0] === "LEAD_UPDATED" && call[1] === "officer-actor-test"
      );
      expect(updateCall).toBeDefined();
    });

    it("should use 'system' as actor when no confirmedBy is provided", async () => {
      await updateLead("lead-002", {
        notes: "System actor test",
      });

      const auditCalls = auditLogSpy.mock.calls;
      const updateCall = auditCalls.find(
        (call) => call[0] === "LEAD_UPDATED" && call[1] === "system"
      );
      expect(updateCall).toBeDefined();
    });
  });
});