import { useState, useCallback } from "react";
import type { DraftResponse } from "@/lib/types";

// ============================================================
// useDraft — Custom hook for draft generation and management
// ============================================================

export interface UseDraftReturn {
  draft: DraftResponse | null;
  generating: boolean;
  submitting: boolean;
  error: string | null;
  generateDraft: (dmId: string) => Promise<DraftResponse | null>;
  updateDraftContent: (content: string) => void;
  submitDraft: (reviewerId: string) => Promise<boolean>;
  clearDraft: () => void;
  clearError: () => void;
}

interface GenerateDraftAPIResponse {
  success: boolean;
  data: {
    draft: DraftResponse;
    context: Array<{
      id: string;
      category: string;
      question: string;
      answer: string;
      relevanceScore: number;
    }>;
  } | null;
  error: string | null;
}

interface SubmitDraftAPIResponse {
  success: boolean;
  data: {
    draft: DraftResponse;
    dmId: string;
    sentAt: string;
  } | null;
  error: string | null;
}

export function useDraft(): UseDraftReturn {
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [generating, setGenerating] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearDraft = useCallback(() => {
    setDraft(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const generateDraft = useCallback(
    async (dmId: string): Promise<DraftResponse | null> => {
      if (!dmId || dmId.trim().length === 0) {
        setError("DM ID is required to generate a draft");
        return null;
      }

      setGenerating(true);
      setError(null);

      try {
        const response = await fetch("/api/dm/draft", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ dm_id: dmId }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const errorMessage =
            errorData?.error ||
            `Failed to generate draft (HTTP ${response.status})`;
          setError(errorMessage);
          setGenerating(false);
          return null;
        }

        const data: GenerateDraftAPIResponse = await response.json();

        if (!data.success || !data.data) {
          const errorMessage = data.error || "Failed to generate draft";
          setError(errorMessage);
          setGenerating(false);
          return null;
        }

        const generatedDraft = data.data.draft;
        setDraft(generatedDraft);
        setGenerating(false);
        return generatedDraft;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while generating the draft";
        setError(errorMessage);
        setGenerating(false);
        return null;
      }
    },
    []
  );

  const updateDraftContent = useCallback(
    (content: string) => {
      if (!draft) {
        setError("No draft to update");
        return;
      }

      setDraft({
        ...draft,
        editedContent: content,
      });
    },
    [draft]
  );

  const submitDraft = useCallback(
    async (reviewerId: string): Promise<boolean> => {
      if (!draft) {
        setError("No draft to submit");
        return false;
      }

      if (!reviewerId || reviewerId.trim().length === 0) {
        setError("Reviewer ID is required to submit a draft");
        return false;
      }

      setSubmitting(true);
      setError(null);

      try {
        const response = await fetch("/api/dm/draft/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            draft_id: draft.id,
            reviewer_id: reviewerId,
            edited_text: draft.editedContent || undefined,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const errorMessage =
            errorData?.error ||
            `Failed to submit draft (HTTP ${response.status})`;
          setError(errorMessage);
          setSubmitting(false);
          return false;
        }

        const data: SubmitDraftAPIResponse = await response.json();

        if (!data.success || !data.data) {
          const errorMessage = data.error || "Failed to submit draft";
          setError(errorMessage);
          setSubmitting(false);
          return false;
        }

        setDraft({
          ...data.data.draft,
        });
        setSubmitting(false);
        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while submitting the draft";
        setError(errorMessage);
        setSubmitting(false);
        return false;
      }
    },
    [draft]
  );

  return {
    draft,
    generating,
    submitting,
    error,
    generateDraft,
    updateDraftContent,
    submitDraft,
    clearDraft,
    clearError,
  };
}

export default useDraft;