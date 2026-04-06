import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { dmStore } from "@/lib/stores/dm-store";
import { draftStore } from "@/lib/stores/draft-store";
import type { DMRecord } from "@/lib/stores/dm-store";
import type { DraftResponse } from "@/lib/types";

// Mock the audit logger before importing the service
vi.mock("@/lib/services/audit-logger", () => {
  return {
    default: {
      logEvent: vi.fn().mockResolvedValue({
        id: "audit-mock-id",
        action: "mock",
        actor: "system",
        timestamp: new Date().toISOString(),
        entityRef: "mock",
        details: "{}",
      }),
      getAuditLogs: vi.fn().mockResolvedValue([]),
    },
  };
});

// Mock the knowledge base adapter
vi.mock("@/lib/services/knowledge-base-adapter", () => {
  return {
    searchKnowledge: vi.fn().mockResolvedValue([
      {
        id: "kb-001",
        category: "pricing",
        question: "What is the price range for land lots at Stockland Willowdale?",
        answer:
          "Land lots at Stockland Willowdale start from $420,000 for a standard 300sqm lot.",
        propertyInfo: {
          community: "Willowdale",
          location: "Leppington, NSW",
          priceRange: "$420,000 - $750,000",
        },
        tags: ["pricing", "land", "willowdale"],
        relevanceScore: 0.85,
      },
      {
        id: "kb-005",
        category: "faq",
        question: "What is the process for purchasing a lot at a Stockland community?",
        answer:
          "The purchase process involves several steps: 1) Visit our sales centre...",
        propertyInfo: null,
        tags: ["process", "purchasing"],
        relevanceScore: 0.45,
      },
    ]),
    clearKnowledgeBaseCache: vi.fn(),
  };
});

// Mock the PII scrubber
vi.mock("@/lib/services/pii-scrubber", () => {
  return {
    scrubPII: vi.fn((text: string) => {
      if (!text) return text;
      return text
        .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, "[REDACTED EMAIL]")
        .replace(
          /(?:\+?61[\s\-]?)?(?:\(0[2-9]\)[\s\-]?\d{4}[\s\-]?\d{4}|0[2-9][\s\-]?\d{4}[\s\-]?\d{4}|04\d{2}[\s\-]?\d{3}[\s\-]?\d{3})/g,
          "[REDACTED PHONE]"
        );
    }),
    containsPII: vi.fn((text: string) => {
      if (!text) return false;
      return /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(text);
    }),
  };
});

// Mock the compliance guardrails
vi.mock("@/lib/compliance/compliance-guardrails", () => {
  return {
    validateDraftForSending: vi.fn(
      (
        draft: {
          approved: boolean;
          reviewedBy: string | null;
          editedContent: string | null;
          content: string;
          confidence: number;
          id: string;
        },
        reviewerId: string
      ) => {
        const violations: Array<{
          id: string;
          rule: string;
          severity: string;
          message: string;
          timestamp: string;
        }> = [];
        const now = new Date().toISOString();

        if (!reviewerId || reviewerId.trim().length === 0) {
          violations.push({
            id: "v-1",
            rule: "HUMAN_IN_THE_LOOP",
            severity: "critical",
            message: "A valid reviewer ID is required.",
            timestamp: now,
          });
        }

        if (!draft.approved) {
          violations.push({
            id: "v-2",
            rule: "DRAFT_NOT_APPROVED",
            severity: "critical",
            message: "Draft must be explicitly approved before sending.",
            timestamp: now,
          });
        }

        if (!draft.reviewedBy) {
          violations.push({
            id: "v-3",
            rule: "NO_REVIEWER_ASSIGNED",
            severity: "critical",
            message: "Draft has not been reviewed by any user.",
            timestamp: now,
          });
        }

        const content = draft.editedContent || draft.content;
        if (!content || content.trim().length === 0) {
          violations.push({
            id: "v-4",
            rule: "EMPTY_CONTENT",
            severity: "critical",
            message: "Draft content cannot be empty.",
            timestamp: now,
          });
        }

        if (draft.confidence < 0.6) {
          violations.push({
            id: "v-5",
            rule: "LOW_CONFIDENCE_REVIEW",
            severity: "warning",
            message: `Draft confidence (${draft.confidence.toFixed(2)}) is below threshold.`,
            timestamp: now,
          });
        }

        return violations;
      }
    ),
    scrubForLLM: vi.fn((text: string) => text),
    validateLeadScoring: vi.fn(() => []),
    checkComplianceViolations: vi.fn(() => []),
    getAuditLog: vi.fn(() => []),
    clearAuditLog: vi.fn(),
  };
});

