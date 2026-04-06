import { v4 as uuidv4 } from "uuid";

// ============================================================
// Compliance Guardrails
// Enforces human-in-the-loop, PII protection, and bias mitigation
// ============================================================

// ----- Types -----

export interface ComplianceViolation {
  id: string;
  rule: string;
  severity: "critical" | "warning" | "info";
  message: string;
  timestamp: string;
}

export interface DraftForReview {
  id: string;
  dmId: string;
  content: string;
  confidence: number;
  reviewedBy: string | null;
  approved: boolean;
  editedContent: string | null;
}

export interface LeadScoringData {
  name?: string | null;
  contact?: string | null;
  budget?: string | null;
  location?: string | null;
  intent?: string | null;
  confidence: number;
  age?: number | null;
  gender?: string | null;
  ethnicity?: string | null;
  religion?: string | null;
  nationality?: string | null;
  maritalStatus?: string | null;
  disability?: string | null;
  [key: string]: unknown;
}

export interface AuditEvent {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  entityRef: string;
  details: string;
}

// ----- PII Patterns -----

const PII_PATTERNS: { name: string; pattern: RegExp; replacement: string }[] = [
  {
    name: "email",
    pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    replacement: "[EMAIL_REDACTED]",
  },
  {
    name: "phone_au",
    pattern: /(?:\+?61|0)[2-478](?:[ \-]?\d){8}/g,
    replacement: "[PHONE_REDACTED]",
  },
  {
    name: "phone_international",
    pattern: /\+?\d{1,4}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{3,4}[\s\-]?\d{3,4}/g,
    replacement: "[PHONE_REDACTED]",
  },
  {
    name: "credit_card",
    pattern: /\b(?:\d[ \-]*?){13,19}\b/g,
    replacement: "[CC_REDACTED]",
  },
  {
    name: "tfn",
    pattern: /\b\d{3}[\s\-]?\d{3}[\s\-]?\d{3}\b/g,
    replacement: "[TFN_REDACTED]",
  },
  {
    name: "medicare",
    pattern: /\b\d{4}[\s\-]?\d{5}[\s\-]?\d{1}[\s\-]?\d{1}\b/g,
    replacement: "[MEDICARE_REDACTED]",
  },
  {
    name: "drivers_licence",
    pattern: /\b[A-Z]{2}\d{6,8}\b/gi,
    replacement: "[LICENCE_REDACTED]",
  },
  {
    name: "date_of_birth",
    pattern:
      /\b(?:DOB|date of birth|born|birthday)[:\s]*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/gi,
    replacement: "[DOB_REDACTED]",
  },
  {
    name: "street_address",
    pattern:
      /\b\d{1,5}\s+(?:[A-Z][a-zA-Z]*\s){1,4}(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Court|Ct|Place|Pl|Crescent|Cres|Way|Terrace|Tce|Circuit|Cct|Close|Cl|Parade|Pde)\b/gi,
    replacement: "[ADDRESS_REDACTED]",
  },
  {
    name: "postcode_au",
    pattern: /\b(?:NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\s+\d{4}\b/gi,
    replacement: "[POSTCODE_REDACTED]",
  },
];

// ----- Demographic Fields (Prohibited for Lead Scoring) -----

const DEMOGRAPHIC_FIELDS: string[] = [
  "age",
  "gender",
  "sex",
  "ethnicity",
  "race",
  "religion",
  "nationality",
  "maritalStatus",
  "marital_status",
  "disability",
  "sexualOrientation",
  "sexual_orientation",
  "politicalAffiliation",
  "political_affiliation",
  "familyStatus",
  "family_status",
  "pregnancyStatus",
  "pregnancy_status",
];

// ----- Audit Logger (Internal) -----

const auditLog: AuditEvent[] = [];

function logAuditEvent(
  action: string,
  actor: string,
  entityRef: string,
  details: string
): void {
  const event: AuditEvent = {
    id: uuidv4(),
    action,
    actor,
    timestamp: new Date().toISOString(),
    entityRef,
    details,
  };
  auditLog.push(event);
}

/**
 * Returns the internal audit log entries (useful for testing and inspection).
 */
export function getAuditLog(): ReadonlyArray<AuditEvent> {
  return auditLog;
}

/**
 * Clears the internal audit log (useful for testing).
 */
export function clearAuditLog(): void {
  auditLog.length = 0;
}

// ============================================================
// Public API
// ============================================================

/**
 * Validates that a draft has been reviewed by a human before sending.
 * Enforces human-in-the-loop compliance.
 *
 * @param draft - The draft response to validate
 * @param reviewerId - The ID of the reviewer attempting to send
 * @returns Array of compliance violations (empty if compliant)
 */
export function validateDraftForSending(
  draft: DraftForReview,
  reviewerId: string
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];
  const now = new Date().toISOString();

  if (!reviewerId || reviewerId.trim().length === 0) {
    violations.push({
      id: uuidv4(),
      rule: "HUMAN_IN_THE_LOOP",
      severity: "critical",
      message:
        "A valid reviewer ID is required. All outbound messages must be reviewed by a human.",
      timestamp: now,
    });
  }

  if (!draft.approved) {
    violations.push({
      id: uuidv4(),
      rule: "DRAFT_NOT_APPROVED",
      severity: "critical",
      message:
        "Draft must be explicitly approved before sending. Human review is mandatory.",
      timestamp: now,
    });
  }

  if (!draft.reviewedBy) {
    violations.push({
      id: uuidv4(),
      rule: "NO_REVIEWER_ASSIGNED",
      severity: "critical",
      message:
        "Draft has not been reviewed by any user. A human must review before sending.",
      timestamp: now,
    });
  }

  if (draft.reviewedBy && reviewerId && draft.reviewedBy !== reviewerId) {
    violations.push({
      id: uuidv4(),
      rule: "REVIEWER_MISMATCH",
      severity: "warning",
      message: `Sender (${reviewerId}) differs from reviewer (${draft.reviewedBy}). Verify authorization.`,
      timestamp: now,
    });
  }

  const content = draft.editedContent || draft.content;
  if (!content || content.trim().length === 0) {
    violations.push({
      id: uuidv4(),
      rule: "EMPTY_CONTENT",
      severity: "critical",
      message: "Draft content cannot be empty.",
      timestamp: now,
    });
  }

  if (draft.confidence < 0.6) {
    violations.push({
      id: uuidv4(),
      rule: "LOW_CONFIDENCE_REVIEW",
      severity: "warning",
      message: `Draft confidence (${draft.confidence.toFixed(2)}) is below threshold (0.60). Ensure thorough human review was performed.`,
      timestamp: now,
    });
  }

  logAuditEvent(
    "VALIDATE_DRAFT_FOR_SENDING",
    reviewerId || "unknown",
    draft.id,
    JSON.stringify({
      draftId: draft.id,
      dmId: draft.dmId,
      approved: draft.approved,
      reviewedBy: draft.reviewedBy,
      confidence: draft.confidence,
      violationCount: violations.length,
      violations: violations.map((v) => v.rule),
    })
  );

  return violations;
}

