import { v4 as uuidv4 } from "uuid";
import type { ExtractedLeadFields } from "@/lib/types";
import { dmStore } from "@/lib/stores/dm-store";
import { validateLeadScoring } from "@/lib/compliance/compliance-guardrails";
import auditLogger from "@/lib/services/audit-logger";
import { scrubPII } from "@/lib/services/pii-scrubber";

// ============================================================
// Lead Extraction Service
// NLP-based (regex + keyword) lead data extraction from DMs
// ============================================================

// ----- Budget Patterns -----

const BUDGET_PATTERNS: RegExp[] = [
  // $800k, $1.2m, $500K
  /\$\s?(\d{1,4}(?:\.\d{1,2})?)\s?([kKmM])\b/g,
  // $800,000 or $1,200,000
  /\$\s?(\d{1,3}(?:,\d{3})+)/g,
  // $800000
  /\$\s?(\d{4,})/g,
  // "budget is 800k", "budget of $800,000", "budget around 500000"
  /budget\s+(?:is|of|around|approx(?:imately)?|about|~)?\s*\$?\s?(\d{1,4}(?:\.\d{1,2})?)\s?([kKmM])?\b/gi,
  // "under $650k", "below $800k"
  /(?:under|below|less than|up to|max(?:imum)?)\s+\$?\s?(\d{1,4}(?:\.\d{1,2})?)\s?([kKmM])?\b/gi,
  // "around 800k", "about $1.2m"
  /(?:around|about|approximately|~)\s+\$?\s?(\d{1,4}(?:\.\d{1,2})?)\s?([kKmM])\b/gi,
  // "$420,000 - $750,000" range
  /\$\s?(\d{1,3}(?:,\d{3})+)\s*[-–—to]+\s*\$?\s?(\d{1,3}(?:,\d{3})+)/g,
];

// ----- Location / Community Patterns -----

const KNOWN_COMMUNITIES: string[] = [
  "Willowdale",
  "Aura",
  "Elara",
  "Cloverton",
  "Minta",
  "Katalia",
  "Altrove",
  "Highlands",
  "Green Hills",
];

const LOCATION_PATTERNS: RegExp[] = [
  // "at Stockland Willowdale", "in Stockland Aura"
  /(?:at|in|near|around)\s+(?:Stockland\s+)?([A-Z][a-zA-Z\s]+?)(?:\s*[?.!,]|\s+(?:community|estate|development|project|area)|\s*$)/gi,
  // "Stockland Willowdale"
  /Stockland\s+([A-Z][a-zA-Z\s]+?)(?:\s*[?.!,]|\s+(?:community|estate|development|project|area)|\s*$)/gi,
  // City/suburb references
  /(?:in|from|to|near)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\b/g,
];

// ----- Intent Keywords -----

const INTENT_KEYWORDS: Record<string, string[]> = {
  buy: [
    "buy",
    "buying",
    "purchase",
    "purchasing",
    "interested in",
    "looking for",
    "looking at",
    "want to buy",
    "keen on",
    "considering",
  ],
  inspect: [
    "inspect",
    "inspection",
    "visit",
    "book",
    "booking",
    "display",
    "tour",
    "walk-through",
    "walkthrough",
    "open home",
    "open day",
  ],
  inquiry: [
    "wondering",
    "question",
    "can you tell me",
    "could you let me know",
    "what is",
    "what are",
    "how much",
    "how far",
    "where is",
    "info",
    "information",
    "details",
  ],
  invest: [
    "invest",
    "investor",
    "investment",
    "rental yield",
    "rental return",
    "dual occupancy",
    "capital growth",
  ],
  downsize: [
    "downsize",
    "downsizing",
    "smaller",
    "accessible",
    "single-storey",
    "single storey",
    "retirement",
  ],
  relocate: [
    "relocate",
    "relocating",
    "moving",
    "move to",
    "moving to",
    "transferring",
  ],
  first_home: [
    "first home",
    "first home buyer",
    "first-home",
    "fhb",
    "first time buyer",
    "first time",
    "not sure where to start",
  ],
};

// ----- Contact Patterns -----