import { generateDraft, submitDraft } from "@/lib/services/draft-generation-service";
import { searchKnowledge } from "@/lib/services/knowledge-base-adapter";
import { scrubPII } from "@/lib/services/pii-scrubber";
import { validateDraftForSending } from "@/lib/compliance/compliance-guardrails";
import auditLogger from "@/lib/services/audit-logger";

// ----- Test Helpers -----

function createTestDM(overrides: Partial<DMRecord> = {}): DMRecord {
  const defaults: DMRecord = {
    id: "dm-test-001",
    platform: "facebook",
    conversationId: "conv-test-001",
    sender: {
      id: "user-test-001",
      name: "Test User",
      handle: "testuser",
      avatarUrl: "https://i.pravatar.cc/150?u=testuser",
    },
    content:
      "Hi, I'm interested in the Willowdale community. What are the prices for a 3-bedroom?",
    timestamp: new Date().toISOString(),
    intent: "pricing",
    status: "new",
    priority: "high",
    confidenceScore: 0.9,
    slaDeadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    metadata: {
      communityName: "Willowdale",
      propertyType: "house_and_land",
      bedrooms: 3,
    },
  };

  return { ...defaults, ...overrides };
}

function createTestDraft(overrides: Partial<DraftResponse> = {}): DraftResponse {
  const defaults: DraftResponse = {
    id: "draft-test-001",
    dmId: "dm-test-001",
    content: "Thank you for your interest in Willowdale!",
    confidence: 0.85,
    reviewedBy: null,
    approved: false,
    editedContent: null,
  };

  return { ...defaults, ...overrides };
}

// ----- Tests -----

