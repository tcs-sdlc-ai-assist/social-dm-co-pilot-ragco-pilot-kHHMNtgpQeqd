import { v4 as uuidv4 } from "uuid";
import type { DraftResponse } from "@/lib/types";
import { dmStore } from "@/lib/stores/dm-store";
import { draftStore } from "@/lib/stores/draft-store";
import { searchKnowledge, type RankedKnowledgeEntry } from "@/lib/services/knowledge-base-adapter";
import { scrubPII } from "@/lib/services/pii-scrubber";
import {
  validateDraftForSending,
  type DraftForReview,
} from "@/lib/compliance/compliance-guardrails";
import auditLogger from "@/lib/services/audit-logger";

// ============================================================
// Draft Generation Service — RAG-based draft response generation
// ============================================================

interface DraftGenerationResult {
  draft: DraftResponse;
  context: RankedKnowledgeEntry[];
}

interface SubmitDraftResult {
  draft: DraftResponse;
  dmId: string;
  sentAt: string;
}

/**
 * Builds a prompt for the LLM using the DM content and knowledge base context.
 * All PII is scrubbed before inclusion in the prompt.
 */
function buildPrompt(
  scrubbedContent: string,
  senderName: string,
  context: RankedKnowledgeEntry[]
): string {
  const contextBlock = context
    .map((entry) => {
      const lines: string[] = [];
      lines.push(`Category: ${entry.category}`);
      lines.push(`Q: ${entry.question}`);
      lines.push(`A: ${entry.answer}`);
      if (entry.propertyInfo) {
        lines.push(`Property Info: ${JSON.stringify(entry.propertyInfo)}`);
      }
      return lines.join("\n");
    })
    .join("\n---\n");

  return [
    "You are a helpful customer service assistant for Stockland, a leading Australian property developer.",
    "Your role is to draft a friendly, professional, and accurate response to a customer's direct message.",
    "Use the provided knowledge base context to inform your response. If the context does not contain enough information, acknowledge the customer's question and offer to connect them with a sales consultant.",
    "Do not include any personally identifiable information in your response.",
    "Keep the response concise, warm, and helpful.",
    "",
    "=== Knowledge Base Context ===",
    contextBlock || "(No relevant context found)",
    "",
    "=== Customer Message ===",
    `From: ${senderName}`,
    `Message: ${scrubbedContent}`,
    "",
    "=== Instructions ===",
    "Draft a response to the customer's message. Be specific where the knowledge base provides relevant information.",
    "If the customer is asking about pricing, availability, or bookings, encourage them to visit the sales centre or speak with a sales consultant.",
  ].join("\n");
}

/**
 * Computes a confidence score for the draft based on knowledge base match quality.
 * Score is derived from the relevance scores of the top matching knowledge base entries.
 */
function computeConfidence(context: RankedKnowledgeEntry[]): number {
  if (context.length === 0) {
    return 0.3;
  }

  const topScore = context[0].relevanceScore;
  const avgScore =
    context.reduce((sum, entry) => sum + entry.relevanceScore, 0) /
    context.length;

  // Weighted combination: 60% top match, 30% average, 10% coverage bonus
  const coverageBonus = Math.min(context.length / 3, 1.0) * 0.1;
  const rawConfidence = topScore * 0.6 + avgScore * 0.3 + coverageBonus;

  // Clamp to [0.1, 0.98] range
  return Math.max(0.1, Math.min(0.98, rawConfidence));
}

/**
 * Calls the OpenAI API to generate a draft response.
 * Falls back to a simulated response if the API key is not configured.
 */
async function callLLM(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4";

  if (!apiKey || apiKey.trim().length === 0) {
    // Simulated response for pilot / development without API key
    return generateSimulatedResponse(prompt);
  }

  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful customer service assistant for Stockland, an Australian property developer. Draft concise, professional responses.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent || responseContent.trim().length === 0) {
      return generateSimulatedResponse(prompt);
    }

    return responseContent.trim();
  } catch (error) {
    console.error("[DraftGenerationService] LLM call failed:", error);
    // Fall back to simulated response on error
    return generateSimulatedResponse(prompt);
  }
}

/**
 * Generates a simulated response based on the prompt content.
 * Used when OpenAI API is not available (pilot mode).
 */
