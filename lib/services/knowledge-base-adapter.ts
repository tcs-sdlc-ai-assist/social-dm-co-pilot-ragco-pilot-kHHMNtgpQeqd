import type { KnowledgeBaseEntry } from "@/lib/types";

// In-memory cache for knowledge base data
let cachedKnowledgeBase: KnowledgeBaseRawEntry[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface KnowledgeBaseRawEntry {
  id: string;
  category: string;
  question: string;
  answer: string;
  propertyInfo: Record<string, unknown> | null;
  tags: string[];
}

export interface RankedKnowledgeEntry extends KnowledgeBaseEntry {
  relevanceScore: number;
  tags: string[];
}

function isCacheValid(): boolean {
  return cachedKnowledgeBase !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS;
}

/**
 * Loads the static knowledge base from data/knowledge-base.json.
 * Uses an in-memory cache with a 10-minute TTL.
 */
export async function loadKnowledgeBase(): Promise<KnowledgeBaseRawEntry[]> {
  if (isCacheValid() && cachedKnowledgeBase !== null) {
    return cachedKnowledgeBase;
  }

  try {
    // Dynamic import of the JSON file
    const data = await import("@/data/knowledge-base.json");
    const entries: KnowledgeBaseRawEntry[] = (data.default || data) as KnowledgeBaseRawEntry[];
    cachedKnowledgeBase = entries;
    cacheTimestamp = Date.now();
    return entries;
  } catch (error) {
    console.error("[KnowledgeBaseAdapter] Failed to load knowledge base:", error);
    throw new Error("Failed to load knowledge base data");
  }
}

/**
 * Tokenizes a string into lowercase words, stripping punctuation.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

/**
 * Computes a relevance score between a query and a knowledge base entry.
 * Uses keyword matching across question, answer, tags, and category fields.
 */
function computeRelevanceScore(entry: KnowledgeBaseRawEntry, queryTokens: string[]): number {
  if (queryTokens.length === 0) {
    return 0;
  }

  const questionTokens = tokenize(entry.question);
  const answerTokens = tokenize(entry.answer);
  const tagTokens = entry.tags.map((t) => t.toLowerCase().replace(/-/g, " ")).flatMap((t) => t.split(/\s+/));
  const categoryTokens = tokenize(entry.category);

  // Weights for different fields
  const QUESTION_WEIGHT = 3.0;
  const TAG_WEIGHT = 2.5;
  const CATEGORY_WEIGHT = 2.0;
  const ANSWER_WEIGHT = 1.0;

  let totalScore = 0;

  for (const queryToken of queryTokens) {
    // Exact match scoring
    const questionExact = questionTokens.filter((t) => t === queryToken).length;
    const answerExact = answerTokens.filter((t) => t === queryToken).length;
    const tagExact = tagTokens.filter((t) => t === queryToken).length;
    const categoryExact = categoryTokens.filter((t) => t === queryToken).length;

    totalScore += questionExact * QUESTION_WEIGHT;
    totalScore += answerExact * ANSWER_WEIGHT;
    totalScore += tagExact * TAG_WEIGHT;
    totalScore += categoryExact * CATEGORY_WEIGHT;

    // Partial match scoring (substring match with reduced weight)
    const PARTIAL_WEIGHT = 0.5;
    const questionPartial = questionTokens.filter((t) => t !== queryToken && (t.includes(queryToken) || queryToken.includes(t))).length;
    const answerPartial = answerTokens.filter((t) => t !== queryToken && (t.includes(queryToken) || queryToken.includes(t))).length;
    const tagPartial = tagTokens.filter((t) => t !== queryToken && (t.includes(queryToken) || queryToken.includes(t))).length;

    totalScore += questionPartial * QUESTION_WEIGHT * PARTIAL_WEIGHT;
    totalScore += answerPartial * ANSWER_WEIGHT * PARTIAL_WEIGHT;
    totalScore += tagPartial * TAG_WEIGHT * PARTIAL_WEIGHT;
  }

  // Normalize score to 0-1 range using a sigmoid-like function
  const maxPossibleScore = queryTokens.length * (QUESTION_WEIGHT + TAG_WEIGHT + CATEGORY_WEIGHT + ANSWER_WEIGHT) * 2;
  const normalizedScore = Math.min(totalScore / Math.max(maxPossibleScore, 1), 1);

  return normalizedScore;
}

/**
 * Ranks knowledge base entries by relevance to the given query.
 * Returns entries sorted by descending relevance score.
 */
export function rankResults(
  entries: KnowledgeBaseRawEntry[],
  query: string
): RankedKnowledgeEntry[] {
  const queryTokens = tokenize(query);

  const scored: RankedKnowledgeEntry[] = entries.map((entry) => {
    const relevanceScore = computeRelevanceScore(entry, queryTokens);
    const propertyInfo = entry.propertyInfo as Record<string, string> | null;

    return {
      id: entry.id,
      category: entry.category,
      question: entry.question,
      answer: entry.answer,
      propertyInfo,
      tags: entry.tags,
      relevanceScore,
    };
  });

  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return scored;
}

/**
 * Searches the knowledge base for entries relevant to the given query.
 * Returns the top matching entries with relevance scores above a minimum threshold.
 */
export async function searchKnowledge(
  query: string,
  maxResults: number = 5,
  minScore: number = 0.01
): Promise<RankedKnowledgeEntry[]> {
  try {
    const entries = await loadKnowledgeBase();
    const ranked = rankResults(entries, query);

    return ranked
      .filter((entry) => entry.relevanceScore >= minScore)
      .slice(0, maxResults);
  } catch (error) {
    console.error("[KnowledgeBaseAdapter] Search failed:", error);
    throw new Error("Knowledge base search failed");
  }
}

/**
 * Retrieves property information for a specific community or property ID.
 * Searches by knowledge base entry ID or by community name in propertyInfo.
 */
export async function getPropertyInfo(
  propertyId: string
): Promise<RankedKnowledgeEntry[]> {
  try {
    const entries = await loadKnowledgeBase();
    const normalizedId = propertyId.toLowerCase().trim();

    const matched = entries.filter((entry) => {
      // Match by entry ID
      if (entry.id.toLowerCase() === normalizedId) {
        return true;
      }

      // Match by community name in propertyInfo
      if (entry.propertyInfo) {
        const community = (entry.propertyInfo as Record<string, string>).community;
        if (community && community.toLowerCase() === normalizedId) {
          return true;
        }
      }

      // Match by tag
      if (entry.tags.some((tag) => tag.toLowerCase() === normalizedId)) {
        return true;
      }

      return false;
    });

    return matched.map((entry) => ({
      id: entry.id,
      category: entry.category,
      question: entry.question,
      answer: entry.answer,
      propertyInfo: entry.propertyInfo as Record<string, string> | null,
      tags: entry.tags,
      relevanceScore: 1.0,
    }));
  } catch (error) {
    console.error("[KnowledgeBaseAdapter] Property info retrieval failed:", error);
    throw new Error("Failed to retrieve property information");
  }
}

/**
 * Clears the in-memory knowledge base cache.
 * Useful for testing or forcing a reload.
 */
export function clearKnowledgeBaseCache(): void {
  cachedKnowledgeBase = null;
  cacheTimestamp = 0;
}