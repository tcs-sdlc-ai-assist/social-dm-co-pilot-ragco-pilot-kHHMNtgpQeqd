import { describe, it, expect, beforeEach } from "vitest";
import {
  validateDraftForSending,
  scrubForLLM,
  validateLeadScoring,
  checkComplianceViolations,
  getAuditLog,
  clearAuditLog,
} from "@/lib/compliance/compliance-guardrails";
import type {
  DraftForReview,
  LeadScoringData,
  ComplianceViolation,
} from "@/lib/compliance/compliance-guardrails";

describe("compliance-guardrails", () => {
  beforeEach(() => {
    clearAuditLog();
  });

  // ============================================================
  // PII Scrubbing for LLM Submission
  // ============================================================

  describe("scrubForLLM", () => {
    it("should redact email addresses", () => {
      const input = "Contact me at john.doe@example.com for details.";
      const result = scrubForLLM(input);
      expect(result).not.toContain("john.doe@example.com");
      expect(result).toContain("[EMAIL_REDACTED]");
    });

    it("should redact Australian phone numbers", () => {
      const input = "Call me on 0412 345 678 or +61 2 9876 5432.";
      const result = scrubForLLM(input);
      expect(result).not.toContain("0412 345 678");
      expect(result).toContain("[PHONE_REDACTED]");
    });

    it("should redact international phone numbers", () => {
      const input = "My number is +44 20 7946 0958.";
      const result = scrubForLLM(input);
      expect(result).not.toContain("+44 20 7946 0958");
      expect(result).toContain("[PHONE_REDACTED]");
    });

    it("should redact credit card numbers", () => {
      const input = "My card is 4111 1111 1111 1111.";
      const result = scrubForLLM(input);
      expect(result).not.toContain("4111 1111 1111 1111");
      expect(result).toContain("[CC_REDACTED]");
    });

    it("should redact Tax File Numbers", () => {
      const input = "My TFN is 123 456 789.";
      const result = scrubForLLM(input);
      expect(result).not.toContain("123 456 789");
      expect(result).toContain("[TFN_REDACTED]");
    });

    it("should redact street addresses", () => {
      const input = "I live at 42 Smith Street in Sydney.";
      const result = scrubForLLM(input);
      expect(result).not.toContain("42 Smith Street");
      expect(result).toContain("[ADDRESS_REDACTED]");
    });

    it("should redact date of birth patterns", () => {
      const input = "DOB: 15/03/1990 is my birthday.";
      const result = scrubForLLM(input);
      expect(result).not.toContain("15/03/1990");
      expect(result).toContain("[DOB_REDACTED]");
    });

    it("should redact Australian postcodes with state", () => {
      const input = "Located in NSW 2000 area.";
      const result = scrubForLLM(input);
      expect(result).not.toContain("NSW 2000");
      expect(result).toContain("[POSTCODE_REDACTED]");
    });

    it("should redact multiple PII types in one string", () => {
      const input =
        "Email john@test.com, phone 0412 345 678, address 10 King Street.";
      const result = scrubForLLM(input);
      expect(result).not.toContain("john@test.com");
      expect(result).not.toContain("0412 345 678");
      expect(result).not.toContain("10 King Street");
      expect(result).toContain("[EMAIL_REDACTED]");
      expect(result).toContain("[PHONE_REDACTED]");
      expect(result).toContain("[ADDRESS_REDACTED]");
    });

    it("should return empty string for empty input", () => {
      expect(scrubForLLM("")).toBe("");
    });

    it("should return empty string for whitespace-only input", () => {
      expect(scrubForLLM("   ")).toBe("   ");
    });

    it("should not modify text without PII", () => {
      const input = "I am interested in the Willowdale community.";
      const result = scrubForLLM(input);
      expect(result).toBe(input);
    });

    it("should log an audit event when PII is found", () => {
      scrubForLLM("Contact me at test@example.com");
      const log = getAuditLog();
      expect(log.length).toBeGreaterThanOrEqual(1);
      const lastEvent = log[log.length - 1];
      expect(lastEvent.action).toBe("SCRUB_FOR_LLM");
      const details = JSON.parse(lastEvent.details);
      expect(details.piiFound).toBe(true);
      expect(details.piiTypesRedacted).toContain("email");
    });

    it("should log an audit event when no PII is found", () => {
      scrubForLLM("Hello world");
      const log = getAuditLog();
      expect(log.length).toBeGreaterThanOrEqual(1);
      const lastEvent = log[log.length - 1];
      expect(lastEvent.action).toBe("SCRUB_FOR_LLM");
      const details = JSON.parse(lastEvent.details);
      expect(details.piiFound).toBe(false);
    });

    it("should log an audit event for empty input", () => {
      scrubForLLM("");
      const log = getAuditLog();
      expect(log.length).toBeGreaterThanOrEqual(1);
      const lastEvent = log[log.length - 1];
      expect(lastEvent.action).toBe("SCRUB_FOR_LLM");
    });
  });

  // ============================================================
  // Human-in-the-Loop Enforcement for Draft Sending
  // ============================================================

  describe("validateDraftForSending", () => {
    const validDraft: DraftForReview = {
      id: "draft-001",
      dmId: "dm-001",
      content: "Thank you for your interest in Willowdale!",
      confidence: 0.92,
      reviewedBy: "officer-123",
      approved: true,
      editedContent: null,
    };

    it("should return no violations for a valid approved draft", () => {
      const violations = validateDraftForSending(validDraft, "officer-123");
      expect(violations).toHaveLength(0);
    });

    it("should return critical violation when draft is not approved", () => {
      const draft: DraftForReview = { ...validDraft, approved: false };
      const violations = validateDraftForSending(draft, "officer-123");
      const approvalViolation = violations.find(
        (v) => v.rule === "DRAFT_NOT_APPROVED"
      );
      expect(approvalViolation).toBeDefined();
      expect(approvalViolation!.severity).toBe("critical");
    });

    it("should return critical violation when no reviewer is assigned", () => {
      const draft: DraftForReview = { ...validDraft, reviewedBy: null };
      const violations = validateDraftForSending(draft, "officer-123");
      const reviewerViolation = violations.find(
        (v) => v.rule === "NO_REVIEWER_ASSIGNED"
      );
      expect(reviewerViolation).toBeDefined();
      expect(reviewerViolation!.severity).toBe("critical");
    });

    it("should return critical violation when reviewer ID is empty", () => {
      const violations = validateDraftForSending(validDraft, "");
      const violation = violations.find(
        (v) => v.rule === "HUMAN_IN_THE_LOOP"
      );
      expect(violation).toBeDefined();
      expect(violation!.severity).toBe("critical");
    });

    it("should return warning when sender differs from reviewer", () => {
      const violations = validateDraftForSending(validDraft, "different-user");
      const mismatchViolation = violations.find(
        (v) => v.rule === "REVIEWER_MISMATCH"
      );
      expect(mismatchViolation).toBeDefined();
      expect(mismatchViolation!.severity).toBe("warning");
    });

    it("should return critical violation when content is empty", () => {
      const draft: DraftForReview = { ...validDraft, content: "", editedContent: "" };
      const violations = validateDraftForSending(draft, "officer-123");
      const emptyViolation = violations.find(
        (v) => v.rule === "EMPTY_CONTENT"
      );
      expect(emptyViolation).toBeDefined();
      expect(emptyViolation!.severity).toBe("critical");
    });

    it("should return warning when confidence is below threshold", () => {
      const draft: DraftForReview = { ...validDraft, confidence: 0.45 };
      const violations = validateDraftForSending(draft, "officer-123");
      const lowConfViolation = violations.find(
        (v) => v.rule === "LOW_CONFIDENCE_REVIEW"
      );
      expect(lowConfViolation).toBeDefined();
      expect(lowConfViolation!.severity).toBe("warning");
    });

    it("should not flag low confidence when confidence is at threshold", () => {
      const draft: DraftForReview = { ...validDraft, confidence: 0.6 };
      const violations = validateDraftForSending(draft, "officer-123");
      const lowConfViolation = violations.find(
        (v) => v.rule === "LOW_CONFIDENCE_REVIEW"
      );
      expect(lowConfViolation).toBeUndefined();
    });

    it("should return multiple violations for a completely invalid draft", () => {
      const draft: DraftForReview = {
        id: "draft-bad",
        dmId: "dm-bad",
        content: "",
        confidence: 0.3,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      };
      const violations = validateDraftForSending(draft, "");
      expect(violations.length).toBeGreaterThanOrEqual(3);
      const rules = violations.map((v) => v.rule);
      expect(rules).toContain("HUMAN_IN_THE_LOOP");
      expect(rules).toContain("DRAFT_NOT_APPROVED");
      expect(rules).toContain("NO_REVIEWER_ASSIGNED");
    });

    it("should log an audit event for draft validation", () => {
      validateDraftForSending(validDraft, "officer-123");
      const log = getAuditLog();
      const validationEvent = log.find(
        (e) => e.action === "VALIDATE_DRAFT_FOR_SENDING"
      );
      expect(validationEvent).toBeDefined();
      expect(validationEvent!.entityRef).toBe("draft-001");
      expect(validationEvent!.actor).toBe("officer-123");
    });

    it("should use editedContent for empty check when present", () => {
      const draft: DraftForReview = {
        ...validDraft,
        content: "",
        editedContent: "Edited response content",
      };
      const violations = validateDraftForSending(draft, "officer-123");
      const emptyViolation = violations.find(
        (v) => v.rule === "EMPTY_CONTENT"
      );
      expect(emptyViolation).toBeUndefined();
    });

    it("should have unique IDs for each violation", () => {
      const draft: DraftForReview = {
        id: "draft-multi",
        dmId: "dm-multi",
        content: "",
        confidence: 0.3,
        reviewedBy: null,
        approved: false,
        editedContent: null,
      };
      const violations = validateDraftForSending(draft, "");
      const ids = violations.map((v) => v.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should include timestamps on all violations", () => {
      const draft: DraftForReview = { ...validDraft, approved: false };
      const violations = validateDraftForSending(draft, "officer-123");
      for (const violation of violations) {
        expect(violation.timestamp).toBeDefined();
        expect(new Date(violation.timestamp).toISOString()).toBe(
          violation.timestamp
        );
      }
    });
  });

  // ============================================================
  // Demographic-Based Lead Scoring Rejection
  // ============================================================

  describe("validateLeadScoring", () => {
    const validLeadData: LeadScoringData = {
      name: "Sarah Mitchell",
      contact: "sarah@example.com",
      budget: "$500,000",
      location: "Sydney, NSW",
      intent: "Interested in Willowdale 3BR",
      confidence: 0.85,
    };

    it("should return no violations for valid lead data without demographics", () => {
      const violations = validateLeadScoring(validLeadData);
      expect(violations).toHaveLength(0);
    });

    it("should reject lead scoring with age field", () => {
      const leadData: LeadScoringData = { ...validLeadData, age: 35 };
      const violations = validateLeadScoring(leadData);
      const biasViolation = violations.find(
        (v) => v.rule === "DEMOGRAPHIC_BIAS_PROHIBITED"
      );
      expect(biasViolation).toBeDefined();
      expect(biasViolation!.severity).toBe("critical");
      expect(biasViolation!.message).toContain("age");
    });

    it("should reject lead scoring with gender field", () => {
      const leadData: LeadScoringData = { ...validLeadData, gender: "female" };
      const violations = validateLeadScoring(leadData);
      const biasViolation = violations.find(
        (v) => v.rule === "DEMOGRAPHIC_BIAS_PROHIBITED"
      );
      expect(biasViolation).toBeDefined();
      expect(biasViolation!.message).toContain("gender");
    });

    it("should reject lead scoring with ethnicity field", () => {
      const leadData: LeadScoringData = {
        ...validLeadData,
        ethnicity: "Asian",
      };
      const violations = validateLeadScoring(leadData);
      const biasViolation = violations.find(
        (v) => v.rule === "DEMOGRAPHIC_BIAS_PROHIBITED"
      );
      expect(biasViolation).toBeDefined();
      expect(biasViolation!.message).toContain("ethnicity");
    });

    it("should reject lead scoring with religion field", () => {
      const leadData: LeadScoringData = {
        ...validLeadData,
        religion: "Christian",
      };
      const violations = validateLeadScoring(leadData);
      const biasViolation = violations.find(
        (v) => v.rule === "DEMOGRAPHIC_BIAS_PROHIBITED"
      );
      expect(biasViolation).toBeDefined();
      expect(biasViolation!.message).toContain("religion");
    });

    it("should reject lead scoring with nationality field", () => {
      const leadData: LeadScoringData = {
        ...validLeadData,
        nationality: "Australian",
      };
      const violations = validateLeadScoring(leadData);
      const biasViolation = violations.find(
        (v) => v.rule === "DEMOGRAPHIC_BIAS_PROHIBITED"
      );
      expect(biasViolation).toBeDefined();
      expect(biasViolation!.message).toContain("nationality");
    });

    it("should reject lead scoring with maritalStatus field", () => {
      const leadData: LeadScoringData = {
        ...validLeadData,
        maritalStatus: "married",
      };
      const violations = validateLeadScoring(leadData);
      const biasViolation = violations.find(
        (v) => v.rule === "DEMOGRAPHIC_BIAS_PROHIBITED"
      );
      expect(biasViolation).toBeDefined();
      expect(biasViolation!.message).toContain("maritalStatus");
    });

    it("should reject lead scoring with disability field", () => {
      const leadData: LeadScoringData = {
        ...validLeadData,
        disability: "none",
      };
      const violations = validateLeadScoring(leadData);
      const biasViolation = violations.find(
        (v) => v.rule === "DEMOGRAPHIC_BIAS_PROHIBITED"
      );
      expect(biasViolation).toBeDefined();
      expect(biasViolation!.message).toContain("disability");
    });

    it("should reject lead scoring with multiple demographic fields", () => {
      const leadData: LeadScoringData = {
        ...validLeadData,
        age: 28,
        gender: "male",
        ethnicity: "Caucasian",
      };
      const violations = validateLeadScoring(leadData);
      const biasViolation = violations.find(
        (v) => v.rule === "DEMOGRAPHIC_BIAS_PROHIBITED"
      );
      expect(biasViolation).toBeDefined();
      expect(biasViolation!.message).toContain("age");
      expect(biasViolation!.message).toContain("gender");
      expect(biasViolation!.message).toContain("ethnicity");
    });

    it("should allow null demographic fields without violation", () => {
      const leadData: LeadScoringData = {
        ...validLeadData,
        age: null,
        gender: null,
      };
      const violations = validateLeadScoring(leadData);
      const biasViolation = violations.find(
        (v) => v.rule === "DEMOGRAPHIC_BIAS_PROHIBITED"
      );
      expect(biasViolation).toBeUndefined();
    });

    it("should reject negative confidence score", () => {
      const leadData: LeadScoringData = { ...validLeadData, confidence: -0.5 };
      const violations = validateLeadScoring(leadData);
      const confViolation = violations.find(
        (v) => v.rule === "INVALID_CONFIDENCE"
      );
      expect(confViolation).toBeDefined();
      expect(confViolation!.severity).toBe("critical");
    });

    it("should reject confidence score above 1.0", () => {
      const leadData: LeadScoringData = { ...validLeadData, confidence: 1.5 };
      const violations = validateLeadScoring(leadData);
      const confViolation = violations.find(
        (v) => v.rule === "INVALID_CONFIDENCE"
      );
      expect(confViolation).toBeDefined();
      expect(confViolation!.severity).toBe("critical");
    });

    it("should accept confidence score of exactly 0", () => {
      const leadData: LeadScoringData = { ...validLeadData, confidence: 0 };
      const violations = validateLeadScoring(leadData);
      const confViolation = violations.find(
        (v) => v.rule === "INVALID_CONFIDENCE"
      );
      expect(confViolation).toBeUndefined();
    });

    it("should accept confidence score of exactly 1.0", () => {
      const leadData: LeadScoringData = { ...validLeadData, confidence: 1.0 };
      const violations = validateLeadScoring(leadData);
      const confViolation = violations.find(
        (v) => v.rule === "INVALID_CONFIDENCE"
      );
      expect(confViolation).toBeUndefined();
    });

    it("should log an audit event for lead scoring validation", () => {
      validateLeadScoring(validLeadData);
      const log = getAuditLog();
      const scoringEvent = log.find(
        (e) => e.action === "VALIDATE_LEAD_SCORING"
      );
      expect(scoringEvent).toBeDefined();
      expect(scoringEvent!.actor).toBe("system");
    });
  });

  // ============================================================
  // checkComplianceViolations — General Compliance Checks
  // ============================================================

  describe("checkComplianceViolations", () => {
    it("should return violation for missing action", () => {
      const violations = checkComplianceViolations("", {});
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe("MISSING_ACTION");
      expect(violations[0].severity).toBe("critical");
    });

    it("should detect PII in LLM prompt content", () => {
      const violations = checkComplianceViolations("llm_prompt", {
        content: "User email is test@example.com and they want info.",
      });
      const piiViolation = violations.find(
        (v) => v.rule === "PII_IN_LLM_PROMPT"
      );
      expect(piiViolation).toBeDefined();
      expect(piiViolation!.severity).toBe("critical");
    });

    it("should not flag LLM prompt without PII", () => {
      const violations = checkComplianceViolations("llm_prompt", {
        content: "User is interested in Willowdale community.",
      });
      const piiViolation = violations.find(
        (v) => v.rule === "PII_IN_LLM_PROMPT"
      );
      expect(piiViolation).toBeUndefined();
    });

    it("should validate send_draft action with draft data", () => {
      const violations = checkComplianceViolations("send_draft", {
        id: "draft-001",
        dmId: "dm-001",
        content: "Response text",
        confidence: 0.9,
        reviewedBy: null,
        approved: false,
        editedContent: null,
        reviewerId: "officer-123",
      });
      expect(violations.length).toBeGreaterThan(0);
      const rules = violations.map((v) => v.rule);
      expect(rules).toContain("DRAFT_NOT_APPROVED");
      expect(rules).toContain("NO_REVIEWER_ASSIGNED");
    });

    it("should validate extract_lead action with demographic data", () => {
      const violations = checkComplianceViolations("extract_lead", {
        name: "Jane Doe",
        confidence: 0.8,
        age: 30,
        gender: "female",
      });
      const biasViolation = violations.find(
        (v) => v.rule === "DEMOGRAPHIC_BIAS_PROHIBITED"
      );
      expect(biasViolation).toBeDefined();
    });

    it("should return violation for invalid draft data in send_draft", () => {
      const violations = checkComplianceViolations("send_draft", {});
      const invalidViolation = violations.find(
        (v) => v.rule === "INVALID_DRAFT_DATA"
      );
      expect(invalidViolation).toBeDefined();
    });

    it("should return violation for invalid lead data in extract_lead", () => {
      const violations = checkComplianceViolations("extract_lead", {
        name: "Test",
      });
      const invalidViolation = violations.find(
        (v) => v.rule === "INVALID_LEAD_DATA"
      );
      expect(invalidViolation).toBeDefined();
    });

    it("should validate ingest_dm action for missing platform", () => {
      const violations = checkComplianceViolations("ingest_dm", {
        content: "Hello",
        senderId: "user-1",
      });
      const platformViolation = violations.find(
        (v) => v.rule === "MISSING_PLATFORM"
      );
      expect(platformViolation).toBeDefined();
    });

    it("should validate ingest_dm action for missing content", () => {
      const violations = checkComplianceViolations("ingest_dm", {
        platform: "facebook",
        senderId: "user-1",
      });
      const contentViolation = violations.find(
        (v) => v.rule === "MISSING_CONTENT"
      );
      expect(contentViolation).toBeDefined();
    });

    it("should validate ingest_dm action for missing sender", () => {
      const violations = checkComplianceViolations("ingest_dm", {
        platform: "facebook",
        content: "Hello",
      });
      const senderViolation = violations.find(
        (v) => v.rule === "MISSING_SENDER"
      );
      expect(senderViolation).toBeDefined();
    });

    it("should pass valid ingest_dm action", () => {
      const violations = checkComplianceViolations("ingest_dm", {
        platform: "facebook",
        content: "Hello, I am interested in Willowdale.",
        senderId: "user-1",
      });
      expect(violations).toHaveLength(0);
    });

    it("should detect PII in unknown action data", () => {
      const violations = checkComplianceViolations("custom_action", {
        note: "Contact user at john@example.com",
      });
      const piiViolation = violations.find((v) => v.rule === "PII_DETECTED");
      expect(piiViolation).toBeDefined();
      expect(piiViolation!.severity).toBe("warning");
    });

    it("should log audit event for compliance check", () => {
      checkComplianceViolations("ingest_dm", {
        platform: "facebook",
        content: "Hello",
        senderId: "user-1",
      });
      const log = getAuditLog();
      const checkEvent = log.find(
        (e) => e.action === "CHECK_COMPLIANCE_VIOLATIONS"
      );
      expect(checkEvent).toBeDefined();
      expect(checkEvent!.entityRef).toBe("ingest_dm");
    });
  });

  // ============================================================
  // Audit Logging
  // ============================================================

  describe("audit logging", () => {
    it("should accumulate audit events across multiple operations", () => {
      scrubForLLM("test@example.com");
      validateLeadScoring({
        name: "Test",
        confidence: 0.8,
      });
      validateDraftForSending(
        {
          id: "draft-audit",
          dmId: "dm-audit",
          content: "Test content",
          confidence: 0.9,
          reviewedBy: "officer-1",
          approved: true,
          editedContent: null,
        },
        "officer-1"
      );

      const log = getAuditLog();
      expect(log.length).toBeGreaterThanOrEqual(3);

      const actions = log.map((e) => e.action);
      expect(actions).toContain("SCRUB_FOR_LLM");
      expect(actions).toContain("VALIDATE_LEAD_SCORING");
      expect(actions).toContain("VALIDATE_DRAFT_FOR_SENDING");
    });

    it("should clear audit log correctly", () => {
      scrubForLLM("test@example.com");
      expect(getAuditLog().length).toBeGreaterThan(0);
      clearAuditLog();
      expect(getAuditLog()).toHaveLength(0);
    });

    it("should include valid timestamps in audit events", () => {
      scrubForLLM("Hello world");
      const log = getAuditLog();
      for (const event of log) {
        expect(event.timestamp).toBeDefined();
        const parsed = new Date(event.timestamp);
        expect(parsed.getTime()).not.toBeNaN();
      }
    });

    it("should include unique IDs in audit events", () => {
      scrubForLLM("test1@example.com");
      scrubForLLM("test2@example.com");
      const log = getAuditLog();
      const ids = log.map((e) => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should return readonly audit log", () => {
      scrubForLLM("hello");
      const log = getAuditLog();
      expect(Array.isArray(log)).toBe(true);
    });
  });

  // ============================================================
  // Compliance Violation Structure
  // ============================================================

  describe("compliance violation structure", () => {
    it("should have required fields on all violations", () => {
      const violations = validateDraftForSending(
        {
          id: "draft-struct",
          dmId: "dm-struct",
          content: "",
          confidence: 0.3,
          reviewedBy: null,
          approved: false,
          editedContent: null,
        },
        ""
      );

      for (const violation of violations) {
        expect(violation.id).toBeDefined();
        expect(typeof violation.id).toBe("string");
        expect(violation.rule).toBeDefined();
        expect(typeof violation.rule).toBe("string");
        expect(["critical", "warning", "info"]).toContain(violation.severity);
        expect(violation.message).toBeDefined();
        expect(typeof violation.message).toBe("string");
        expect(violation.message.length).toBeGreaterThan(0);
        expect(violation.timestamp).toBeDefined();
      }
    });

    it("should distinguish between critical and warning severities", () => {
      const draft: DraftForReview = {
        id: "draft-sev",
        dmId: "dm-sev",
        content: "Some content",
        confidence: 0.4,
        reviewedBy: "officer-a",
        approved: false,
        editedContent: null,
      };
      const violations = validateDraftForSending(draft, "officer-b");

      const criticals = violations.filter((v) => v.severity === "critical");
      const warnings = violations.filter((v) => v.severity === "warning");

      expect(criticals.length).toBeGreaterThan(0);
      expect(warnings.length).toBeGreaterThan(0);
    });
  });
});