function generateSimulatedResponse(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase();

  if (lowerPrompt.includes("pricing") || lowerPrompt.includes("price") || lowerPrompt.includes("cost")) {
    return "Thank you for your interest in Stockland! Pricing varies depending on the community, lot size, and package type. I'd love to provide you with the most up-to-date pricing information. Would you like me to connect you with our sales team, or would you prefer to visit one of our sales centres? We're open 7 days a week and our consultants can walk you through all available options.";
  }

  if (lowerPrompt.includes("location") || lowerPrompt.includes("transport") || lowerPrompt.includes("train") || lowerPrompt.includes("bus")) {
    return "Great question! Our Stockland communities are well-connected with excellent transport links and nearby amenities. I'd be happy to share more specific details about the community you're interested in. Would you like me to send through a location map and transport guide, or would you prefer to chat with one of our sales consultants?";
  }

  if (lowerPrompt.includes("booking") || lowerPrompt.includes("inspection") || lowerPrompt.includes("visit") || lowerPrompt.includes("display")) {
    return "We'd love to welcome you to our sales centre! Our display homes and sales centres are open 7 days a week, typically from 10am to 5pm. No appointment is necessary, but booking ahead ensures a dedicated consultant is available for you. Would you like me to arrange a specific time for your visit?";
  }

  if (lowerPrompt.includes("availability") || lowerPrompt.includes("available") || lowerPrompt.includes("release")) {
    return "Thanks for your interest! We have a range of options currently available across our communities. Availability changes frequently as new stages are released and lots are sold. I'd recommend speaking with our sales team for the most current availability. Would you like me to connect you with a consultant, or can I send you the latest release information?";
  }

  if (lowerPrompt.includes("first home") || lowerPrompt.includes("first-home") || lowerPrompt.includes("incentive") || lowerPrompt.includes("grant")) {
    return "Congratulations on taking the first step towards home ownership! There are several government incentives available for first home buyers, including the First Home Owner Grant and stamp duty concessions. Our sales team can help you navigate all the available options. Would you like to book a consultation to discuss your options in detail?";
  }

  if (lowerPrompt.includes("community") || lowerPrompt.includes("amenities") || lowerPrompt.includes("facilities") || lowerPrompt.includes("park") || lowerPrompt.includes("school")) {
    return "Our Stockland communities are designed with lifestyle in mind, featuring parks, playgrounds, walking trails, and convenient access to schools and shopping. Each community has its own unique character and amenities. I'd love to tell you more about the specific community you're interested in. Would you like me to send through a community guide?";
  }

  return "Thank you for reaching out to Stockland! We appreciate your interest in our communities. I'd love to help you with your enquiry. Could you let me know a bit more about what you're looking for, and I'll connect you with the right person on our team? In the meantime, feel free to visit stockland.com.au for the latest information on our communities.";
}

/**
 * Generates a draft response for a given DM using RAG + GPT.
 *
 * 1. Retrieves the DM content from the store
 * 2. Fetches relevant knowledge base context
 * 3. Scrubs PII from the DM content
 * 4. Constructs a prompt and calls the LLM
 * 5. Computes a confidence score based on knowledge base match quality
 * 6. Stores and returns the draft response
 *
 * @param dmId - The ID of the DM to generate a draft for
 * @returns The generated draft response with context
 */
