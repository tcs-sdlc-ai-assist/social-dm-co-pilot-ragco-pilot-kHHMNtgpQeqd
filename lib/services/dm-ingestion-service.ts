import { v4 as uuidv4 } from "uuid";
import type { DMMessage } from "@/lib/types";
import { DMStatus } from "@/lib/types";
import { dmStore } from "@/lib/stores/dm-store";
import type { DMRecord } from "@/lib/stores/dm-store";
import auditLogger from "@/lib/services/audit-logger";
import { scrubPII } from "@/lib/services/pii-scrubber";

// ============================================================
// DM Ingestion Service
// Processes incoming DMs from simulated Facebook/Instagram APIs
// ============================================================

// ----- Types -----

export interface DMIngestPayload {
  platform: string;
  message_id?: string;
  messageId?: string;
  sender_id?: string;
  senderId?: string;
  sender_name?: string;
  senderName?: string;
  sender_handle?: string;
  senderHandle?: string;
  sender_avatar_url?: string;
  senderAvatarUrl?: string;
  timestamp?: string;
  content: string;
  metadata?: {
    communityName?: string | null;
    propertyType?: string | null;
    bedrooms?: number | null;
  };
}

export interface RawPlatformMessage {
  id: string;
  from: {
    id: string;
    name: string;
    handle?: string;
    avatar_url?: string;
  };
  message: string;
  created_time: string;
  metadata?: Record<string, unknown>;
}

export interface IngestResult {
  status: "received";
  dm_id: string;
  dm: DMRecord;
}

// ----- Validation -----

function validatePayload(payload: DMIngestPayload): string[] {
  const errors: string[] = [];

  if (!payload.platform || typeof payload.platform !== "string") {
    errors.push("Missing required field: platform");
  } else if (!["facebook", "instagram"].includes(payload.platform.toLowerCase())) {
    errors.push("Invalid platform. Must be 'facebook' or 'instagram'");
  }

  if (!payload.content || typeof payload.content !== "string" || payload.content.trim().length === 0) {
    errors.push("Missing required field: content");
  }

  const senderId = payload.sender_id || payload.senderId;
  if (!senderId || typeof senderId !== "string") {
    errors.push("Missing required field: sender_id");
  }

  if (payload.timestamp) {
    const parsed = new Date(payload.timestamp);
    if (isNaN(parsed.getTime())) {
      errors.push("Invalid timestamp format. Must be ISO8601");
    }
  }

  return errors;
}

// ----- Intent Detection (Simple keyword-based) -----

function detectIntent(content: string): string {
  const lower = content.toLowerCase();

  if (/\bpric(?:e|ing|es)\b/.test(lower) || /\bcost\b/.test(lower) || /\bbudget\b/.test(lower) || /\bhow much\b/.test(lower)) {
    return "pricing";
  }
  if (/\bbook(?:ing)?\b/.test(lower) || /\binspect(?:ion)?\b/.test(lower) || /\bvisit\b/.test(lower) || /\bappointment\b/.test(lower)) {
    return "booking_inspection";
  }
  if (/\bavailab(?:le|ility)\b/.test(lower) || /\bstock\b/.test(lower) || /\bremaining\b/.test(lower) || /\bleft\b/.test(lower)) {
    return "availability";
  }
  if (/\bwhere\b/.test(lower) || /\blocat(?:ion|ed)\b/.test(lower) || /\btransport\b/.test(lower) || /\btrain\b/.test(lower) || /\bbus\b/.test(lower)) {
    return "location";
  }

  return "general_inquiry";
}

// ----- Priority Detection -----

function detectPriority(content: string, intent: string): string {
  if (intent === "booking_inspection" || intent === "pricing") {
    return "high";
  }
  if (intent === "availability") {
    return "medium";
  }

  const lower = content.toLowerCase();
  if (/\burgent\b/.test(lower) || /\basap\b/.test(lower) || /\bimmediately\b/.test(lower)) {
    return "high";
  }

  return "low";
}

// ----- Confidence Score -----

function computeConfidence(content: string, intent: string): number {
  const lower = content.toLowerCase();
  let score = 0.5;

  // Longer messages tend to have more context
  if (content.length > 100) {
    score += 0.1;
  }
  if (content.length > 200) {
    score += 0.05;
  }

  // Specific intent keywords boost confidence
  if (intent === "pricing" || intent === "booking_inspection") {
    score += 0.2;
  } else if (intent === "availability" || intent === "location") {
    score += 0.15;
  }

  // Question marks indicate clear inquiry
  if (lower.includes("?")) {
    score += 0.1;
  }

  // Community name mentions boost confidence
  const communityNames = ["willowdale", "aura", "elara", "cloverton", "minta", "katalia", "altrove", "highlands"];
  for (const name of communityNames) {
    if (lower.includes(name)) {
      score += 0.1;
      break;
    }
  }

  return Math.min(Math.round(score * 100) / 100, 1.0);
}

// ----- Community Detection -----