const EMAIL_PATTERN =
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const PHONE_PATTERNS: RegExp[] = [
  /(?:\+?61[\s\-]?)?(?:\(0[2-9]\)[\s\-]?\d{4}[\s\-]?\d{4}|0[2-9][\s\-]?\d{4}[\s\-]?\d{4}|04\d{2}[\s\-]?\d{3}[\s\-]?\d{3})/g,
  /\+?\d{1,3}[\s\-]?\d{2,4}[\s\-]?\d{3,4}[\s\-]?\d{3,4}/g,
];

// ----- Name Extraction -----

const NAME_INTRO_PATTERNS: RegExp[] = [
  /(?:my name is|i'm|i am|this is|name's|name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
  /(?:^|\n)\s*(?:hi|hey|hello|g'day),?\s*(?:i'm|i am|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
];

// ----- Helper Functions -----

function normalizeBudget(match: string): string | null {
  // Remove $ and whitespace
  let cleaned = match.replace(/\$/g, "").replace(/\s/g, "").trim();

  // Handle k/m suffixes
  const suffixMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*([kKmM])$/);
  if (suffixMatch) {
    const num = parseFloat(suffixMatch[1]);
    const suffix = suffixMatch[2].toLowerCase();
    if (suffix === "k") {
      return `$${(num * 1000).toLocaleString()}`;
    }
    if (suffix === "m") {
      return `$${(num * 1000000).toLocaleString()}`;
    }
  }

  // Handle comma-separated numbers
  const commaMatch = cleaned.match(/^(\d{1,3}(?:,\d{3})+)$/);
  if (commaMatch) {
    return `$${commaMatch[1]}`;
  }

  // Handle plain numbers (6+ digits likely a price)
  const plainMatch = cleaned.match(/^(\d{5,})$/);
  if (plainMatch) {
    const num = parseInt(plainMatch[1], 10);
    return `$${num.toLocaleString()}`;
  }

  return null;
}

function extractBudget(content: string): string | null {
  for (const pattern of BUDGET_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const match = regex.exec(content);
    if (match) {
      const normalized = normalizeBudget(match[0]);
      if (normalized) {
        return normalized;
      }
    }
  }
  return null;
}

function extractLocation(content: string, communityName: string | null): string | null {
  // First check if community name is provided in metadata
  if (communityName) {
    return communityName;
  }

  // Check for known community names in content
  const lowerContent = content.toLowerCase();
  for (const community of KNOWN_COMMUNITIES) {
    if (lowerContent.includes(community.toLowerCase())) {
      return community;
    }
  }

  // Try location patterns
  for (const pattern of LOCATION_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const match = regex.exec(content);
    if (match && match[1]) {
      const location = match[1].trim();
      // Filter out common false positives
      const falsePositives = [
        "Hi",
        "Hey",
        "Hello",
        "Thanks",
        "Thank",
        "Please",
        "Can",
        "Could",
        "Would",
        "Just",
        "Also",
        "We",
        "My",
        "I",
      ];
      if (!falsePositives.includes(location)) {
        return location;
      }
    }
  }

  return null;
}

function extractIntent(content: string): string | null {
  const lowerContent = content.toLowerCase();
  let bestIntent: string | null = null;
  let bestMatchCount = 0;

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    let matchCount = 0;
    for (const keyword of keywords) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }
    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount;
      bestIntent = intent;
    }
  }

  return bestIntent;
}