export async function generateDraft(dmId: string): Promise<DraftGenerationResult> {
  // 1. Retrieve the DM
  const dm = dmStore.getById(dmId);
  if (!dm) {
    throw new Error(`DM not found: ${dmId}`);
  }

  // 2. Check if a draft already exists for this DM
  const existingDraft = draftStore.getByDmId(dmId);
  if (existingDraft && existingDraft.approved) {
    throw new Error(`Draft for DM ${dmId} has already been approved`);
  }

  // 3. Scrub PII from the DM content before sending to LLM
  const scrubbedContent = scrubPII(dm.content);
  const scrubbedSenderName = scrubPII(dm.sender.name);

  // 4. Search knowledge base for relevant context
  const communityName = dm.metadata.communityName || "";
  const searchQuery = [
    scrubbedContent,
    communityName,
    dm.intent,
    dm.metadata.propertyType || "",
  ]
    .filter((s) => s.length > 0)
    .join(" ");

  let context: RankedKnowledgeEntry[] = [];
  try {
    context = await searchKnowledge(searchQuery, 5, 0.01);
  } catch (error) {
    console.error("[DraftGenerationService] Knowledge base search failed:", error);
    // Continue with empty context — the LLM can still generate a generic response
  }

  // 5. Build prompt and call LLM
  const prompt = buildPrompt(scrubbedContent, scrubbedSenderName, context);
  const draftText = await callLLM(prompt);

  // 6. Compute confidence score
  const confidence = computeConfidence(context);

  // 7. Create or update the draft
  const draftId = existingDraft?.id || `draft-${uuidv4()}`;
  const draft: DraftResponse = {
    id: draftId,
    dmId,
    content: draftText,
    confidence,
    reviewedBy: null,
    approved: false,
    editedContent: null,
  };

  if (existingDraft) {
    draftStore.update(draftId, {
      content: draftText,
      confidence,
      reviewedBy: null,
      approved: false,
      editedContent: null,
    });
  } else {
    draftStore.add(draft);
  }

  // 8. Update DM status to drafted
  dmStore.updateStatus(dmId, "drafted");

  // 9. Log audit event
  await auditLogger.logEvent(
    "DRAFT_GENERATED",
    "system",
    dmId,
    JSON.stringify({
      draftId,
      dmId,
      confidence,
      contextEntries: context.length,
      topRelevanceScore: context.length > 0 ? context[0].relevanceScore : 0,
    })
  );

  return { draft, context };
}

/**
 * Submits a draft for sending after human review.
 *
 * 1. Validates the draft exists
 * 2. Applies optional edits
 * 3. Validates compliance (human-in-the-loop)
 * 4. Marks the draft as approved
 * 5. Updates the DM status to SENT
 *
 * @param draftId - The ID of the draft to submit
 * @param reviewerId - The ID of the human reviewer
 * @param editedContent - Optional edited content to replace the original draft
 * @returns The submitted draft result
 */
export async function submitDraft(
  draftId: string,
  reviewerId: string,
  editedContent?: string
): Promise<SubmitDraftResult> {
  // 1. Retrieve the draft
  const draft = draftStore.getById(draftId);
  if (!draft) {
    throw new Error(`Draft not found: ${draftId}`);
  }

  // 2. Verify the DM exists
  const dm = dmStore.getById(draft.dmId);
  if (!dm) {
    throw new Error(`DM not found for draft: ${draft.dmId}`);
  }

  // 3. Apply edits and mark as reviewed
  const updatedDraft = draftStore.update(draftId, {
    reviewedBy: reviewerId,
    approved: true,
    editedContent: editedContent || null,
  });

  if (!updatedDraft) {
    throw new Error(`Failed to update draft: ${draftId}`);
  }

  // 4. Validate compliance — human-in-the-loop check
  const draftForReview: DraftForReview = {
    id: updatedDraft.id,
    dmId: updatedDraft.dmId,
    content: updatedDraft.content,
    confidence: updatedDraft.confidence,
    reviewedBy: updatedDraft.reviewedBy,
    approved: updatedDraft.approved,
    editedContent: updatedDraft.editedContent,
  };

  const violations = validateDraftForSending(draftForReview, reviewerId);
  const criticalViolations = violations.filter((v) => v.severity === "critical");

  if (criticalViolations.length > 0) {
    // Revert the approval on critical violations
    draftStore.update(draftId, {
      approved: false,
      reviewedBy: null,
    });

    await auditLogger.logEvent(
      "DRAFT_SUBMIT_REJECTED",
      reviewerId,
      draftId,
      JSON.stringify({
        draftId,
        dmId: draft.dmId,
        violations: criticalViolations.map((v) => ({
          rule: v.rule,
          message: v.message,
        })),
      })
    );

    const violationMessages = criticalViolations
      .map((v) => v.message)
      .join("; ");
    throw new Error(`Compliance violations: ${violationMessages}`);
  }

  // 5. Update DM status to sent
  const sentAt = new Date().toISOString();
  dmStore.updateStatus(draft.dmId, "sent");

  // 6. Log audit event
  await auditLogger.logEvent(
    "DRAFT_SUBMITTED",
    reviewerId,
    draftId,
    JSON.stringify({
      draftId,
      dmId: draft.dmId,
      reviewerId,
      hasEdits: !!editedContent,
      confidence: updatedDraft.confidence,
      sentAt,
      warningCount: violations.filter((v) => v.severity === "warning").length,
    })
  );

  return {
    draft: updatedDraft,
    dmId: draft.dmId,
    sentAt,
  };
}