function detectCommunity(content: string): string | null {
  const lower = content.toLowerCase();
  const communities = [
    "willowdale", "aura", "elara", "cloverton", "minta",
    "katalia", "altrove", "highlands", "green hills",
  ];

  for (const community of communities) {
    if (lower.includes(community)) {
      return community.charAt(0).toUpperCase() + community.slice(1);
    }
  }

  return null;
}

// ----- Property Type Detection -----

function detectPropertyType(content: string): string | null {
  const lower = content.toLowerCase();

  if (/\btownhouse\b/.test(lower) || /\btownhome\b/.test(lower)) {
    return "townhouse";
  }
  if (/\bapartment\b/.test(lower) || /\bunit\b/.test(lower) || /\bflat\b/.test(lower)) {
    return "apartment";
  }
  if (/\bhouse\s*(?:and|&)\s*land\b/.test(lower) || /\bpackage\b/.test(lower)) {
    return "house_and_land";
  }
  if (/\bland\s*(?:lot|block)?\b/.test(lower) || /\blot\b/.test(lower)) {
    return "land";
  }
  if (/\bdisplay\b/.test(lower)) {
    return "display_home";
  }
  if (/\bhouse\b/.test(lower) || /\bhome\b/.test(lower)) {
    return "house_and_land";
  }

  return null;
}

// ----- Bedrooms Detection -----

function detectBedrooms(content: string): number | null {
  const match = content.match(/(\d)\s*[-\s]?\s*bed(?:room)?s?\b/i);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 10) {
      return num;
    }
  }
  return null;
}

// ============================================================
// Public API
// ============================================================

/**
 * Normalizes a platform-specific raw message into a DMMessage type.
 *
 * @param rawMessage - The raw message from the platform API
 * @param platform - The platform identifier ("facebook" or "instagram")
 * @returns A normalized DMMessage object
 */
export function normalizeMessage(rawMessage: RawPlatformMessage, platform: string): DMMessage {
  const normalizedPlatform = platform.toLowerCase();

  const dmMessage: DMMessage = {
    id: `dm-${uuidv4()}`,
    sender: rawMessage.from.name || rawMessage.from.id,
    platform: normalizedPlatform,
    timestamp: rawMessage.created_time || new Date().toISOString(),
    content: rawMessage.message,
    status: DMStatus.NEW,
  };

  return dmMessage;
}

/**
 * Validates, normalizes, and stores an incoming DM with NEW status.
 * Logs all ingestion events via audit-logger.
 *
 * @param payload - The incoming DM payload
 * @returns The ingestion result with the stored DM record
 * @throws Error if validation fails
 */
export async function ingestDM(payload: DMIngestPayload): Promise<IngestResult> {
  // Validate payload
  const errors = validatePayload(payload);
  if (errors.length > 0) {
    await auditLogger.logEvent(
      "DM_INGESTION_FAILED",
      "system",
      "n/a",
      JSON.stringify({ errors, platform: payload.platform || "unknown" })
    );
    throw new Error(`Validation failed: ${errors.join("; ")}`);
  }

  const platform = payload.platform.toLowerCase();
  const senderId = payload.sender_id || payload.senderId || "unknown";
  const senderName = payload.sender_name || payload.senderName || "Unknown User";
  const senderHandle = payload.sender_handle || payload.senderHandle || senderId;
  const senderAvatarUrl = payload.sender_avatar_url || payload.senderAvatarUrl || `https://i.pravatar.cc/150?u=${senderId}`;
  const messageId = payload.message_id || payload.messageId || uuidv4();
  const timestamp = payload.timestamp || new Date().toISOString();
  const content = payload.content.trim();

  // Detect intent, priority, confidence, and metadata
  const intent = detectIntent(content);
  const priority = detectPriority(content, intent);
  const confidenceScore = computeConfidence(content, intent);

  const communityName = payload.metadata?.communityName ?? detectCommunity(content);
  const propertyType = payload.metadata?.propertyType ?? detectPropertyType(content);
  const bedrooms = payload.metadata?.bedrooms ?? detectBedrooms(content);

  // Compute SLA deadline (60 minutes from timestamp by default)
  const slaMinutes = parseInt(process.env.SLA_BREACH_MINUTES || "", 10) || 60;
  const slaDeadline = new Date(new Date(timestamp).getTime() + slaMinutes * 60 * 1000).toISOString();

  const dmId = `dm-${uuidv4()}`;
  const conversationId = `conv-${uuidv4()}`;

  const dmRecord: DMRecord = {
    id: dmId,
    platform,
    conversationId,
    sender: {
      id: senderId,
      name: senderName,
      handle: senderHandle,
      avatarUrl: senderAvatarUrl,
    },
    content,
    timestamp,
    intent,
    status: "new",
    priority,
    confidenceScore,
    slaDeadline,
    metadata: {
      communityName,
      propertyType,
      bedrooms,
    },
  };

  // Store the DM
  const stored = dmStore.add(dmRecord);

  // Log the ingestion event (scrub PII from content in audit log)
  const scrubbedContent = scrubPII(content);
  await auditLogger.logEvent(
    "DM_INGESTED",
    "system",
    dmId,
    JSON.stringify({
      dmId,
      platform,
      senderId,
      senderName,
      intent,
      priority,
      confidenceScore,
      communityName,
      contentPreview: scrubbedContent.substring(0, 100),
      messageId,
    })
  );

  return {
    status: "received",
    dm_id: dmId,
    dm: stored,
  };
}