/**
 * Scrubs PII from text before sending to LLM.
 * Ensures compliance with Australian Privacy Act and data protection requirements.
 *
 * @param text - The raw text to scrub
 * @returns The text with PII redacted
 */
export function scrubForLLM(text: string): string {
  if (!text || text.trim().length === 0) {
    logAuditEvent(
      "SCRUB_FOR_LLM",
      "system",
      "n/a",
      JSON.stringify({ input: "empty", piiFound: false })
    );
    return text || "";
  }

  let scrubbed = text;
  const piiTypesFound: string[] = [];

  for (const piiPattern of PII_PATTERNS) {
    const matches = scrubbed.match(piiPattern.pattern);
    if (matches && matches.length > 0) {
      piiTypesFound.push(piiPattern.name);
      scrubbed = scrubbed.replace(piiPattern.pattern, piiPattern.replacement);
    }
  }

  logAuditEvent(
    "SCRUB_FOR_LLM",
    "system",
    "n/a",
    JSON.stringify({
      piiFound: piiTypesFound.length > 0,
      piiTypesRedacted: piiTypesFound,
      originalLength: text.length,
      scrubbedLength: scrubbed.length,
    })
  );

  return scrubbed;
}

/**
 * Validates that lead scoring data does not contain or rely on demographic fields.
 * Ensures no bias based on protected characteristics.
 *
 * @param leadData - The lead scoring data to validate
 * @returns Array of compliance violations (empty if compliant)
 */
export function validateLeadScoring(
  leadData: LeadScoringData
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];
  const now = new Date().toISOString();

  const presentDemographicFields: string[] = [];

  for (const field of DEMOGRAPHIC_FIELDS) {
    const value = leadData[field];
    if (value !== undefined && value !== null && value !== "") {
      presentDemographicFields.push(field);
    }
  }

  if (presentDemographicFields.length > 0) {
    violations.push({
      id: uuidv4(),
      rule: "DEMOGRAPHIC_BIAS_PROHIBITED",
      severity: "critical",
      message: `Lead scoring must not use demographic fields. Prohibited fields present: ${presentDemographicFields.join(", ")}. Remove these fields before scoring.`,
      timestamp: now,
    });
  }

  if (leadData.confidence < 0) {
    violations.push({
      id: uuidv4(),
      rule: "INVALID_CONFIDENCE",
      severity: "critical",
      message: "Confidence score cannot be negative.",
      timestamp: now,
    });
  }

  if (leadData.confidence > 1) {
    violations.push({
      id: uuidv4(),
      rule: "INVALID_CONFIDENCE",
      severity: "critical",
      message: "Confidence score cannot exceed 1.0.",
      timestamp: now,
    });
  }

  logAuditEvent(
    "VALIDATE_LEAD_SCORING",
    "system",
    leadData.name || "unknown",
    JSON.stringify({
      fieldsChecked: Object.keys(leadData).length,
      demographicFieldsFound: presentDemographicFields,
      confidence: leadData.confidence,
      violationCount: violations.length,
      violations: violations.map((v) => v.rule),
    })
  );

  return violations;
}

