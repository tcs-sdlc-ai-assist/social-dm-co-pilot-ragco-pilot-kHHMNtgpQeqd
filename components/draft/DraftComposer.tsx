"use client";

import React, { useState, useCallback } from "react";
import useDraft from "@/lib/hooks/useDraft";
import ConfidenceMeter from "@/components/ui/ConfidenceMeter";

// ============================================================
// DraftComposer — AI draft response editing and approval UI
// ============================================================

export interface DraftComposerProps {
  dmId: string;
  senderName?: string;
  onDraftSent?: (draftId: string, dmId: string) => void;
  onError?: (error: string) => void;
  reviewerId?: string;
}

interface KnowledgeContextEntry {
  id: string;
  category: string;
  question: string;
  answer: string;
  relevanceScore: number;
  propertyInfo?: Record<string, string> | null;
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
      />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );
}

function LightBulbIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
      />
    </svg>
  );
}

const NEXT_STEP_SUGGESTIONS: string[] = [
  "\n\nWould you like me to book a time for you to visit our sales centre? Our consultants are available 7 days a week.",
  "\n\nI can also send you the latest lot release map and pricing guide — would that be helpful?",
  "\n\nWould you like to schedule a call with one of our sales consultants to discuss your options in more detail?",
  "\n\nI'd be happy to arrange a personalised tour of the display homes at your convenience. What day works best for you?",
  "\n\nShall I add you to our mailing list so you're the first to know about new releases and promotions?",
];