describe("draft-generation-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any test DMs and drafts added during tests
    // The stores are singletons so we need to be careful
  });

  // ============================================================
  // generateDraft
  // ============================================================

  describe("generateDraft", () => {
    it("should generate a draft with a confidence score", async () => {
      const testDM = createTestDM();
      dmStore.add(testDM);

      const result = await generateDraft(testDM.id);

      expect(result).toBeDefined();
      expect(result.draft).toBeDefined();
      expect(result.draft.dmId).toBe(testDM.id);
      expect(result.draft.content).toBeDefined();
      expect(result.draft.content.length).toBeGreaterThan(0);
      expect(result.draft.confidence).toBeGreaterThanOrEqual(0);
      expect(result.draft.confidence).toBeLessThanOrEqual(1);
      expect(result.draft.approved).toBe(false);
      expect(result.draft.reviewedBy).toBeNull();
    });

    it("should retrieve knowledge base context for the DM", async () => {
      const testDM = createTestDM({ id: "dm-test-kb-context" });
      dmStore.add(testDM);

      const result = await generateDraft(testDM.id);

      expect(searchKnowledge).toHaveBeenCalled();
      expect(result.context).toBeDefined();
      expect(result.context.length).toBeGreaterThan(0);
      expect(result.context[0].relevanceScore).toBeDefined();
      expect(result.context[0].relevanceScore).toBeGreaterThan(0);
    });

    it("should scrub PII from DM content before LLM call", async () => {
      const testDM = createTestDM({
        id: "dm-test-pii-scrub",
        content:
          "Hi, my email is john@example.com and I want to know about Willowdale pricing.",
        sender: {
          id: "user-pii",
          name: "John Doe",
          handle: "johndoe",
          avatarUrl: "https://i.pravatar.cc/150?u=johndoe",
        },
      });
      dmStore.add(testDM);

      await generateDraft(testDM.id);

      // Verify scrubPII was called with the DM content
      expect(scrubPII).toHaveBeenCalledWith(testDM.content);
      // Verify scrubPII was called with the sender name
      expect(scrubPII).toHaveBeenCalledWith(testDM.sender.name);
    });

    it("should compute confidence based on knowledge base match quality", async () => {
      const testDM = createTestDM({ id: "dm-test-confidence-calc" });
      dmStore.add(testDM);

      const result = await generateDraft(testDM.id);

      // With our mocked knowledge base returning entries with relevanceScore 0.85 and 0.45,
      // the confidence should be computed from those scores
      expect(result.draft.confidence).toBeGreaterThan(0.1);
      expect(result.draft.confidence).toBeLessThanOrEqual(0.98);
    });

    it("should flag low-confidence drafts correctly", async () => {
      // Mock searchKnowledge to return no results for this test
      vi.mocked(searchKnowledge).mockResolvedValueOnce([]);

      const testDM = createTestDM({ id: "dm-test-low-confidence" });
      dmStore.add(testDM);

      const result = await generateDraft(testDM.id);

      // With no knowledge base context, confidence should be low (0.3)
      expect(result.draft.confidence).toBeLessThanOrEqual(0.5);
      expect(result.context).toHaveLength(0);
    });

    it("should store the draft in the draft store", async () => {
      const testDM = createTestDM({ id: "dm-test-store-draft" });
      dmStore.add(testDM);

      const result = await generateDraft(testDM.id);

      const storedDraft = draftStore.getById(result.draft.id);
      expect(storedDraft).toBeDefined();
      expect(storedDraft!.dmId).toBe(testDM.id);
      expect(storedDraft!.content).toBe(result.draft.content);
    });

    it("should update DM status to drafted", async () => {
      const testDM = createTestDM({ id: "dm-test-status-update" });
      dmStore.add(testDM);

      await generateDraft(testDM.id);

      const updatedDM = dmStore.getById(testDM.id);
      expect(updatedDM).toBeDefined();
      expect(updatedDM!.status).toBe("drafted");
    });

    it("should log an audit event for draft generation", async () => {
      const testDM = createTestDM({ id: "dm-test-audit-gen" });
      dmStore.add(testDM);

      await generateDraft(testDM.id);

      expect(auditLogger.logEvent).toHaveBeenCalledWith(
        "DRAFT_GENERATED",
        "system",
        testDM.id,
        expect.any(String)
      );
    });

    it("should throw error when DM is not found", async () => {
      await expect(generateDraft("dm-nonexistent-999")).rejects.toThrow(
        "DM not found: dm-nonexistent-999"
      );
    });

    it("should throw error when draft is already approved", async () => {
      const testDM = createTestDM({ id: "dm-test-already-approved" });
      dmStore.add(testDM);

      // Add an approved draft for this DM
      draftStore.add({
        id: "draft-already-approved",
        dmId: testDM.id,
        content: "Already approved content",
        confidence: 0.9,
        reviewedBy: "officer-1",
        approved: true,
        editedContent: null,
      });

      await expect(generateDraft(testDM.id)).rejects.toThrow(
        "has already been approved"
      );
    });

    it("should handle knowledge base search failure gracefully", async () => {
      vi.mocked(searchKnowledge).mockRejectedValueOnce(
        new Error("Knowledge base unavailable")
      );

      const testDM = createTestDM({ id: "dm-test-kb-failure" });
      dmStore.add(testDM);

      // Should not throw — falls back to empty context
      const result = await generateDraft(testDM.id);

      expect(result).toBeDefined();
      expect(result.draft.content).toBeDefined();
      expect(result.draft.content.length).toBeGreaterThan(0);
      expect(result.context).toHaveLength(0);
    });

    it("should generate a simulated response when no API key is configured", async () => {
      const testDM = createTestDM({ id: "dm-test-simulated" });
      dmStore.add(testDM);

      // OPENAI_API_KEY is not set in test environment, so it should use simulated response
      const result = await generateDraft(testDM.id);

      expect(result.draft.content).toBeDefined();
      expect(result.draft.content.length).toBeGreaterThan(0);
    });

    it("should update existing draft when regenerating", async () => {
      const testDM = createTestDM({ id: "dm-test-regenerate" });
      dmStore.add(testDM);

      // Add an existing unapproved draft
      const existingDraft = draftStore.add({
        id: "draft-existing-regen",
        dmId: testDM.id,
        content: "Old draft content",
        confidence: 0.5,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      });

      const result = await generateDraft(testDM.id);

      expect(result.draft.id).toBe(existingDraft.id);
      // Content should be updated (regenerated)
      expect(result.draft.content).toBeDefined();
      expect(result.draft.content.length).toBeGreaterThan(0);
    });

    it("should include community name in knowledge base search query", async () => {
      const testDM = createTestDM({
        id: "dm-test-community-search",
        metadata: {
          communityName: "Aura",
          propertyType: "land",
          bedrooms: null,
        },
      });
      dmStore.add(testDM);

      await generateDraft(testDM.id);

      expect(searchKnowledge).toHaveBeenCalledWith(
        expect.stringContaining("Aura"),
        5,
        0.01
      );
    });
  });

  // ============================================================
  // submitDraft
  // ============================================================

  describe("submitDraft", () => {
    it("should submit a draft after human review", async () => {
      const testDM = createTestDM({ id: "dm-test-submit" });
      dmStore.add(testDM);

      const draft = draftStore.add({
        id: "draft-test-submit",
        dmId: testDM.id,
        content: "Thank you for your interest in Willowdale!",
        confidence: 0.85,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      });

      const result = await submitDraft(draft.id, "officer-123");

      expect(result).toBeDefined();
      expect(result.draft).toBeDefined();
      expect(result.dmId).toBe(testDM.id);
      expect(result.sentAt).toBeDefined();
    });

    it("should enforce human-in-the-loop review", async () => {
      const testDM = createTestDM({ id: "dm-test-hitl" });
      dmStore.add(testDM);

      const draft = draftStore.add({
        id: "draft-test-hitl",
        dmId: testDM.id,
        content: "Response content",
        confidence: 0.85,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      });

      const result = await submitDraft(draft.id, "officer-456");

      // validateDraftForSending should have been called
      expect(validateDraftForSending).toHaveBeenCalled();

      // The draft should be approved after submission
      expect(result.draft.approved).toBe(true);
      expect(result.draft.reviewedBy).toBe("officer-456");
    });

    it("should reject submission without a reviewer ID", async () => {
      const testDM = createTestDM({ id: "dm-test-no-reviewer" });
      dmStore.add(testDM);

      const draft = draftStore.add({
        id: "draft-test-no-reviewer",
        dmId: testDM.id,
        content: "Response content",
        confidence: 0.85,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      });

      // Empty reviewer ID should trigger compliance violation
      await expect(submitDraft(draft.id, "")).rejects.toThrow(
        "Compliance violations"
      );
    });

    it("should apply edited content when provided", async () => {
      const testDM = createTestDM({ id: "dm-test-edit" });
      dmStore.add(testDM);

      const draft = draftStore.add({
        id: "draft-test-edit",
        dmId: testDM.id,
        content: "Original draft content",
        confidence: 0.85,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      });

      const editedText = "Edited and improved response content";
      const result = await submitDraft(draft.id, "officer-789", editedText);

      expect(result.draft.editedContent).toBe(editedText);
    });

    it("should update DM status to sent after submission", async () => {
      const testDM = createTestDM({ id: "dm-test-sent-status" });
      dmStore.add(testDM);

      const draft = draftStore.add({
        id: "draft-test-sent-status",
        dmId: testDM.id,
        content: "Response content",
        confidence: 0.85,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      });

      await submitDraft(draft.id, "officer-101");

      const updatedDM = dmStore.getById(testDM.id);
      expect(updatedDM).toBeDefined();
      expect(updatedDM!.status).toBe("sent");
    });

    it("should log an audit event for draft submission", async () => {
      const testDM = createTestDM({ id: "dm-test-audit-submit" });
      dmStore.add(testDM);

      const draft = draftStore.add({
        id: "draft-test-audit-submit",
        dmId: testDM.id,
        content: "Response content",
        confidence: 0.85,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      });

      await submitDraft(draft.id, "officer-202");

      expect(auditLogger.logEvent).toHaveBeenCalledWith(
        "DRAFT_SUBMITTED",
        "officer-202",
        draft.id,
        expect.any(String)
      );
    });

    it("should throw error when draft is not found", async () => {
      await expect(
        submitDraft("draft-nonexistent-999", "officer-123")
      ).rejects.toThrow("Draft not found: draft-nonexistent-999");
    });

    it("should throw error when DM for draft is not found", async () => {
      const orphanDraft = draftStore.add({
        id: "draft-orphan",
        dmId: "dm-nonexistent-orphan",
        content: "Orphan draft content",
        confidence: 0.85,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      });

      await expect(
        submitDraft(orphanDraft.id, "officer-123")
      ).rejects.toThrow("DM not found for draft");
    });

    it("should reject submission when compliance violations are critical", async () => {
      const testDM = createTestDM({ id: "dm-test-compliance-reject" });
      dmStore.add(testDM);

      const draft = draftStore.add({
        id: "draft-test-compliance-reject",
        dmId: testDM.id,
        content: "",
        confidence: 0.3,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      });

      // Empty reviewer ID + empty content + low confidence = critical violations
      await expect(submitDraft(draft.id, "")).rejects.toThrow(
        "Compliance violations"
      );
    });

    it("should log rejection audit event on compliance failure", async () => {
      const testDM = createTestDM({ id: "dm-test-reject-audit" });
      dmStore.add(testDM);

      const draft = draftStore.add({
        id: "draft-test-reject-audit",
        dmId: testDM.id,
        content: "",
        confidence: 0.3,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      });

      try {
        await submitDraft(draft.id, "");
      } catch {
        // Expected to throw
      }

      expect(auditLogger.logEvent).toHaveBeenCalledWith(
        "DRAFT_SUBMIT_REJECTED",
        expect.any(String),
        draft.id,
        expect.any(String)
      );
    });

    it("should revert approval on critical compliance violations", async () => {
      const testDM = createTestDM({ id: "dm-test-revert-approval" });
      dmStore.add(testDM);

      const draft = draftStore.add({
        id: "draft-test-revert-approval",
        dmId: testDM.id,
        content: "",
        confidence: 0.3,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      });

      try {
        await submitDraft(draft.id, "");
      } catch {
        // Expected to throw
      }

      const revertedDraft = draftStore.getById(draft.id);
      expect(revertedDraft).toBeDefined();
      expect(revertedDraft!.approved).toBe(false);
    });

    it("should include sentAt timestamp in result", async () => {
      const testDM = createTestDM({ id: "dm-test-sent-at" });
      dmStore.add(testDM);

      const draft = draftStore.add({
        id: "draft-test-sent-at",
        dmId: testDM.id,
        content: "Response content",
        confidence: 0.85,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      });

      const beforeSubmit = new Date().toISOString();
      const result = await submitDraft(draft.id, "officer-303");

      expect(result.sentAt).toBeDefined();
      const sentAtTime = new Date(result.sentAt).getTime();
      const beforeTime = new Date(beforeSubmit).getTime();
      expect(sentAtTime).toBeGreaterThanOrEqual(beforeTime - 1000);
    });
  });

  // ============================================================
  // Integration-like scenarios
  // ============================================================

  describe("end-to-end draft workflow", () => {
    it("should generate and then submit a draft successfully", async () => {
      const testDM = createTestDM({ id: "dm-test-e2e" });
      dmStore.add(testDM);

      // Step 1: Generate draft
      const genResult = await generateDraft(testDM.id);
      expect(genResult.draft).toBeDefined();
      expect(genResult.draft.approved).toBe(false);

      // Verify DM status is drafted
      const draftedDM = dmStore.getById(testDM.id);
      expect(draftedDM!.status).toBe("drafted");

      // Step 2: Submit draft with human review
      const submitResult = await submitDraft(
        genResult.draft.id,
        "officer-e2e",
        "Reviewed and edited response"
      );

      expect(submitResult.draft.approved).toBe(true);
      expect(submitResult.draft.reviewedBy).toBe("officer-e2e");
      expect(submitResult.draft.editedContent).toBe(
        "Reviewed and edited response"
      );

      // Verify DM status is sent
      const sentDM = dmStore.getById(testDM.id);
      expect(sentDM!.status).toBe("sent");
    });

    it("should handle DM with PII in content throughout the workflow", async () => {
      const testDM = createTestDM({
        id: "dm-test-e2e-pii",
        content:
          "Hi, I'm Sarah at sarah@test.com, interested in Willowdale. Call me on 0412 345 678.",
      });
      dmStore.add(testDM);

      const result = await generateDraft(testDM.id);

      // PII should have been scrubbed before LLM call
      expect(scrubPII).toHaveBeenCalledWith(testDM.content);

      // Draft should still be generated successfully
      expect(result.draft.content).toBeDefined();
      expect(result.draft.content.length).toBeGreaterThan(0);
    });
  });
});