// ----- Simulated DM Data -----

const SIMULATED_DM_TEMPLATES: Array<{
  platform: string;
  senderName: string;
  senderHandle: string;
  content: string;
  metadata?: {
    communityName?: string | null;
    propertyType?: string | null;
    bedrooms?: number | null;
  };
}> = [
  {
    platform: "facebook",
    senderName: "Jessica Taylor",
    senderHandle: "jessica.taylor.homes",
    content: "Hi! We're looking at buying a 4-bedroom house and land package at Stockland Willowdale. What's the price range?",
    metadata: { communityName: "Willowdale", propertyType: "house_and_land", bedrooms: 4 },
  },
  {
    platform: "instagram",
    senderName: "Mark Johnson",
    senderHandle: "markj_property",
    content: "Hey, is there any land available at Stockland Aura? Looking for around 350sqm.",
    metadata: { communityName: "Aura", propertyType: "land", bedrooms: null },
  },
  {
    platform: "facebook",
    senderName: "Samantha Lee",
    senderHandle: "sam.lee.92",
    content: "Can I book an inspection at the Elara display village this weekend? Saturday afternoon would be ideal.",
    metadata: { communityName: "Elara", propertyType: "display_home", bedrooms: null },
  },
  {
    platform: "instagram",
    senderName: "Andrew Wilson",
    senderHandle: "andrew.wilson.au",
    content: "What schools are near Stockland Cloverton? We have two kids starting primary school next year.",
    metadata: { communityName: "Cloverton", propertyType: null, bedrooms: null },
  },
  {
    platform: "facebook",
    senderName: "Michelle Brown",
    senderHandle: "michelle.brown.55",
    content: "We're first home buyers interested in Stockland Minta. Do you have any 3-bedroom packages under $600k?",
    metadata: { communityName: "Minta", propertyType: "house_and_land", bedrooms: 3 },
  },
  {
    platform: "instagram",
    senderName: "Peter Zhang",
    senderHandle: "peterzhang_invest",
    content: "What's the expected rental yield for properties at Stockland Highlands? I'm an investor looking at the area.",
    metadata: { communityName: "Highlands", propertyType: null, bedrooms: null },
  },
  {
    platform: "facebook",
    senderName: "Laura Adams",
    senderHandle: "laura.adams.living",
    content: "Is the Stockland Katalia sales centre open on weekends? We'd like to visit and see what's available.",
    metadata: { communityName: "Katalia", propertyType: null, bedrooms: null },
  },
  {
    platform: "instagram",
    senderName: "Chris Evans",
    senderHandle: "chrisevans.homes",
    content: "Where exactly is Stockland Altrove located? How far is it from the nearest train station?",
    metadata: { communityName: "Altrove", propertyType: null, bedrooms: null },
  },
];

/**
 * Generates simulated DMs for pilot testing.
 * Randomly selects from template messages and ingests them.
 *
 * @param count - Number of simulated DMs to generate (default: 3, max: 8)
 * @returns Array of ingestion results
 */
export async function simulateIncomingDMs(count: number = 3): Promise<IngestResult[]> {
  const numToGenerate = Math.min(Math.max(count, 1), SIMULATED_DM_TEMPLATES.length);
  const results: IngestResult[] = [];

  // Shuffle templates and pick the requested count
  const shuffled = [...SIMULATED_DM_TEMPLATES].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, numToGenerate);

  for (const template of selected) {
    const senderId = `user-sim-${uuidv4().substring(0, 8)}`;
    const now = new Date();
    // Stagger timestamps slightly
    const offset = results.length * 2 * 60 * 1000; // 2 minutes apart
    const timestamp = new Date(now.getTime() - offset).toISOString();

    try {
      const result = await ingestDM({
        platform: template.platform,
        sender_id: senderId,
        sender_name: template.senderName,
        sender_handle: template.senderHandle,
        sender_avatar_url: `https://i.pravatar.cc/150?u=${senderId}`,
        timestamp,
        content: template.content,
        metadata: template.metadata,
      });

      results.push(result);
    } catch (error) {
      console.error("[DMIngestionService] Failed to simulate DM:", error);
      await auditLogger.logEvent(
        "DM_SIMULATION_FAILED",
        "system",
        "n/a",
        JSON.stringify({
          senderName: template.senderName,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      );
    }
  }

  await auditLogger.logEvent(
    "DM_SIMULATION_COMPLETE",
    "system",
    "n/a",
    JSON.stringify({
      requested: count,
      generated: results.length,
      dmIds: results.map((r) => r.dm_id),
    })
  );

  return results;
}