function extractName(content: string, senderName: string | null): string | null {
  // Try to extract name from message content first
  for (const pattern of NAME_INTRO_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const match = regex.exec(content);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Fall back to sender name from platform metadata
  if (senderName && senderName.trim().length > 0) {
    return senderName.trim();
  }

  return null;
}

function extractContact(content: string): string | null {
  // Try email first
  const emailRegex = new RegExp(EMAIL_PATTERN.source, EMAIL_PATTERN.flags);
  const emailMatch = emailRegex.exec(content);
  if (emailMatch) {
    return emailMatch[0];
  }

  // Try phone patterns
  for (const pattern of PHONE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const match = regex.exec(content);
    if (match) {
      return match[0].trim();
    }
  }

  return null;
}

function computeConfidence(fields: ExtractedLeadFields): number {
  let score = 0;
  let totalWeight = 0;

  const weights: Record<string, number> = {
    name: 0.15,
    contact: 0.2,
    budget: 0.25,
    location: 0.2,
    intent: 0.2,
  };

  if (fields.name) {
    score += weights.name;
  }
  totalWeight += weights.name;

  if (fields.contact) {
    score += weights.contact;
  }
  totalWeight += weights.contact;

  if (fields.budget) {
    score += weights.budget;
  }
  totalWeight += weights.budget;

  if (fields.location) {
    score += weights.location;
  }
  totalWeight += weights.location;

  if (fields.intent) {
    score += weights.intent;
  }
  totalWeight += weights.intent;

  // Normalize to 0-1
  const confidence = totalWeight > 0 ? score / totalWeight : 0;

  return Math.round(confidence * 100) / 100;
}

// ============================================================
// Public API
// ============================================================

/**
 * Extracts structured lead data from a DM by ID.
 * Uses regex and keyword-based extraction to identify name, contact info,
 * budget, location, and intent from the DM content.
 *
 * @param dmId - The ID of the DM to extract lead data from
 * @returns ExtractedLeadFields with confidence score
 * @throws Error if DM is not found
 */
export async function extractLead(dmId: string): Promise<ExtractedLeadFields> {
  // Retrieve the DM
  const dm = dmStore.getById(dmId);
  if (!dm) {
    await auditLogger.logEvent(
      "LEAD_EXTRACTION_FAILED",
      "system",
      dmId,
      JSON.stringify({ reason: "DM not found", dmId })
    );
    throw new Error(`DM not found: ${dmId}`);
  }

  const content = dm.content;
  const senderName = dm.sender?.name ?? null;
  const communityName = dm.metadata?.communityName ?? null;

  // Extract fields
  const name = extractName(content, senderName);
  const contact = extractContact(content);
  const budget = extractBudget(content);
  const location = extractLocation(content, communityName);
  const intent = extractIntent(content);

  // Build extracted fields
  const extractedFields: ExtractedLeadFields = {
    name,
    contact,
    budget,
    location,
    intent,
    confidence: 0,
  };

  // Compute confidence
  extractedFields.confidence = computeConfidence(extractedFields);

  // Validate compliance — no demographic scoring
  const complianceViolations = validateLeadScoring({
    name: extractedFields.name,
    contact: extractedFields.contact,
    budget: extractedFields.budget,
    location: extractedFields.location,
    intent: extractedFields.intent,
    confidence: extractedFields.confidence,
  });

  if (complianceViolations.length > 0) {
    const violationDetails = complianceViolations.map((v) => ({
      rule: v.rule,
      severity: v.severity,
      message: v.message,
    }));

    await auditLogger.logEvent(
      "LEAD_EXTRACTION_COMPLIANCE_VIOLATION",
      "system",
      dmId,
      JSON.stringify({
        dmId,
        violations: violationDetails,
      })
    );

    // For critical violations, throw
    const criticalViolations = complianceViolations.filter(
      (v) => v.severity === "critical"
    );
    if (criticalViolations.length > 0) {
      throw new Error(
        `Compliance violation during lead extraction: ${criticalViolations.map((v) => v.message).join("; ")}`
      );
    }
  }

  // Scrub content for audit log (no PII in logs)
  const scrubbedContent = scrubPII(content);

  // Log extraction event
  await auditLogger.logEvent(
    "LEAD_EXTRACTED",
    "system",
    dmId,
    JSON.stringify({
      dmId,
      platform: dm.platform,
      extractedFields: {
        name: extractedFields.name ? "[PRESENT]" : null,
        contact: extractedFields.contact ? "[PRESENT]" : null,
        budget: extractedFields.budget,
        location: extractedFields.location,
        intent: extractedFields.intent,
      },
      confidence: extractedFields.confidence,
      contentPreview: scrubbedContent.substring(0, 100),
    })
  );

  return extractedFields;
}