export default function DraftComposer({
  dmId,
  senderName,
  onDraftSent,
  onError,
  reviewerId = "officer-default",
}: DraftComposerProps) {
  const {
    draft,
    generating,
    submitting,
    error: draftError,
    generateDraft,
    updateDraftContent,
    submitDraft,
    clearDraft,
    clearError,
  } = useDraft();

  const [contextEntries, setContextEntries] = useState<KnowledgeContextEntry[]>([]);
  const [showContext, setShowContext] = useState<boolean>(false);
  const [nextStepIndex, setNextStepIndex] = useState<number>(0);

  const handleGenerateDraft = useCallback(async () => {
    clearError();
    setContextEntries([]);

    try {
      const response = await fetch("/api/dm/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dmId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMessage = data.error || `Failed to generate draft (HTTP ${response.status})`;
        onError?.(errorMessage);
        return;
      }

      if (data.data?.context && Array.isArray(data.data.context)) {
        setContextEntries(
          data.data.context.map((entry: KnowledgeContextEntry) => ({
            id: entry.id,
            category: entry.category,
            question: entry.question,
            answer: entry.answer,
            relevanceScore: entry.relevanceScore,
            propertyInfo: entry.propertyInfo ?? null,
          }))
        );
      }

      // Use the hook to generate and store the draft
      await generateDraft(dmId);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred during draft generation";
      onError?.(errorMessage);
    }
  }, [dmId, generateDraft, clearError, onError]);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateDraftContent(e.target.value);
    },
    [updateDraftContent]
  );

  const handleInsertPropertyInfo = useCallback(() => {
    if (!draft || contextEntries.length === 0) {
      return;
    }

    const topEntry = contextEntries[0];
    let insertText = `\n\n📍 ${topEntry.category.toUpperCase()}: ${topEntry.answer}`;

    if (topEntry.propertyInfo) {
      const infoEntries = Object.entries(topEntry.propertyInfo)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");
      insertText += `\n(${infoEntries})`;
    }

    const currentContent = draft.editedContent || draft.content;
    updateDraftContent(currentContent + insertText);
  }, [draft, contextEntries, updateDraftContent]);

  const handleSuggestNextStep = useCallback(() => {
    if (!draft) {
      return;
    }

    const suggestion = NEXT_STEP_SUGGESTIONS[nextStepIndex % NEXT_STEP_SUGGESTIONS.length];
    const currentContent = draft.editedContent || draft.content;
    updateDraftContent(currentContent + suggestion);
    setNextStepIndex((prev) => prev + 1);
  }, [draft, nextStepIndex, updateDraftContent]);

  const handleApproveAndSend = useCallback(async () => {
    if (!draft) {
      return;
    }

    clearError();

    const success = await submitDraft(reviewerId);

    if (success) {
      onDraftSent?.(draft.id, dmId);
    } else if (draftError) {
      onError?.(draftError);
    }
  }, [draft, dmId, reviewerId, submitDraft, clearError, draftError, onDraftSent, onError]);

  const handleClearDraft = useCallback(() => {
    clearDraft();
    setContextEntries([]);
    setShowContext(false);
    setNextStepIndex(0);
  }, [clearDraft]);

  const displayContent = draft?.editedContent || draft?.content || "";
  const charCount = displayContent.length;
  const MAX_CHARS = 2000;
  const isOverLimit = charCount > MAX_CHARS;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SparklesIcon />
          <h3 className="text-heading-4 text-gray-900">Draft Composer</h3>
          {senderName && (
            <span className="text-body-sm text-gray-500">
              — Replying to {senderName}
            </span>
          )}
        </div>
        {draft && (
          <button
            type="button"
            onClick={handleClearDraft}
            className="text-body-sm text-gray-500 hover:text-gray-700 transition-colors duration-200"
          >
            Clear Draft
          </button>
        )}
      </div>

      {/* Error Display */}
      {draftError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1">
            <p className="text-body-sm text-red-800">{draftError}</p>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="text-red-500 hover:text-red-700 transition-colors duration-200"
            aria-label="Dismiss error"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      )}

      {/* Generate Draft Button (shown when no draft exists) */}
      {!draft && !generating && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-12 gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-brand-50">
            <SparklesIcon />
          </div>
          <div className="text-center">
            <p className="text-body text-gray-700 font-medium">
              Generate an AI-powered draft response
            </p>
            <p className="text-body-sm text-gray-500 mt-1">
              Uses knowledge base context and GPT to create a personalised reply
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerateDraft}
            disabled={!dmId}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-body-sm font-medium text-white shadow-sm transition-colors duration-200 hover:bg-brand-600 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SparklesIcon />
            Generate Draft
          </button>
        </div>
      )}

      {/* Loading State */}
      {generating && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-12 gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-brand-50">
            <LoadingSpinner />
          </div>
          <div className="text-center">
            <p className="text-body text-gray-700 font-medium">
              Generating draft response…
            </p>
            <p className="text-body-sm text-gray-500 mt-1">
              Searching knowledge base and composing a personalised reply
            </p>
          </div>
        </div>
      )}

      {/* Draft Editor */}
      {draft && !generating && (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Main Editor Panel */}
          <div className="flex-1 flex flex-col gap-3">
            {/* Confidence Meter */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <ConfidenceMeter
                confidence={draft.confidence}
                showLabel={true}
              />
            </div>

            {/* Textarea */}
            <div className="relative">
              <textarea
                value={displayContent}
                onChange={handleContentChange}
                rows={10}
                className={`w-full rounded-lg border bg-white px-4 py-3 text-body text-gray-900 placeholder-gray-400 transition-colors duration-200 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 resize-y ${
                  isOverLimit
                    ? "border-red-300 focus:border-red-500"
                    : "border-gray-200 focus:border-brand-500"
                }`}
                placeholder="Draft response will appear here…"
                aria-label="Draft response editor"
              />
              <div className="flex items-center justify-between mt-1 px-1">
                <div className="flex items-center gap-1">
                  {draft.editedContent && (
                    <span className="inline-flex items-center rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-2xs font-medium text-purple-700">
                      Edited
                    </span>
                  )}
                </div>
                <span
                  className={`text-2xs ${
                    isOverLimit ? "text-red-500 font-medium" : "text-gray-400"
                  }`}
                >
                  {charCount}/{MAX_CHARS}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleGenerateDraft}
                disabled={generating}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-body-sm font-medium text-gray-700 shadow-sm transition-colors duration-200 hover:bg-gray-50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SparklesIcon />
                Regenerate
              </button>

              <button
                type="button"
                onClick={handleInsertPropertyInfo}
                disabled={contextEntries.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-body-sm font-medium text-gray-700 shadow-sm transition-colors duration-200 hover:bg-gray-50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <DocumentIcon />
                Insert Property Info
              </button>

              <button
                type="button"
                onClick={handleSuggestNextStep}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-body-sm font-medium text-gray-700 shadow-sm transition-colors duration-200 hover:bg-gray-50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                <LightBulbIcon />
                Suggest Next Step
              </button>

              <div className="flex-1" />

              <button
                type="button"
                onClick={handleApproveAndSend}
                disabled={submitting || isOverLimit || displayContent.trim().length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-body-sm font-medium text-white shadow-sm transition-colors duration-200 hover:bg-brand-600 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <LoadingSpinner />
                    Sending…
                  </>
                ) : (
                  <>
                    <CheckIcon />
                    Approve &amp; Send
                  </>
                )}
              </button>
            </div>

            {/* Human Review Notice */}
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
              <p className="text-2xs text-blue-700">
                <span className="font-medium">Human review required:</span> All
                responses must be reviewed and approved by an officer before
                sending. Your reviewer ID ({reviewerId}) will be recorded in the
                audit log.
              </p>
            </div>
          </div>

          {/* Knowledge Base Context Panel */}
          {contextEntries.length > 0 && (
            <div className="lg:w-panel flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowContext((prev) => !prev)}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-body-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-50 w-full"
              >
                <span className="flex items-center gap-2">
                  <DocumentIcon />
                  Knowledge Base Context ({contextEntries.length})
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={`w-4 h-4 transition-transform duration-200 ${
                    showContext ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {showContext && (
                <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto scrollbar-thin">
                  {contextEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-gray-200 bg-white p-3 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-2xs font-medium text-gray-600">
                          {entry.category}
                        </span>
                        <span className="text-2xs text-gray-400">
                          Relevance: {Math.round(entry.relevanceScore * 100)}%
                        </span>
                      </div>
                      <p className="text-body-sm font-medium text-gray-800">
                        {entry.question}
                      </p>
                      <p className="text-body-sm text-gray-600 line-clamp-4">
                        {entry.answer}
                      </p>
                      {entry.propertyInfo && (
                        <div className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5">
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {Object.entries(entry.propertyInfo).map(
                              ([key, value]) => (
                                <span
                                  key={key}
                                  className="text-2xs text-gray-500"
                                >
                                  <span className="font-medium text-gray-600">
                                    {key}:
                                  </span>{" "}
                                  {typeof value === "string"
                                    ? value
                                    : JSON.stringify(value)}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { DraftComposer };