/**
 * General compliance check that evaluates an action and its associated data
 * for any compliance violations.
 *
 * @param action - The action being performed (e.g., "send_draft", "extract_lead", "ingest_dm")
 * @param data - The data associated with the action
 * @returns Array of compliance violations (empty if compliant)
 */
export function checkComplianceViolations(
  action: string,
  data: Record<string, unknown>
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];
  const now = new Date().toISOString();

  if (!action || action.trim().length === 0) {
    violations.push({
      id: uuidv4(),
      rule: "MISSING_ACTION",
      severity: "critical",
      message: "Compliance check requires a valid action identifier.",
      timestamp: now,
    });
    return violations;
  }

  switch (action) {
    case "send_draft": {
      const draft = data as unknown as DraftForReview;
      const reviewerId = (data.reviewerId as string) || "";
      if (draft && draft.id) {
        const draftViolations = validateDraftForSending(draft, reviewerId);
        violations.push(...draftViolations);
      } else {
        violations.push({
          id: uuidv4(),
          rule: "INVALID_DRAFT_DATA",
          severity: "critical",
          message: "Draft data is missing or invalid for send_draft action.",
          timestamp: now,
        });
      }
      break;
    }

    case "extract_lead": {
      const leadData = data as unknown as LeadScoringData;
      if (leadData && typeof leadData.confidence === "number") {
        const leadViolations = validateLeadScoring(leadData);
        violations.push(...leadViolations);
      } else {
        violations.push({
          id: uuidv4(),
          rule: "INVALID_LEAD_DATA",
          severity: "critical",
          message:
            "Lead data is missing or invalid for extract_lead action.",
          timestamp: now,
        });
      }
      break;
    }

    case "llm_prompt": {
      const content = data.content as string;
      if (content) {
        const scrubbed = scrubForLLM(content);
        if (scrubbed !== content) {
          violations.push({
            id: uuidv4(),
            rule: "PII_IN_LLM_PROMPT",
            severity: "critical",
            message:
              "PII detected in content intended for LLM. Content must be scrubbed before submission.",
            timestamp: now,
          });
        }
      }
      break;
    }

    case "ingest_dm": {
      if (!data.platform || typeof data.platform !== "string") {
        violations.push({
          id: uuidv4(),
          rule: "MISSING_PLATFORM",
          severity: "warning",
          message: "DM ingestion should include a valid platform identifier.",
          timestamp: now,
        });
      }
      if (!data.content || typeof data.content !== "string") {
        violations.push({
          id: uuidv4(),
          rule: "MISSING_CONTENT",
          severity: "critical",
          message: "DM ingestion requires message content.",
          timestamp: now,
        });
      }
      if (!data.sender_id && !data.senderId) {
        violations.push({
          id: uuidv4(),
          rule: "MISSING_SENDER",
          severity: "warning",
          message: "DM ingestion should include a sender identifier.",
          timestamp: now,
        });
      }
      break;
    }

    default: {
      // Generic checks for unknown actions
      const dataStr = JSON.stringify(data);
      for (const piiPattern of PII_PATTERNS) {
        if (piiPattern.pattern.test(dataStr)) {
          violations.push({
            id: uuidv4(),
            rule: "PII_DETECTED",
            severity: "warning",
            message: `Potential PII (${piiPattern.name}) detected in data for action "${action}". Review data handling.`,
            timestamp: now,
          });
          // Reset regex lastIndex since we use global flag
          piiPattern.pattern.lastIndex = 0;
          break;
        }
      }
      // Reset all pattern lastIndex values
      for (const piiPattern of PII_PATTERNS) {
        piiPattern.pattern.lastIndex = 0;
      }
      break;
    }
  }

  logAuditEvent(
    "CHECK_COMPLIANCE_VIOLATIONS",
    "system",
    action,
    JSON.stringify({
      action,
      dataKeys: Object.keys(data),
      violationCount: violations.length,
      violations: violations.map((v) => ({ rule: v.rule, severity: v.severity })),
    })
  );

  return violations;
}